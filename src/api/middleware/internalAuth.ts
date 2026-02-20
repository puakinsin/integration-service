import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';

export async function verifyInternalApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers['x-internal-api-key'];
  
  if (!apiKey || apiKey !== config.INTERNAL_API_KEY) {
    reply.code(401).send({ error: 'Invalid or missing internal API key' });
    return;
  }
}
