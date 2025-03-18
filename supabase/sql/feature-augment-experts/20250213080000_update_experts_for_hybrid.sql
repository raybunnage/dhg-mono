 BEGIN;

-- Add new columns to experts table
ALTER TABLE experts
  ADD COLUMN IF NOT EXISTS google_user_id text,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS google_profile_data jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS sync_error text;

-- Add constraints
ALTER TABLE experts
  ADD CONSTRAINT valid_google_email 
    CHECK (google_email IS NULL OR google_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  ADD CONSTRAINT valid_sync_status 
    CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
  ADD CONSTRAINT valid_profile_data
    CHECK (google_profile_data IS NULL OR jsonb_typeof(google_profile_data) = 'object');

-- Create index for google lookups
CREATE INDEX IF NOT EXISTS idx_experts_google_user_id ON experts(google_user_id);
CREATE INDEX IF NOT EXISTS idx_experts_google_email ON experts(google_email);

COMMIT;