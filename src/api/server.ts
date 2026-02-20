import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from '../config/index.js';
import { logger } from '../shared/logger.js';
import { wooWebhookHandler } from '../routes/wooWebhook.js';
import { internalTimelineHandler } from '../routes/internalTimeline.js';
import { metricsHandler } from '../metrics/prom.js';
import { verifyWooWebhook } from '../middleware/auth.js';
import { verifyInternalApiKey } from '../middleware/internalAuth.js';

const fastify = Fastify({
  logger: logger,
});

// Register plugins
await fastify.register(helmet);
await fastify.register(cors);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', service: 'integration-service', timestamp: new Date().toISOString() };
});

// Prometheus metrics
fastify.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType);
  return metricsHandler();
});

// WooCommerce webhook
fastify.post('/webhook/woo', {
  preHandler: verifyWooWebhook,
}, async (request, reply) => {
  return wooWebhookHandler(request, reply);
});

// Internal API - Order timeline (for ops/debugging)
fastify.get('/internal/orders/:wooOrderId/timeline', {
  preHandler: verifyInternalApiKey,
}, async (request, reply) => {
  return internalTimelineHandler(request, reply);
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 8000, host: '0.0.0.0' });
    logger.info('Server started on port 8000');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();

export { fastify };
