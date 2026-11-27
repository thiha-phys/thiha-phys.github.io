BEGIN;

-- Keep delivery completion separate from the numeric admin_data.Received payment amount.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS complete boolean NOT NULL DEFAULT false;

-- Preserve previously customer-confirmed orders while replacing the old "received" state.
UPDATE orders
SET complete = true,
    status = 'complete'
WHERE status IN ('received', 'complete')
   OR lower(COALESCE(admin_data->>'Received', '')) = 'yes';

UPDATE orders SET status = 'complete' WHERE complete = true;

-- Normalize legacy order states to the three delivery states used by the apps.
UPDATE orders SET status = 'delivered' WHERE status = 'on_the_way' AND complete = false;
UPDATE orders SET status = 'pending' WHERE status IN ('new', '') AND complete = false;

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;
