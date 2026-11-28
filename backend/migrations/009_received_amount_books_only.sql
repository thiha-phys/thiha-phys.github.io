BEGIN;

WITH legacy_received AS (
  SELECT
    id,
    subtotal,
    delivery_fee,
    CASE
      WHEN replace(COALESCE(NULLIF(admin_data->>'Received', ''), admin_data->>'Amount Received', ''), ',', '') ~ '^[0-9]+$'
      THEN replace(COALESCE(NULLIF(admin_data->>'Received', ''), admin_data->>'Amount Received', ''), ',', '')::numeric
    END AS received_amount
  FROM orders
)
UPDATE orders AS order_row
SET admin_data = jsonb_set(
  COALESCE(order_row.admin_data, '{}'::jsonb),
  '{Received}',
  to_jsonb(order_row.subtotal::text),
  true
)
FROM legacy_received
WHERE order_row.id = legacy_received.id
  AND legacy_received.delivery_fee > 0
  AND legacy_received.received_amount = legacy_received.subtotal + legacy_received.delivery_fee;

COMMIT;
