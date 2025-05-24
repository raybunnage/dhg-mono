-- Function to allow admins to reset user passwords directly
CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_email TEXT,
  new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Check if the calling user is an admin
  IF NOT (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset user passwords';
  END IF;
  
  -- Get the user ID from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', target_email;
  END IF;
  
  -- Update the user's password
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$;