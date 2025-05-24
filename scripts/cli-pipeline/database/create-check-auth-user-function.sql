-- Function to check if an email exists in auth.users
CREATE OR REPLACE FUNCTION check_auth_user_exists(
  target_email TEXT
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  created_at TIMESTAMPTZ,
  user_exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::VARCHAR(255),
    au.created_at,
    true as user_exists
  FROM auth.users au
  WHERE au.email = target_email
  LIMIT 1;
  
  -- If no rows returned, return a row indicating user doesn't exist
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      NULL::UUID as user_id,
      target_email::VARCHAR(255) as email,
      NULL::TIMESTAMPTZ as created_at,
      false as user_exists;
  END IF;
END;
$$;