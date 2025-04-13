-- Create a function to execute arbitrary SQL
-- This is a privileged function to allow applying SQL scripts
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION execute_sql(text) IS 'Execute raw SQL (admin only)';