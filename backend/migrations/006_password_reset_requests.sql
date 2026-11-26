BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired', 'cancelled')),
  token_hash text,
  token_expires_at timestamptz,
  failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_one_active_per_user
  ON password_reset_requests (user_id)
  WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS password_reset_requests_queue_idx
  ON password_reset_requests (requested_at DESC)
  WHERE status IN ('pending', 'approved');

COMMIT;
