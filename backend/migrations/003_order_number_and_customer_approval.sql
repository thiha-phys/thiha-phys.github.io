BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_approval_status_check;
ALTER TABLE users ADD CONSTRAINT users_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_no bigint;
CREATE SEQUENCE IF NOT EXISTS orders_order_no_seq;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS number
  FROM orders
)
UPDATE orders AS o SET order_no = numbered.number
FROM numbered WHERE o.id = numbered.id AND o.order_no IS NULL;

-- Move old values aside before replacing them, since voucher_no has a unique constraint.
UPDATE orders SET voucher_no = 'LEGACY-' || id::text WHERE order_no IS NOT NULL;
UPDATE orders SET voucher_no = lpad(order_no::text, 3, '0') WHERE order_no IS NOT NULL;

SELECT setval('orders_order_no_seq', GREATEST(COALESCE((SELECT max(order_no) FROM orders), 0), 1),
              COALESCE((SELECT max(order_no) FROM orders), 0) > 0);
ALTER TABLE orders ALTER COLUMN order_no SET DEFAULT nextval('orders_order_no_seq');
ALTER TABLE orders ALTER COLUMN order_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_no_unique ON orders(order_no);

COMMIT;
