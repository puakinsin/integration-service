import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../../shared/logger.js';
import { eventEnvelopeSchema } from '../../shared/schemas/eventEnvelope.js';
import { checkAndSetIdempotencyKey } from '../clients/idempotency.js';
import { eventsReceivedTotal, eventProcessingDuration } from '../../metrics/prom.js';
import { sanitizePayload } from '../middleware/auth.js';

const redis = new Redis(config.REDIS_URL);
const wooQueue = new Queue('woo-events', { connection: redis });

export async function wooWebhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const topic = request.headers['x-woo-webhook-topic'] as string || 'order.created';
  const body = request.body as any;
  
  logger.info({ topic, orderId: body?.id }, 'Received Woo webhook');
  
  // Build event envelope
  const event = {
    event_id: uuidv4(),
    event_type: `woo.${topic}`,
    source: 'woo',
    occurred_at: new Date().toISOString(),
    idempotency_key: `woo:${body.id}:${topic}:${body.timestamp || Date.now()}`,
    trace_id: uuidv4(),
    data: body,
  };
  
  // Validate
  const parsed = eventEnvelopeSchema.safeParse(event);
  if (!parsed.success) {
    logger.error({ error: parsed.error }, 'Invalid event format');
    reply.code(400).send({ error: 'Invalid event format' });
    return;
  }
  
  // Track received metrics
  eventsReceivedTotal.inc({ source: 'woo', event_type: event.event_type });
  
  // Check idempotency
  const idempotencyResult = await checkAndSetIdempotencyKey(event.idempotency_key);
  
  if (!idempotencyResult.isNew) {
    logger.info({ idempotencyKey: event.idempotency_key, status: idempotencyResult.existingStatus }, 'Duplicate event');
    return { status: 'already_processed', idempotency_key: event.idempotency_key };
  }
  
  // Queue the event
  const startTime = Date.now();
  
  try {
    await wooQueue.add(event.event_type, event, {
      jobId: event.idempotency_key,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    
    const duration = Date.now() - startTime;
    eventProcessingDuration.observe({ event_type: event.event_type }, duration);
    
    logger.info({ eventId: event.event_id, eventType: event.event_type, duration }, 'Event queued');
    
    return { status: 'queued', event_id: event.event_id };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to queue event');
    throw error;
  }
}
