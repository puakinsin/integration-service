import { z } from 'zod';

const configSchema = z.object({
  // Database
  DATABASE_URL: z.string().default('postgresql://odoo:odoo@postgres:5432/integration'),
  
  // Redis
  REDIS_URL: z.string().default('redis://redis:6379/0'),
  
  // Odoo
  ODOO_URL: z.string().default('http://odoo:7089'),
  ODOO_DB: z.string().default('odoo'),
  ODOO_USERNAME: z.string().default('admin@elitaco.my'),
  ODOO_PASSWORD: z.string().default('admin'),
  ODOO_API_KEY: z.string().optional(),
  
  // WooCommerce
  WOO_WEBHOOK_SECRET: z.string().default(''),
  WOO_STORE_URL: z.string().default(''),
  WOO_CONSUMER_KEY: z.string().default(''),
  WOO_CONSUMER_SECRET: z.string().default(''),
  
  // App
  APP_SECRET: z.string().default('change-me-in-production'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Auth
  INTERNAL_API_KEY: z.string().default('internal-secret-key'),
});

export const config = configSchema.parse(process.env);

export type Config = z.infer<typeof configSchema>;
