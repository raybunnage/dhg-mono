-- Function to set admin role for a user
CREATE OR REPLACE FUNCTION set_user_admin_role(
  target_email TEXT,
  is_admin BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', target_email;
  END IF;
  
  -- Update the user's app_metadata to set/unset admin role
  IF is_admin THEN
    UPDATE auth.users
    SET raw_app_meta_data = 
      CASE 
        WHEN raw_app_meta_data IS NULL THEN '{"role": "admin"}'::jsonb
        ELSE raw_app_meta_data || '{"role": "admin"}'::jsonb
      END
    WHERE id = target_user_id;
  ELSE
    UPDATE auth.users
    SET raw_app_meta_data = 
      CASE 
        WHEN raw_app_meta_data IS NULL THEN '{}'::jsonb
        ELSE raw_app_meta_data - 'role'
      END
    WHERE id = target_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;