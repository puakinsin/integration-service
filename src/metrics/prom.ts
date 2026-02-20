import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// 1) Events received total
export const eventsReceivedTotal = new Counter({
  name: 'integration_events_received_total',
  help: 'Total number of events received',
  labelNames: ['source', 'event_type'],
  registers: [register],
});

// 2) Events processed total
export const eventsProcessedTotal = new Counter({
  name: 'integration_events_processed_total',
  help: 'Total number of events processed',
  labelNames: ['status', 'event_type'],
  registers: [register],
});

// 3) Event processing duration (histogram with p95/p99)
export const eventProcessingDuration = new Histogram({
  name: 'integration_event_processing_duration_ms',
  help: 'Event processing duration in milliseconds',
  labelNames: ['event_type'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

// 4) Queue depth
export const queueDepth = new Gauge({
  name: 'integration_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue'],
  registers: [register],
});

// 5) Oldest job age
export const oldestJobAge = new Gauge({
  name: 'integration_queue_oldest_job_age_seconds',
  help: 'Age of the oldest job in the queue',
  labelNames: ['queue'],
  registers: [register],
});

// 6) Idempotency hits
export const idempotencyHitsTotal = new Counter({
  name: 'integration_idempotency_hits_total',
  help: 'Total number of idempotency key hits',
  labelNames: ['event_type'],
  registers: [register],
});

// 7) Retries total
export const retriesTotal = new Counter({
  name: 'integration_retries_total',
  help: 'Total number of event retries',
  labelNames: ['event_type'],
  registers: [register],
});

// 8) DLQ total
export const dlqTotal = new Counter({
  name: 'integration_dlq_total',
  help: 'Total number of events sent to DLQ',
  labelNames: ['event_type', 'reason'],
  registers: [register],
});

// 9) Odoo API errors
export const odooApiErrorsTotal = new Counter({
  name: 'integration_odoo_api_errors_total',
  help: 'Total number of Odoo API errors',
  labelNames: ['endpoint', 'code'],
  registers: [register],
});

// Helper to update queue metrics
export async function updateQueueMetrics(queueName: string, jobCounts: any) {
  queueDepth.set({ queue: queueName }, jobCounts.active || 0);
  
  if (jobCounts.oldestJob?.timestamp) {
    const ageSeconds = (Date.now() - jobCounts.oldestJob.timestamp) / 1000;
    oldestJobAge.set({ queue: queueName }, ageSeconds);
  }
}

// Metrics endpoint handler
export async function metricsHandler() {
  return register.metrics();
}
