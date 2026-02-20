import { z } from 'zod';

export const eventEnvelopeSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string(),
  source: z.enum(['woo', 'odoo']),
  occurred_at: z.string().datetime(),
  idempotency_key: z.string(),
  trace_id: z.string().uuid().optional(),
  data: z.record(z.any()),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export const wooOrderCreatedSchema = eventEnvelopeSchema.extend({
  event_type: z.literal('woo.order.created'),
  data: z.object({
    id: z.number(),
    status: z.string(),
    total: z.string(),
    currency: z.string().optional(),
    billing: z.object({
      email: z.string().email().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      address_1: z.string().optional(),
      city: z.string().optional(),
      postcode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    line_items: z.array(z.object({
      id: z.number(),
      product_id: z.number(),
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
    })).optional(),
  }),
});

export const wooOrderPaidSchema = eventEnvelopeSchema.extend({
  event_type: z.literal('woo.order.paid'),
  data: z.object({
    id: z.number(),
    status: z.string(),
    payment_method: z.string().optional(),
    transaction_id: z.string().optional(),
    date_paid: z.string().optional(),
  }),
});
