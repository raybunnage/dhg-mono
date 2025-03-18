-- Add execute_sql RPC function to Supabase
-- Note: This function should be used carefully as it allows executing arbitrary SQL
-- Consider adding appropriate role-based security restrictions

CREATE OR REPLACE FUNCTION public.execute_sql(sql text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Uses the privileges of the function creator
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Execute the SQL and get the results as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing query: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
-- You might want to restrict this to specific roles
-- GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.execute_sql IS 'Executes arbitrary SQL and returns results as JSONB';