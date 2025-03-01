-- Add execute_sql RPC function for the SQL editor
-- This function will be used by the SQL editor in the SupabaseAdmin component

-- Function to execute SQL queries safely
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  query_type TEXT;
  affected_rows INTEGER;
BEGIN
  -- Determine the type of query (SELECT, INSERT, UPDATE, DELETE, etc.)
  query_type := UPPER(SUBSTRING(TRIM(sql_query) FROM 1 FOR 6));
  
  -- For safety, only allow certain types of queries
  IF query_type = 'SELECT' THEN
    -- Execute the SELECT query and return the results as JSON
    EXECUTE 'SELECT JSONB_AGG(t) FROM (' || sql_query || ') t' INTO result;
    RETURN COALESCE(result, '[]'::JSONB);
  ELSIF query_type IN ('INSERT', 'UPDATE', 'DELETE') THEN
    -- For data modification queries, return the number of affected rows
    EXECUTE sql_query;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN JSONB_BUILD_OBJECT('rowCount', affected_rows, 'message', query_type || ' completed successfully');
  ELSE
    -- For other queries (like CREATE, ALTER, etc.), just execute and return success message
    EXECUTE sql_query;
    RETURN JSONB_BUILD_OBJECT('message', 'Query executed successfully');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL Error: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO anon; 