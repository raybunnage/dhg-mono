-- Add support for views in sys_table_definitions

-- Add new columns to sys_table_definitions to support views
ALTER TABLE sys_table_definitions
ADD COLUMN IF NOT EXISTS object_type TEXT DEFAULT 'table' CHECK (object_type IN ('table', 'view', 'materialized_view')),
ADD COLUMN IF NOT EXISTS is_updatable BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_insertable BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS view_definition TEXT,
ADD COLUMN IF NOT EXISTS depends_on TEXT[]; -- Array of table/view names this view depends on

-- Update existing records to explicitly set object_type
UPDATE sys_table_definitions SET object_type = 'table' WHERE object_type IS NULL;

-- Create a function to populate views in sys_table_definitions
CREATE OR REPLACE FUNCTION populate_view_definitions() RETURNS void AS $$
DECLARE
  v_record RECORD;
  v_depends_on TEXT[];
BEGIN
  -- Get all views and their dependencies
  FOR v_record IN 
    SELECT 
      v.schemaname,
      v.viewname,
      v.definition,
      COALESCE(
        ARRAY(
          SELECT DISTINCT dependent_table 
          FROM (
            SELECT 
              CASE 
                WHEN dep_table.relname IS NOT NULL THEN dep_table.relname
                ELSE NULL
              END as dependent_table
            FROM pg_depend d
            JOIN pg_rewrite r ON r.oid = d.objid
            JOIN pg_class view_class ON view_class.oid = r.ev_class
            JOIN pg_namespace ns ON ns.oid = view_class.relnamespace
            LEFT JOIN pg_class dep_table ON dep_table.oid = d.refobjid AND dep_table.relkind IN ('r', 'v', 'm')
            WHERE view_class.relname = v.viewname
              AND ns.nspname = v.schemaname
              AND d.deptype = 'n'
          ) deps
          WHERE dependent_table IS NOT NULL
        ),
        ARRAY[]::TEXT[]
      ) as dependencies,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM information_schema.views iv 
          WHERE iv.table_schema = v.schemaname 
          AND iv.table_name = v.viewname 
          AND iv.is_updatable = 'YES'
        ) THEN true 
        ELSE false 
      END as is_updatable,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM information_schema.views iv 
          WHERE iv.table_schema = v.schemaname 
          AND iv.table_name = v.viewname 
          AND iv.is_insertable_into = 'YES'
        ) THEN true 
        ELSE false 
      END as is_insertable
    FROM pg_views v
    WHERE v.schemaname = 'public'
  LOOP
    -- Check if view already exists in sys_table_definitions
    IF NOT EXISTS (
      SELECT 1 FROM sys_table_definitions 
      WHERE table_schema = v_record.schemaname 
      AND table_name = v_record.viewname
    ) THEN
      -- Insert new view definition
      INSERT INTO sys_table_definitions (
        table_schema,
        table_name,
        object_type,
        description,
        purpose,
        created_date,
        is_updatable,
        is_insertable,
        view_definition,
        depends_on
      ) VALUES (
        v_record.schemaname,
        v_record.viewname,
        'view',
        CASE 
          WHEN v_record.viewname LIKE 'sys_%' THEN 'System view for ' || REPLACE(v_record.viewname, '_', ' ')
          WHEN v_record.viewname LIKE '%_view' THEN REPLACE(v_record.viewname, '_', ' ')
          ELSE v_record.viewname || ' view'
        END,
        'Provide structured view of data',
        CURRENT_DATE,
        v_record.is_updatable,
        v_record.is_insertable,
        v_record.definition,
        v_record.dependencies
      );
    ELSE
      -- Update existing record
      UPDATE sys_table_definitions
      SET 
        object_type = 'view',
        is_updatable = v_record.is_updatable,
        is_insertable = v_record.is_insertable,
        view_definition = v_record.definition,
        depends_on = v_record.dependencies
      WHERE table_schema = v_record.schemaname 
      AND table_name = v_record.viewname;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to populate existing views
SELECT populate_view_definitions();

