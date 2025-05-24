-- Function to set admin role in app_metadata
CREATE OR REPLACE FUNCTION set_user_admin_role(user_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_current_metadata JSONB;
  v_new_metadata JSONB;
BEGIN
  -- Get user ID
  SELECT id, raw_app_meta_data 
  INTO v_user_id, v_current_metadata
  FROM auth.users 
  WHERE email = LOWER(user_email);
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Merge admin role into existing metadata
  v_new_metadata := COALESCE(v_current_metadata, '{}'::jsonb) || '{"role": "admin"}'::jsonb;
  
  -- Update the user's app_metadata
  UPDATE auth.users 
  SET raw_app_meta_data = v_new_metadata
  WHERE id = v_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin role assigned',
    'user_id', v_user_id,
    'metadata', v_new_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION set_user_admin_role TO service_role;

-- Execute for your user
SELECT set_user_admin_role('bunnage.ray@gmail.com');