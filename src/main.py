import os
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Header, Depends
from pydantic import BaseModel
from rq import Queue
from redis import Redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Elitaco Integration Service")

# Redis connection
redis_conn = Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
event_queue = Queue('events', connection=redis_conn)

# ========== Event Models ==========

class EventEnvelope(BaseModel):
    event_id: str
    event_type: str
    source: str
    occurred_at: datetime
    idempotency_key: str
    trace_id: Optional[str] = None
    data: dict

# ========== Event Handlers ==========

async def handle_woo_order_created(data: dict) -> dict:
    """Handle WooCommerce order created event"""
    logger.info(f"Processing woo.order.created for order {data.get('id')}")
    
    # Get order details
    order_id = data.get('id')
    email = data.get('billing', {}).get('email')
    total = data.get('total')
    
    # Map to Odoo partner
    from src.models.mapping import get_or_create_partner
    partner_id = await get_or_create_partner(email)
    
    # Create order in Odoo
    from src.handlers.odoo_handler import create_sale_order
    odoo_order = await create_sale_order(
        partner_id=partner_id,
        lines=[],  # Parse order lines from data
        origin=f"WOO:{order_id}"
    )
    
    # Store mapping
    from src.models.mapping import store_order_mapping
    await store_order_mapping(order_id, odoo_order['id'])
    
    return odoo_order

async def handle_woo_order_paid(data: dict) -> dict:
    """Handle WooCommerce order paid event"""
    logger.info(f"Processing woo.order.paid for order {data.get('id')}")
    
    # Confirm order in Odoo
    from src.models.mapping import get_order_mapping
    odoo_order_id = await get_order_mapping(data.get('id'))
    
    if odoo_order_id:
        from src.handlers.odoo_handler import confirm_sale_order
        return await confirm_sale_order(odoo_order_id)
    
    return {"status": "skipped", "reason": "no_mapping"}

# ========== Routes ==========

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "elitaco-integration-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/webhook/woo")
async def woo_webhook(
    request: Request,
    x_woo_webhook_topic: Optional[str] = Header(None)
):
    """WooCommerce webhook endpoint"""
    body = await request.json()
    
    # Get event type from topic header
    topic = x_woo_webhook_topic or body.get('type', 'order.created')
    
    # Create event envelope
    event = EventEnvelope(
        event_id=str(uuid4()),
        event_type=f"woo.{topic}",
        source="woo",
        occurred_at=datetime.utcnow(),
        idempotency_key=f"woo:{body.get('id')}:{topic}:{body.get('timestamp', '')}",
        trace_id=str(uuid4()),
        data=body
    )
    
    # Check idempotency
    from src.models.event import is_event_processed
    if await is_event_processed(event.idempotency_key):
        logger.info(f"Event {event.idempotency_key} already processed")
        return {"status": "already_processed"}
    
    # Queue event for processing
    event_queue.enqueue(
        "src.handlers.woo_handler.process_event",
        event.model_dump()
    )
    
    return {"status": "queued", "event_id": event.event_id}

@app.post("/api/odoo/hook")
async def odoo_webhook(request: Request):
    """Odoo webhook endpoint"""
    body = await request.json()
    
    event = EventEnvelope(
        event_id=str(uuid4()),
        event_type=body.get('event_type', 'odoo.sale.confirmed'),
        source="odoo",
        occurred_at=datetime.utcnow(),
        idempotency_key=f"odoo:{body.get('model')}:{body.get('record_id')}:{body.get('event_type')}:{body.get('write_date', '')}",
        trace_id=str(uuid4()),
        data=body
    )
    
    # Queue event
    event_queue.enqueue(
        "src.handlers.odoo_handler.process_event",
        event.model_dump()
    )
    
    return {"status": "queued"}

@app.get("/api/orders/{order_id}/timeline")
async def get_order_timeline(order_id: int):
    """Get order timeline for debugging"""
    from src.models.event import get_order_events
    
    events = await get_order_events(order_id)
    
    return {
        "order_id": order_id,
        "events": events
    }

# ========== Queue Worker ==========

def process_woo_event(event_data: dict):
    """Process Woo event from queue"""
    import asyncio
    
    event = EventEnvelope(**event_data)
    
    if event.event_type == "woo.order.created":
        return asyncio.run(handle_woo_order_created(event.data))
    elif event.event_type == "woo.order.paid":
        return asyncio.run(handle_woo_order_paid(event.data))
    
    return {"status": "unknown_event_type"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
