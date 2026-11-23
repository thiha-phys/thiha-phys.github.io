-- Allow customers without email to register and log in by phone.
-- Convert Myanmar numerals and remove formatting before enforcing uniqueness.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT translate(regexp_replace(phone, '[^0-9၀-၉]', '', 'g'), '၀၁၂၃၄၅၆၇၈၉', '0123456789') AS normalized
      FROM users
      WHERE phone IS NOT NULL AND phone <> ''
    ) phones
    GROUP BY normalized
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enable phone login: duplicate phone numbers exist. Review users.phone first.';
  END IF;
END $$;

UPDATE users
SET phone = translate(regexp_replace(phone, '[^0-9၀-၉]', '', 'g'), '၀၁၂၃၄၅၆၇၈၉', '0123456789')
WHERE phone IS NOT NULL;

UPDATE users SET email = NULLIF(lower(trim(email)), '') WHERE email IS NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone <> '';
