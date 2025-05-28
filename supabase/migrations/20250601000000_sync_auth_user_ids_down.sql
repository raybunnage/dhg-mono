-- Down migration: Remove triggers and functions for auth_user_id sync

-- Drop triggers
DROP TRIGGER IF EXISTS sync_auth_user_id_on_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS sync_auth_user_id_on_allowed_email_trigger ON auth_allowed_emails;

-- Drop functions
DROP FUNCTION IF EXISTS sync_auth_user_id_on_signup();
DROP FUNCTION IF EXISTS sync_auth_user_id_on_allowed_email();

-- Remove comment
COMMENT ON COLUMN auth_allowed_emails.auth_user_id IS NULL;

-- Note: We don't clear the auth_user_id values as they may be useful data