-- Create an enhanced view for the database page that includes both tables and views
CREATE OR REPLACE VIEW sys_database_objects_info AS
SELECT 
  td.table_schema,
  td.table_name,
  td.object_type,
  td.description,
  td.purpose,
  td.created_date,
  td.created_by,
  td.notes,
  td.is_updatable,
  td.is_insertable,
  td.depends_on,
  CASE 
    WHEN td.object_type = 'table' THEN
      (SELECT COUNT(*) FROM information_schema.tables t 
       WHERE t.table_schema = td.table_schema 
       AND t.table_name = td.table_name)
    ELSE 0
  END as exists_in_db,
  CASE 
    WHEN td.object_type = 'table' THEN
      COALESCE((
        SELECT (xpath('/row/count/text()', 
          query_to_xml(format('SELECT COUNT(*) FROM %I.%I', td.table_schema, td.table_name), 
          true, true, '')))[1]::text::int
      ), 0)
    ELSE NULL
  END as row_count,
  CASE 
    WHEN td.object_type = 'table' THEN
      (SELECT COUNT(*) 
       FROM information_schema.columns 
       WHERE table_schema = td.table_schema 
       AND table_name = td.table_name)
    ELSE NULL
  END as column_count,
  CASE 
    WHEN td.object_type = 'view' THEN
      ARRAY_LENGTH(td.depends_on, 1)
    ELSE NULL
  END as dependency_count
FROM sys_table_definitions td
ORDER BY 
  td.object_type,
  CASE 
    WHEN td.table_name LIKE 'ai_%' THEN 1
    WHEN td.table_name LIKE 'auth_%' THEN 2
    WHEN td.table_name LIKE 'batch_%' THEN 3
    WHEN td.table_name LIKE 'clipboard_%' THEN 4
    WHEN td.table_name LIKE 'command_%' THEN 5
    WHEN td.table_name LIKE 'dev_%' THEN 6
    WHEN td.table_name LIKE 'doc_%' THEN 7
    WHEN td.table_name LIKE 'document_%' THEN 8
    WHEN td.table_name LIKE 'email_%' THEN 9
    WHEN td.table_name LIKE 'expert_%' THEN 10
    WHEN td.table_name LIKE 'filter_%' THEN 11
    WHEN td.table_name LIKE 'google_%' THEN 12
    WHEN td.table_name LIKE 'import_%' THEN 13
    WHEN td.table_name LIKE 'learn_%' THEN 14
    WHEN td.table_name LIKE 'media_%' THEN 15
    WHEN td.table_name LIKE 'registry_%' THEN 16
    WHEN td.table_name LIKE 'scripts_%' THEN 17
    WHEN td.table_name LIKE 'service_%' THEN 18
    WHEN td.table_name LIKE 'sys_%' THEN 19
    WHEN td.table_name LIKE 'worktree_%' THEN 20
    ELSE 21
  END,
  td.table_name;

-- Add some specific view definitions that we know about
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date, depends_on)
VALUES 
  ('public', 'sys_service_dependency_summary', 'view', 
   'Summary view of service dependencies with usage counts', 
   'Provide quick overview of service usage patterns across apps and pipelines',
   '2025-06-06', 
   ARRAY['sys_shared_services', 'sys_app_service_dependencies', 'sys_pipeline_service_dependencies', 'sys_service_dependencies']),
  
  ('public', 'sys_app_dependencies_view', 'view',
   'Detailed view of application service dependencies',
   'Easy querying of which services each application uses',
   '2025-06-06',
   ARRAY['sys_applications', 'sys_app_service_dependencies', 'sys_shared_services']),
   
  ('public', 'sys_pipeline_dependencies_view', 'view',
   'Detailed view of CLI pipeline service dependencies',
   'Easy querying of which services each pipeline uses',
   '2025-06-06',
   ARRAY['sys_cli_pipelines', 'sys_pipeline_service_dependencies', 'sys_shared_services'])
ON CONFLICT (table_schema, table_name) 
DO UPDATE SET 
  object_type = EXCLUDED.object_type,
  description = EXCLUDED.description,
  purpose = EXCLUDED.purpose,
  depends_on = EXCLUDED.depends_on;