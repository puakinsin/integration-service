# Integration Service

Node.js + TypeScript + BullMQ integration middleware for WooCommerce ↔ Odoo.

## Features

- ✅ WooCommerce Webhook handling
- ✅ BullMQ job queue with Redis
- ✅ PostgreSQL for event log, order mapping, DLQ
- ✅ Prometheus metrics endpoint (`/metrics`)
- ✅ Grafana dashboards (via provisioning)
- ✅ Idempotency support
- ✅ Dead letter queue
- ✅ Internal API with auth

## Quick Start

```bash
# Build TypeScript
npm run build

# Start all services
docker-compose up -d
```

## Environment Variables

```env
DATABASE_URL=postgresql://odoo:odoo@postgres:5432/integration
REDIS_URL=redis://redis:6379/0
ODOO_URL=http://odoo:7089
ODOO_DB=odoo
ODOO_USERNAME=admin@elitaco.my
ODOO_PASSWORD=admin
WOO_WEBHOOK_SECRET=your_woo_secret
INTERNAL_API_KEY=internal-secret
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/webhook/woo` | POST | Woo webhook |
| `/internal/orders/:id/timeline` | GET | Order timeline (auth required) |

## Metrics

- `integration_events_received_total`
- `integration_events_processed_total`
- `integration_event_processing_duration_ms`
- `integration_queue_depth`
- `integration_queue_oldest_job_age_seconds`
- `integration_idempotency_hits_total`
- `integration_retries_total`
- `integration_dlq_total`
- `integration_odoo_api_errors_total`

## Grafana

Access: http://localhost:3001
- Username: admin
- Password: admin

Dashboards:
- Integration Overview
- Integration Failures  
- Order Processing Funnel

## Database Tables

- `event_log` - Event lifecycle
- `order_map` - Woo ↔ Odoo order mapping
- `dlq` - Dead letter queue
