-- Function to retrieve complete table information
CREATE OR REPLACE FUNCTION public.get_table_metadata(target_table text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get basic table information
  WITH table_info AS (
    SELECT 
      c.relname AS table_name,
      obj_description(c.oid) AS table_description,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS table_size,
      pg_total_relation_size(c.oid) AS table_size_bytes,
      (SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = c.relname) > 0 AS is_user_table,
      to_char(GREATEST(
        (SELECT max(last_vacuum) FROM pg_stat_user_tables WHERE relname = c.relname),
        (SELECT max(last_autovacuum) FROM pg_stat_user_tables WHERE relname = c.relname)
      ), 'YYYY-MM-DD HH24:MI:SS') AS last_vacuum,
      to_char(GREATEST(
        (SELECT max(last_analyze) FROM pg_stat_user_tables WHERE relname = c.relname),
        (SELECT max(last_autoanalyze) FROM pg_stat_user_tables WHERE relname = c.relname)
      ), 'YYYY-MM-DD HH24:MI:SS') AS last_analyze,
      (SELECT count(*) FROM pg_stat_user_tables WHERE relname = c.relname) AS row_count
    FROM pg_class c
    WHERE c.relname = target_table AND c.relkind = 'r'
  ),
  
  -- Get columns information
  columns AS (
    SELECT 
      a.attname AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
      CASE 
        WHEN a.attnotnull THEN true
        ELSE false
      END AS is_not_null,
      CASE 
        WHEN (SELECT COUNT(*) FROM pg_constraint
              WHERE conrelid = a.attrelid
              AND conkey[1] = a.attnum
              AND contype = 'p') > 0 THEN true
        ELSE false
      END AS is_primary_key,
      CASE 
        WHEN a.atthasdef THEN pg_get_expr(d.adbin, d.adrelid)
        ELSE NULL
      END AS default_value,
      col_description(a.attrelid, a.attnum) AS column_description,
      a.attnum AS ordinal_position
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE a.attrelid = target_table::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    ORDER BY a.attnum
  ),
  
  -- Get constraint information
  constraints AS (
    SELECT
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      CASE
        WHEN con.contype = 'p' THEN 'PRIMARY KEY'
        WHEN con.contype = 'u' THEN 'UNIQUE'
        WHEN con.contype = 'f' THEN 'FOREIGN KEY'
        WHEN con.contype = 'c' THEN 'CHECK'
        ELSE con.contype::text
      END AS constraint_type_desc,
      pg_get_constraintdef(con.oid) AS constraint_definition,
      con.conkey AS constraint_columns,
      con.confrelid::regclass::text AS referenced_table,
      con.confkey AS referenced_columns
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = target_table
  ),
  
  -- Get index information
  indexes AS (
    SELECT
      i.relname AS index_name,
      am.amname AS index_type,
      pg_get_indexdef(i.oid) AS index_definition,
      idx.indisunique AS is_unique,
      idx.indisprimary AS is_primary,
      idx.indisexclusion AS is_exclusion,
      idx.indimmediate AS is_immediate,
      idx.indisclustered AS is_clustered,
      idx.indisvalid AS is_valid,
      array_to_string(
        array(
          SELECT pg_get_indexdef(i.oid, k+1, true)
          FROM generate_subscripts(idx.indkey, 0) as k
          ORDER BY k
        ), ', '
      ) AS index_columns
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class c ON c.oid = idx.indrelid
    JOIN pg_am am ON am.oid = i.relam
    WHERE c.relname = target_table
    ORDER BY i.relname
  ),
  
  -- Get trigger information
  triggers AS (
    SELECT
      trg.tgname AS trigger_name,
      pg_get_triggerdef(trg.oid) AS trigger_definition,
      CASE
        WHEN trg.tgenabled = 'O' THEN 'ENABLED'
        WHEN trg.tgenabled = 'D' THEN 'DISABLED'
        WHEN trg.tgenabled = 'R' THEN 'REPLICA'
        WHEN trg.tgenabled = 'A' THEN 'ALWAYS'
        ELSE trg.tgenabled::text
      END AS trigger_status
    FROM pg_trigger trg
    JOIN pg_class tbl ON tbl.oid = trg.tgrelid
    WHERE tbl.relname = target_table
    AND NOT trg.tgisinternal
  ),
  
  -- Get foreign key information
  foreign_keys AS (
    SELECT
      con.conname AS fk_name,
      con.conrelid::regclass::text AS source_table,
      att.attname AS source_column,
      con.confrelid::regclass::text AS target_table,
      att2.attname AS target_column,
      CASE con.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE NULL
      END AS on_update,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE NULL
      END AS on_delete
    FROM pg_constraint con
    JOIN pg_class tbl ON tbl.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_attribute att2 ON att2.attrelid = con.confrelid AND att2.attnum = con.confkey[1]
    WHERE con.contype = 'f'
    AND tbl.relname = target_table
  ),
  
  -- Get RLS policies
  rls_policies AS (
    SELECT
      pol.polname AS policy_name,
      pol.polcmd AS command,
      CASE pol.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE pol.polcmd::text
      END AS command_desc,
      pol.polpermissive AS is_permissive,
      pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression,
      array_to_string(ARRAY(
        SELECT rolname
        FROM pg_roles
        WHERE oid = ANY(pol.polroles)
      ), ', ') AS roles
    FROM pg_policy pol
    JOIN pg_class tbl ON tbl.oid = pol.polrelid
    WHERE tbl.relname = target_table
  )

  -- Construct the result JSON
  SELECT jsonb_build_object(
    'table_name', (SELECT table_name FROM table_info),
    'description', (SELECT table_description FROM table_info),
    'size', (SELECT table_size FROM table_info),
    'size_bytes', (SELECT table_size_bytes FROM table_info),
    'is_user_table', (SELECT is_user_table FROM table_info),
    'last_vacuum', (SELECT last_vacuum FROM table_info),
    'last_analyze', (SELECT last_analyze FROM table_info),
    'approximate_row_count', (SELECT row_count FROM table_info),
    'columns', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', column_name,
          'type', data_type,
          'not_null', is_not_null,
          'is_primary_key', is_primary_key,
          'default', default_value,
          'description', column_description,
          'position', ordinal_position
        )
      )
      FROM columns
    ),
    'constraints', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', constraint_name,
          'type', constraint_type,
          'type_desc', constraint_type_desc,
          'definition', constraint_definition,
          'columns', constraint_columns,
          'referenced_table', referenced_table,
          'referenced_columns', referenced_columns
        )
      )
      FROM constraints
    ),
    'indexes', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', index_name,
          'type', index_type,
          'definition', index_definition,
          'is_unique', is_unique,
          'is_primary', is_primary,
          'columns', index_columns
        )
      )
      FROM indexes
    ),
    'triggers', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', trigger_name,
          'definition', trigger_definition,
          'status', trigger_status
        )
      )
      FROM triggers
    ),
    'foreign_keys', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', fk_name,
          'source_table', source_table,
          'source_column', source_column,
          'target_table', target_table,
          'target_column', target_column,
          'on_update', on_update,
          'on_delete', on_delete
        )
      )
      FROM foreign_keys
    ),
    'rls_policies', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', policy_name,
          'command', command,
          'command_desc', command_desc,
          'is_permissive', is_permissive,
          'using_expression', using_expression,
          'with_check_expression', with_check_expression,
          'roles', roles
        )
      )
      FROM rls_policies
    ),
    'metadata_generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_table_metadata(text) TO authenticated;

-- Add row level security exemption for the function
ALTER FUNCTION public.get_table_metadata(text) SECURITY DEFINER;

COMMENT ON FUNCTION public.get_table_metadata(text) IS 'Returns detailed metadata about the specified database table, including columns, constraints, indexes, triggers, and RLS policies.'; 