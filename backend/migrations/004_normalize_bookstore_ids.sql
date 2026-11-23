-- Restore the original numeric ID for the KMK bookstore without overwriting
-- an existing row if an ID 3 has already been added manually.
UPDATE bookstores
SET id = '3'
WHERE id = 'kmk-3'
  AND NOT EXISTS (SELECT 1 FROM bookstores WHERE id = '3');
