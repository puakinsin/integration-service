# Events Documentation

## Event Types

### WooCommerce Events

| Event | Description | Idempotency Key |
|-------|-------------|-----------------|
| `woo.order.created` | Order created in Woo | `woo:{order_id}:order.created:{timestamp}` |
| `woo.order.paid` | Order payment completed | `woo:{order_id}:order.paid:{timestamp}` |
| `woo.order.cancelled` | Order cancelled | `woo:{order_id}:order.cancelled:{timestamp}` |
| `woo.order.refunded` | Order refunded | `woo:{order_id}:order.refunded:{timestamp}` |

### Odoo Events

| Event | Description | Idempotency Key |
|-------|-------------|-----------------|
| `odoo.sale.confirmed` | Sale order confirmed | `odoo:sale.order:{id}:confirm:{write_date}` |
| `odoo.fulfillment.shipped` | Picking shipped | `odoo:stock.picking:{id}:shipped:{write_date}` |
| `odoo.invoice.posted` | Invoice posted | `odoo:account.move:{id}:posted:{write_date}` |
| `odoo.refund.done` | Refund completed | `odoo:account.move:{id}:refund:{write_date}` |

## Event Envelope

All events follow this envelope format:

```json
{
  "event_id": "uuid-v4",
  "event_type": "woo.order.created",
  "source": "woo",
  "occurred_at": "2026-02-20T10:00:00Z",
  "idempotency_key": "woo:123:order.created:456",
  "trace_id": "uuid-v4",
  "data": {
    // event-specific payload
  }
}
```

## Status Mapping

### Woo → Odoo

| Woo Status | Odoo Status |
|------------|-------------|
| pending | quotation |
| processing | sale (confirmed) |
| completed | done |
| cancelled | cancel |
| refunded | refund done |
| on-hold | sent |

### Odoo → Woo (Optional Writeback)

| Odoo Status | Woo Status |
|-------------|------------|
| sale | processing |
| done | completed |
| cancel | cancelled |

## Payload Examples

### woo.order.created

```json
{
  "id": 123,
  "status": "pending",
  "currency": "MYR",
  "total": 150.00,
  "billing": {
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "address_1": "123 Main St",
    "city": "Kuala Lumpur",
    "postcode": "50000",
    "country": "MY"
  },
  "line_items": [
    {
      "id": 1,
      "product_id": 456,
      "name": "Product Name",
      "quantity": 2,
      "price": 75.00
    }
  ]
}
```

### woo.order.paid

```json
{
  "id": 123,
  "status": "processing",
  "payment_method": "bacs",
  "transaction_id": "txn_xxx",
  "date_paid": "2026-02-20T10:00:00Z"
}
```

### odoo.sale.confirmed

```json
{
  "model": "sale.order",
  "record_id": 789,
  "event_type": "sale.confirmed",
  "name": "SO0123",
  "partner_id": 456,
  "state": "sale",
  "write_date": "2026-02-20T10:00:00Z"
}
```
