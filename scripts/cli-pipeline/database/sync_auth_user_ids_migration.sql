-- Migration to sync auth_user_id in auth_allowed_emails table and create trigger for future syncs

-- First, update existing records where auth_user_id is null
UPDATE auth_allowed_emails ae
SET 
  auth_user_id = au.id,
  updated_at = NOW()
FROM auth.users au
WHERE 
  ae.auth_user_id IS NULL
  AND LOWER(ae.email) = LOWER(au.email);

-- Create a function to automatically sync auth_user_id when a new user is created
CREATE OR REPLACE FUNCTION sync_auth_user_id_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth_allowed_emails with the new user's ID if their email is in the allowed list
  UPDATE auth_allowed_emails
  SET 
    auth_user_id = NEW.id,
    updated_at = NOW(),
    last_login_at = NOW(),
    login_count = COALESCE(login_count, 0) + 1
  WHERE 
    LOWER(email) = LOWER(NEW.email)
    AND auth_user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users insert
DROP TRIGGER IF EXISTS sync_auth_user_id_on_signup_trigger ON auth.users;
CREATE TRIGGER sync_auth_user_id_on_signup_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_id_on_signup();

-- Create a function to sync auth_user_id when an allowed email is added
CREATE OR REPLACE FUNCTION sync_auth_user_id_on_allowed_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's already an auth.users record for this email
  IF NEW.auth_user_id IS NULL THEN
    UPDATE auth_allowed_emails
    SET auth_user_id = (
      SELECT id 
      FROM auth.users 
      WHERE LOWER(email) = LOWER(NEW.email)
      LIMIT 1
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth_allowed_emails insert/update
DROP TRIGGER IF EXISTS sync_auth_user_id_on_allowed_email_trigger ON auth_allowed_emails;
CREATE TRIGGER sync_auth_user_id_on_allowed_email_trigger
  AFTER INSERT OR UPDATE OF email ON auth_allowed_emails
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_id_on_allowed_email();

-- Add comment explaining the relationship
COMMENT ON COLUMN auth_allowed_emails.auth_user_id IS 'Foreign key to auth.users.id - automatically synced via triggers when email matches';