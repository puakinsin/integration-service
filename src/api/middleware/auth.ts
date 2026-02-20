import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { config } from '../../config/index.js';

export async function verifyWooWebhook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const signature = request.headers['x-woo-webhook-signature'];
  
  if (!config.WOO_WEBHOOK_SECRET) {
    // Skip verification if no secret configured (dev mode)
    return;
  }
  
  if (!signature) {
    reply.code(401).send({ error: 'Missing webhook signature' });
    return;
  }
  
  const payload = JSON.stringify(request.body);
  const expectedSignature = crypto
    .createHmac('sha256', config.WOO_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    reply.code(401).send({ error: 'Invalid webhook signature' });
    return;
  }
}

export function sanitizePayload(payload: any): any {
  if (!payload) return payload;
  
  const sanitized = { ...payload };
  
  // Sanitize email
  if (sanitized.email) {
    const [local, domain] = sanitized.email.split('@');
    sanitized.email = `${local.substring(0, 2)}***@${domain}`;
  }
  
  // Sanitize billing info
  if (sanitized.billing) {
    const billing = { ...sanitized.billing };
    if (billing.email) billing.email = '***';
    if (billing.phone) billing.phone = '***';
    if (billing.address_1) billing.address_1 = '***';
    if (billing.first_name) billing.first_name = billing.first_name.charAt(0) + '***';
    if (billing.last_name) billing.last_name = billing.last_name.charAt(0) + '***';
    sanitized.billing = billing;
  }
  
  // Sanitize payment info
  if (sanitized.transaction_id) sanitized.transaction_id = '***';
  
  return sanitized;
}
