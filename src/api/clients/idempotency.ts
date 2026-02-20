import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../shared/logger.js';

const logger = createChildLogger('idempotency');

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

const IDEMPOTENCY_TTL = 7 * 24 * 60 * 60; // 7 days

export async function checkAndSetIdempotencyKey(
  idempotencyKey: string
): Promise<{ isNew: boolean; existingStatus?: string }> {
  const key = `idempotency:${idempotencyKey}`;
  
  const existing = await redis.get(key);
  
  if (existing) {
    logger.debug({ idempotencyKey, status: existing }, 'Idempotency hit');
    return { isNew: false, existingStatus: existing };
  }
  
  // Set with TTL, use NX for atomicity
  const result = await redis.set(key, 'processing', 'EX', IDEMPOTENCY_TTL, 'NX');
  
  if (result === 'OK') {
    return { isNew: true };
  }
  
  // Race condition - another request got it first
  const retry = await redis.get(key);
  return { isNew: false, existingStatus: retry || undefined };
}

export async function setIdempotencyStatus(
  idempotencyKey: string,
  status: 'succeeded' | 'failed'
): Promise<void> {
  const key = `idempotency:${idempotencyKey}`;
  await redis.set(key, status, 'EX', IDEMPOTENCY_TTL);
  
  // Also increment metrics
  await redis.incr(`metrics:idempotency_hits_total:${status}`);
}

export async function getIdempotencyStatus(
  idempotencyKey: string
): Promise<string | null> {
  const key = `idempotency:${idempotencyKey}`;
  return redis.get(key);
}
