-- Migration: Fix auth_audit_log for light auth
-- Description: Remove foreign key constraint on user_id to allow light auth to use allowed_emails.id

-- Step 1: Drop the foreign key constraint
ALTER TABLE auth_audit_log 
DROP CONSTRAINT IF EXISTS auth_audit_log_user_id_fkey;

-- Step 2: Add a comment explaining the change
COMMENT ON COLUMN auth_audit_log.user_id IS 'User ID - can be from auth.users OR allowed_emails depending on auth method';

-- Step 3: Create an index on user_id if it doesn't exist (for performance)
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);

-- Step 4: Update the table comment
COMMENT ON TABLE auth_audit_log IS 'Audit log for authentication events. Supports both regular auth (auth.users) and light auth (allowed_emails) user IDs.';