import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Event Log Table
  await knex.schema.createTable('event_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_type').notNullable();
    table.string('source').notNullable();
    table.string('idempotency_key').notNullable().unique();
    table.string('trace_id').nullable();
    table.jsonb('payload').notNullable();
    table.enum('status', ['received', 'queued', 'processing', 'succeeded', 'failed', 'dlq']).notNullable();
    table.timestamp('received_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('queued_at', { useTz: true }).nullable();
    table.timestamp('processing_at', { useTz: true }).nullable();
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.timestamp('failed_at', { useTz: true }).nullable();
    table.bigInteger('latency_ms').nullable();
    table.text('error_message').nullable();
    table.text('error_stack').nullable();
    table.jsonb('metadata').nullable();
    table.index(['event_type', 'status']);
    table.index(['received_at']);
    table.index(['trace_id']);
  });

  // Order Map Table
  await knex.schema.createTable('order_map', (table) => {
    table.increments('id').primary();
    table.integer('woo_order_id').notNullable().unique();
    table.integer('odoo_sale_order_id').nullable();
    table.string('woo_status').nullable();
    table.string('odoo_status').nullable();
    table.timestamp('last_sync_at', { useTz: true }).nullable();
    table.timestamps(true, true);
    table.index(['woo_order_id']);
    table.index(['odoo_sale_order_id']);
  });

  // Dead Letter Queue Table
  await knex.schema.createTable('dlq', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_type').notNullable();
    table.string('idempotency_key').notNullable();
    table.jsonb('original_payload').notNullable(); // Will be sanitized
    table.text('last_error').nullable();
    table.text('last_error_stack').nullable();
    table.integer('retry_count').defaultTo(0);
    table.string('reason').nullable();
    table.timestamp('failed_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index(['event_type']);
    table.index(['failed_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dlq');
  await knex.schema.dropTableIfExists('order_map');
  await knex.schema.dropTableIfExists('event_log');
}
