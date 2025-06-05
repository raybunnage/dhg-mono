-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');
