import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import Knex from 'knex';
import { config } from '../config/index.js';
import { logger } from '../shared/logger.js';
import { knexConfig } from '../db/knex.js';
import { setIdempotencyStatus } from '../api/clients/idempotency.js';
import { createSaleOrder, confirmSaleOrder } from '../api/clients/odooClient.js';
import { eventsProcessedTotal, dlqTotal, retriesTotal, updateQueueMetrics } from '../metrics/prom.js';
import { sanitizePayload } from '../api/middleware/auth.js';

const redis = new Redis(config.REDIS_URL);
const knex = Knex(knexConfig);

// Worker for Woo events
const wooWorker = new Worker(
  'woo-events',
  async (job) => {
    const event = job.data;
    const { event_type, idempotency_key, data } = event;
    
    logger.info({ eventType: event_type, jobId: job.id }, 'Processing Woo event');
    
    const startTime = Date.now();
    
    try {
      // Log to DB
      await knex('event_log').insert({
        event_type,
        source: 'woo',
        idempotency_key,
        trace_id: event.trace_id,
        payload: JSON.stringify(event),
        status: 'processing',
        processing_at: knex.fn.now(),
      });
      
      // Process based on event type
      if (event_type === 'woo.order.created') {
        await processWooOrderCreated(data, event);
      } else if (event_type === 'woo.order.paid') {
        await processWooOrderPaid(data);
      }
      
      // Mark success
      const latency = Date.now() - startTime;
      await knex('event_log')
        .where('idempotency_key', idempotency_key)
        .update({
          status: 'succeeded',
          completed_at: knex.fn.now(),
          latency_ms: latency,
        });
      
      await setIdempotencyStatus(idempotency_key, 'succeeded');
      eventsProcessedTotal.inc({ status: 'succeeded', event_type });
      
      return { status: 'success' };
    } catch (error: any) {
      logger.error({ error: error.message, event_type }, 'Processing failed');
      
      const latency = Date.now() - startTime;
      
      // Update log
      await knex('event_log')
        .where('idempotency_key', idempotency_key)
        .update({
          status: 'failed',
          failed_at: knex.fn.now(),
          latency_ms: latency,
          error_message: error.message,
          error_stack: error.stack,
        });
      
      // Check retry count
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        // Send to DLQ
        await knex('dlq').insert({
          event_type,
          idempotency_key,
          original_payload: JSON.stringify(sanitizePayload(event)),
          last_error: error.message,
          last_error_stack: error.stack,
          retry_count: job.attemptsMade + 1,
          reason: 'max_retries_exceeded',
        });
        
        dlqTotal.inc({ event_type, reason: 'max_retries_exceeded' });
        eventsProcessedTotal.inc({ status: 'dlq', event_type });
      } else {
        retriesTotal.inc({ event_type });
        eventsProcessedTotal.inc({ status: 'retry', event_type });
      }
      
      await setIdempotencyStatus(idempotency_key, 'failed');
      
      throw error;
    }
  },
  { connection: redis }
);

async function processWooOrderCreated(data: any, event: any) {
  const email = data.billing?.email;
  
  if (!email) {
    throw new Error('No billing email in order');
  }
  
  // Map to Odoo partner (simplified)
  const partnerId = 1; // Default partner
  
  // Create order in Odoo
  const orderId = await createSaleOrder(
    partnerId,
    data.line_items || [],
    `WOO:${data.id}`
  );
  
  // Store mapping
  await knex('order_map').insert({
    woo_order_id: data.id,
    odoo_sale_order_id: orderId,
    woo_status: data.status,
    last_sync_at: knex.fn.now(),
  }).onConflict('woo_order_id').merge();
  
  logger.info({ wooOrderId: data.id, odooOrderId: orderId }, 'Order created in Odoo');
}

async function processWooOrderPaid(data: any) {
  // Update order status
  await knex('order_map')
    .where('woo_order_id', data.id)
    .update({
      woo_status: data.status,
      last_sync_at: knex.fn.now(),
    });
  
  // Confirm in Odoo
  const orderMap = await knex('order_map')
    .where('woo_order_id', data.id)
    .first();
  
  if (orderMap?.odoo_sale_order_id) {
    await confirmSaleOrder(orderMap.odoo_sale_order_id);
  }
}

// Queue metrics updater
setInterval(async () => {
  try {
    const wooQueue = new Queue('woo-events', { connection: redis });
    const jobCounts = await wooQueue.getJobCounts();
    await updateQueueMetrics('woo-events', jobCounts);
  } catch (error) {
    logger.error({ error }, 'Failed to update queue metrics');
  }
}, 10000);

// Handle completed/failed jobs
wooWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

wooWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
});

logger.info('Worker started');

export { wooWorker };
