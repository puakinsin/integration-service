import { FastifyRequest, FastifyReply } from 'fastify';
import Knex from 'knex';
import { knexConfig } from '../../db/knex.js';
import { logger } from '../../shared/logger.js';
import { sanitizePayload } from '../middleware/auth.js';

const knex = Knex(knexConfig);

interface TimelineEvent {
  id: string;
  event_type: string;
  status: string;
  received_at: Date;
  latency_ms: number | null;
  error_message: string | null;
  metadata: any;
}

export async function internalTimelineHandler(
  request: FastifyRequest<{ Params: { wooOrderId: string } }>,
  reply: FastifyReply
) {
  const wooOrderId = parseInt(request.params.wooOrderId);
  
  if (isNaN(wooOrderId)) {
    reply.code(400).send({ error: 'Invalid order ID' });
    return;
  }
  
  try {
    // Find events related to this order
    const events = await knex('event_log')
      .where('payload', 'like', `%${wooOrderId}%`)
      .orderBy('received_at', 'asc')
      .select('*');
    
    // Get order mapping
    const orderMap = await knex('order_map')
      .where('woo_order_id', wooOrderId)
      .first();
    
    // Calculate stage timings
    const timeline: TimelineEvent[] = events.map((event: any) => ({
      id: event.id,
      event_type: event.event_type,
      status: event.status,
      received_at: event.received_at,
      latency_ms: event.latency_ms,
      error_message: event.error_message,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
    }));
    
    // Calculate stage durations
    const stages: Record<string, number> = {};
    let lastTime: Date | null = null;
    
    for (const event of timeline) {
      if (lastTime) {
        const duration = new Date(event.received_at).getTime() - lastTime.getTime();
        stages[event.status] = duration;
      }
      lastTime = event.received_at;
    }
    
    return {
      woo_order_id: wooOrderId,
      odoo_order_id: orderMap?.odoo_sale_order_id || null,
      current_status: {
        woo: orderMap?.woo_status || null,
        odoo: orderMap?.odoo_status || null,
      },
      timeline: timeline.map(e => ({
        ...e,
        payload: sanitizePayload(e.payload),
      })),
      stage_durations_ms: stages,
      last_sync_at: orderMap?.last_sync_at,
    };
  } catch (error: any) {
    logger.error({ error: error.message, wooOrderId }, 'Failed to get timeline');
    reply.code(500).send({ error: 'Failed to get timeline' });
  }
}
