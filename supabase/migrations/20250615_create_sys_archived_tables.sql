-- Create sys_archived_tables to store archived table schemas
CREATE TABLE IF NOT EXISTS public.sys_archived_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  table_schema TEXT NOT NULL DEFAULT 'public',
  create_statement TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  foreign_keys JSONB DEFAULT '[]'::jsonb,
  indexes JSONB DEFAULT '[]'::jsonb,
  triggers JSONB DEFAULT '[]'::jsonb,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  archived_by TEXT NOT NULL DEFAULT 'system',
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_sys_archived_tables_table_name ON sys_archived_tables(table_name);
CREATE INDEX idx_sys_archived_tables_archived_at ON sys_archived_tables(archived_at);

-- Add RLS policies
ALTER TABLE sys_archived_tables ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON sys_archived_tables
  FOR SELECT TO authenticated
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role all access" ON sys_archived_tables
  FOR ALL TO service_role
  USING (true);

-- Create helper functions
CREATE OR REPLACE FUNCTION get_table_ddl(table_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ddl TEXT;
BEGIN
  -- Get CREATE TABLE statement
  SELECT 
    'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || chr(10) ||
    string_agg(
      '  ' || column_name || ' ' || data_type || 
      CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        ELSE ''
      END ||
      CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
      CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
      ',' || chr(10)
    ) || chr(10) || ');'
  INTO ddl
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = $1
  GROUP BY schemaname, tablename;
  
  RETURN ddl;
END;
$$;

CREATE OR REPLACE FUNCTION get_table_foreign_keys(table_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fks JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'constraint_name', conname,
        'definition', pg_get_constraintdef(oid),
        'foreign_table', confrelid::regclass::text
      )
    ),
    '[]'::jsonb
  )
  INTO fks
  FROM pg_constraint
  WHERE conrelid = (quote_ident('public') || '.' || quote_ident(table_name))::regclass
    AND contype = 'f';
  
  RETURN fks;
END;
$$;

CREATE OR REPLACE FUNCTION get_table_indexes(table_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  idxs JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'index_name', indexname,
        'definition', indexdef
      )
    ),
    '[]'::jsonb
  )
  INTO idxs
  FROM pg_indexes
  WHERE schemaname = 'public' 
    AND tablename = table_name
    AND indexname NOT LIKE '%_pkey';
  
  RETURN idxs;
END;
$$;

-- Create execute_ddl function for restoring tables
CREATE OR REPLACE FUNCTION execute_ddl(ddl_statement TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE ddl_statement;
END;
$$;

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_archived_tables', 'Archive of dropped tables with full schema information', 'Stores complete DDL and metadata for tables that have been archived/dropped from the database', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;