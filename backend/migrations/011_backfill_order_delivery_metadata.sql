BEGIN;

WITH settings AS (
  SELECT COALESCE(
    (
      SELECT NULLIF(value #>> '{}', '')::numeric
      FROM app_settings
      WHERE key = 'royalServiceFee'
      LIMIT 1
    ),
    300
  ) AS royal_service_fee
),
derived AS (
  SELECT
    o.id,
    o.delivery_service,
    o.total_weight_kg,
    o.delivery_fee,
    o.admin_data,
    COALESCE(
      NULLIF(BTRIM(o.car_details), ''),
      CASE
        WHEN o.delivery_service = 'Car' THEN NULLIF(BTRIM(o.admin_data->>'Delivery Notes'), '')
      END
    ) AS car_info,
    CASE
      WHEN o.delivery_service = 'Car' THEN 0
      ELSE GREATEST(1, CEIL(o.total_weight_kg / 5)) * settings.royal_service_fee
    END AS shipment_service_charge
  FROM orders o
  CROSS JOIN settings
)
UPDATE orders o
SET admin_data = COALESCE(o.admin_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
  'car inform', CASE
    WHEN BTRIM(COALESCE(derived.admin_data->>'car inform', '')) = '' THEN derived.car_info
  END,
  'Royal Shipment Service Charge', CASE
    WHEN BTRIM(COALESCE(derived.admin_data->>'Royal Shipment Service Charge', '')) = ''
      THEN derived.shipment_service_charge::text
  END,
  'Royal Shipment COD Amount', CASE
    WHEN BTRIM(COALESCE(derived.admin_data->>'Royal Shipment COD Amount', '')) = ''
      THEN GREATEST(0, derived.delivery_fee - derived.shipment_service_charge)::text
  END
))
FROM derived
WHERE o.id = derived.id
  AND (
    (BTRIM(COALESCE(derived.admin_data->>'car inform', '')) = '' AND derived.car_info IS NOT NULL)
    OR BTRIM(COALESCE(derived.admin_data->>'Royal Shipment Service Charge', '')) = ''
    OR BTRIM(COALESCE(derived.admin_data->>'Royal Shipment COD Amount', '')) = ''
  );

COMMIT;
