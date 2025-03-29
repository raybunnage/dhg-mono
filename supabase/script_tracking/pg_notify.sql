-- Create a function to enable PostgreSQL notifications from the API
-- This is used to reload the schema cache
CREATE OR REPLACE FUNCTION pg_notify(channel text, payload text)
RETURNS void AS $$
BEGIN
  PERFORM pg_notify(channel, payload);
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to public
GRANT EXECUTE ON FUNCTION pg_notify(text, text) TO PUBLIC;

-- Add comment
COMMENT ON FUNCTION pg_notify(text, text) IS 'Wrapper around PostgreSQL pg_notify function to allow schema reloading through the API';