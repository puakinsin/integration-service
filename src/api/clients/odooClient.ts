import axios from 'axios';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../shared/logger.js';

const logger = createChildLogger('odoo-client');

const odooClient = axios.create({
  baseURL: config.ODOO_URL,
  timeout: 30000,
});

let cachedUid: number | null = null;

async function login(): Promise<number> {
  if (cachedUid) return cachedUid;
  
  try {
    const response = await odooClient.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'login',
        args: [config.ODOO_DB, config.ODOO_USERNAME, config.ODOO_PASSWORD],
      },
      id: 1,
    });
    
    if (response.data.result) {
      cachedUid = response.data.result;
      logger.info({ uid: cachedUid }, 'Odoo login successful');
      return cachedUid!;
    }
    throw new Error('Odoo login failed');
  } catch (error) {
    logger.error({ error }, 'Odoo login error');
    throw error;
  }
}

export async function odooCall(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
): Promise<any> {
  const uid = await login();
  
  try {
    const response = await odooClient.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [config.ODOO_DB, uid, config.ODOO_PASSWORD, model, method, args, kwargs],
      },
      id: 2,
    });
    
    if (response.data.error) {
      logger.error({ error: response.data.error, model, method }, 'Odoo API error');
      throw new Error(response.data.error.message || 'Odoo API error');
    }
    
    return response.data.result;
  } catch (error: any) {
    // Track Odoo API errors for metrics
    logger.error({ error: error.message, model, method }, 'Odoo API call failed');
    throw error;
  }
}

// Specific methods
export async function createSaleOrder(partnerId: number, lines: any[], origin?: string) {
  const orderData = {
    partner_id: partnerId,
    origin: origin || '',
  };
  
  const orderId = await odooCall('sale.order', 'create', [orderData]);
  
  // Add order lines
  for (const line of lines) {
    await odooCall('sale.order.line', 'create', [{
      order_id: orderId,
      product_id: line.product_id,
      name: line.name,
      product_uom_qty: line.quantity,
      price_unit: line.price,
    }]);
  }
  
  return orderId;
}

export async function confirmSaleOrder(orderId: number) {
  return odooCall('sale.order', 'action_confirm', [[orderId]]);
}

export async function getPartnerByEmail(email: string) {
  const partnerIds = await odooCall('res.partner', 'search', [[['email', '=', email]]]);
  if (!partnerIds || partnerIds.length === 0) return null;
  
  const partners = await odooCall('res.partner', 'read', [partnerIds, ['name', 'email', 'phone', 'points', 'tier']]);
  return partners?.[0] || null;
}

export async function addPoints(partnerId: number, points: number, reason: string) {
  // This would call the Odoo module's method
  return odooCall('res.partner', 'write', [[partnerId], { points: points }]);
}
