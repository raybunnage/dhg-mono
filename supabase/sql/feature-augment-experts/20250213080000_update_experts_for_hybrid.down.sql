BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_experts_google_user_id;
DROP INDEX IF EXISTS idx_experts_google_email;

-- Remove constraints
ALTER TABLE experts
  DROP CONSTRAINT IF EXISTS valid_google_email,
  DROP CONSTRAINT IF EXISTS valid_sync_status,
  DROP CONSTRAINT IF EXISTS valid_profile_data;

-- Remove columns
ALTER TABLE experts
  DROP COLUMN IF EXISTS google_user_id,
  DROP COLUMN IF EXISTS google_email,
  DROP COLUMN IF EXISTS google_profile_data,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS sync_status,
  DROP COLUMN IF EXISTS sync_error;

COMMIT; 