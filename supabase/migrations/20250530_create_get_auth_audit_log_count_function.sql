-- Create a function to get the count of auth_audit_log records
-- This function uses SECURITY DEFINER to bypass RLS policies
CREATE OR REPLACE FUNCTION get_auth_audit_log_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_count bigint;
BEGIN
  -- Get the count of records in auth_audit_log
  SELECT COUNT(*) INTO record_count FROM auth_audit_log;
  
  RETURN record_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_auth_audit_log_count() TO authenticated;

-- Add a comment to document the function
COMMENT ON FUNCTION get_auth_audit_log_count() IS 'Returns the total count of records in auth_audit_log table, bypassing RLS policies for admin dashboards';