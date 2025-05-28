 SELECT dt.document_type, COUNT(*) as count
  FROM sources_google sg
  JOIN document_types dt ON sg.document_type_id = dt.id
  WHERE sg.document_type_id IS NOT NULL and is_deleted = FALSE
    GROUP BY dt.document_type
  ORDER BY count DESC;


    SELECT dt.document_type, COUNT(*) as count
  FROM expert_documents ed
  JOIN document_types dt ON ed.document_type_id = dt.id
  WHERE ed.document_type_id IS NOT NULL 
  GROUP BY dt.document_type
  ORDER BY count DESC;


    SELECT dts.document_type as sg_doc_type, sg.name, ed.*  
  FROM expert_documents ed
  JOIN document_types dt ON ed.document_type_id = dt.id
  join sources_google sg on ed.source_id = sg.id
  join document_types dts on sg.document_type_id = dts.id
  WHERE  ed.document_type_id in (
  '9ccdc433-99d8-46fb-8bf7-3ba72cf27c88' , '46dac359-01e9-4e36-bfb2-531da9c25e3f', 'ba7893d4-8404-4489-b553-b6464cd5cbd8' , 'c62f92f5-6123-4324-876d-14639841284e',
'5e61bfbc-39ef-4380-80c0-592017b39b71', '5eb89387-854c-4754-baf8-3632ac286d92') and raw_content is not null
 ;

select processing_skip_reason, d.* from expert_documents d where processing_skip_reason is not null



-- Create the enum type for document processing status
CREATE TYPE document_processing_status AS ENUM (
    'needs_reprocessing',    -- Document needs to be reprocessed
    'reprocessing_done',     -- Reprocessing has been completed
    'skip_processing',       -- Document should be skipped (unsupported type, password protected, etc)
    'not_set'               -- Initial state
);

WITH folder_depths AS (
  SELECT 
    dt.document_type,
    -- Count slashes to determine depth, add 1 since root has 0 slashes
    (LENGTH(sg.path) - LENGTH(REPLACE(sg.path, '/', ''))) + 1 as path_depth,
    sg.path,
    COUNT(*) as folder_count
  FROM sources_google sg
  LEFT JOIN document_types dt ON sg.document_type_id = dt.id
  WHERE 
    sg.mime_type = 'application/vnd.google-apps.folder'
    AND sg.is_deleted = FALSE
  GROUP BY 
    dt.document_type,
    path_depth,
    sg.path
)
SELECT 
  COALESCE(document_type, 'No Type') as folder_type,
  path_depth,
  COUNT(*) as folders_at_depth,
  STRING_AGG(path, ', ' ORDER BY path) as example_paths
FROM folder_depths
GROUP BY 
  folder_type,
  path_depth
ORDER BY 
  folder_type,
  path_depth;

select dt.document_type, sg.path_depth, sg.name, sg.mime_type from sources_google sg
join document_types dt on dt.id = sg.document_type_id
where  sg.mime_type = 'application/vnd.google-apps.folder' order by path_depth



select * from sources_google where name = 'RCW_academic_CV_CU.pdf'

select * from expert_documents where source_id ='960c9984-adb4-4e2d-8dee-5b347f569f7b'

select * from sources_google where id = 'fe943b28-fe21-4086-a9a5-1ebee71caabd'

ALTER TABLE expert_documents
  DROP COLUMN IF EXISTS ai_analysis,
  DROP COLUMN IF EXISTS ai_processing_details,
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS expert_id,
  DROP COLUMN IF EXISTS last_error_at,
  DROP COLUMN IF EXISTS last_viewed_at,
  DROP COLUMN IF EXISTS model_used,
  DROP COLUMN IF EXISTS previous_version_id,
  DROP COLUMN IF EXISTS prompt_used,
  DROP COLUMN IF EXISTS queued_at,
  DROP COLUMN IF EXISTS structure,
  DROP COLUMN IF EXISTS token_count;

CREATE TABLE view_backups AS
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE viewname = 'batch_processing_status';

DROP VIEW IF EXISTS batch_processing_status;

CREATE TABLE presentations_backup_20250423 AS 
SELECT * FROM presentations;

CREATE TABLE expert_documents_backup_20250423 AS 
SELECT * FROM expert_documents;


-- Create the enum type for document processing status
CREATE TYPE document_processing_status AS ENUM (
    'needs_reprocessing',    -- Document needs to be reprocessed
    'reprocessing_done',     -- Reprocessing has been completed
    'skip_processing',       -- Document should be skipped (unsupported type, password protected, etc)
    'not_set'               -- Initial state
);
-- Add the new columns to expert_documents
ALTER TABLE expert_documents 
    ADD COLUMN IF NOT EXISTS document_processing_status document_processing_status DEFAULT 'not_set',
    
    ALTER TABLE expert_documents 
    ADD COLUMN IF NOT EXISTS document_processing_status_updated_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS processing_skip_reason text;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_expert_documents_processing_status 
    ON expert_documents(document_processing_status);

-- Create function to auto-update timestamp when status changes
CREATE OR REPLACE FUNCTION update_document_processing_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.document_processing_status IS DISTINCT FROM NEW.document_processing_status THEN
        NEW.document_processing_status_updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER trigger_document_update_document_processing_status_timestamp
    BEFORE UPDATE ON expert_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_document_processing_status_timestamp();



-- Detailed analysis of text and JSON fields
WITH column_stats AS (
    SELECT 
        COUNT(*) as total_rows,
        GREATEST(COUNT(*), 1) as safe_count
    FROM expert_documents
)
SELECT 
    column_name,
    data_type,
    -- Count statistics
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE fields.value IS NULL) as null_count,
    -- Null percentage with 2 decimal places
    ROUND((COUNT(*) FILTER (WHERE fields.value IS NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2) as null_percentage,
    -- Non-null percentage with 2 decimal places
    ROUND((COUNT(*) FILTER (WHERE fields.value IS NOT NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2) as used_percentage,
    -- Distinct value analysis
    COUNT(DISTINCT fields.value) as distinct_values,
    -- For JSON fields
    CASE 
        WHEN data_type LIKE '%json%' THEN 
            ROUND((SUM(CASE WHEN fields.value = '{}' OR fields.value = '[]' THEN 1 ELSE 0 END))::numeric / 
                  NULLIF(COUNT(*), 0) * 100, 2)
    END as empty_json_percentage,
    -- Last modified
    MAX(fields.value) FILTER (WHERE column_name = 'updated_at') as last_updated,
    -- Sample values (for non-text/json fields)
    CASE 
        WHEN data_type NOT IN ('json', 'jsonb', 'text') AND 
             COUNT(DISTINCT fields.value) <= 5 THEN 
            string_agg(DISTINCT fields.value, ', ' ORDER BY fields.value)
        ELSE 'Multiple values'
    END as sample_values
FROM expert_documents
CROSS JOIN LATERAL jsonb_each_text(to_jsonb(expert_documents)) AS fields(column_name, value)
JOIN information_schema.columns c ON 
    c.table_name = 'expert_documents' AND 
    c.column_name = fields.column_name AND
    c.table_schema = 'public'
GROUP BY column_name, data_type
ORDER BY 
    null_percentage DESC,
    column_name ASC;




 
CREATE TYPE document_classifier AS ENUM (
    'pdf',
    'powerpoint',
    'docx',
    'expert'
);

ALTER TABLE document_types
ADD COLUMN classifier document_classifier;

-- Down Migration
--ALTER TABLE document_types DROP COLUMN IF EXISTS classifier;
--DROP TYPE IF EXISTS document_classifier;

select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'docx'
select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'pdf'
select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'powerpoint'

select s.id, s.path_depth, s.document_type_id,  s.mime_type, s.name from sources_google s 
where s.document_type_id in ('dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd','bd903d99-64a1-4297-ba76-1094ab235dac')




where name like '%pptx'
left join document_types t on t.id = s.document_type_id  where name like '%pdf'

select s.id,  s.mime_type, s.name from sources_google s where s.document_type_id = '9dbe32ff-5e82-4586-be63-1445e5bcc548'



--where document_type_id is null
where s.mime_type in ('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
and s.document_type_id is null

select count(*) from expert_documents


 ('application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/vnd.google-apps.document')

order by modified_at desc
 

 

UPDATE sources_google 
SET document_type_id = 'ba1d7662-0168-4756-a2ea-6d964fd02ba8'
WHERE mime_type = 'video/mp4' 
RETURNING id, name, mime_type, document_type_id;

select * from expert_documents where source_id = '49d0238f-4cbc-44d7-8c36-d2bb99515ba1'

select id, document_type from document_types where document_type like '%unk%'

order by document_type where document_type = 'Technical Specification'

select * from prompts where name = 'document-classification-prompt-new'

select name, mime_type, path_depth, main_video_id,path_array from  sources_google where mime_type = 'application/vnd.google-apps.folder' and path_depth = 0;
select * from sources_google2 where id = '221817dd-d765-4f2f-a88c-4ba314d33204';

insert 


WITH total_rows AS (
  SELECT COUNT(*) as total
  FROM sources_google
),
null_counts AS (
  SELECT 
    (SELECT total FROM total_rows) as total_rows,
    -- Core Fields
    SUM(CASE WHEN id IS NULL THEN 1 ELSE 0 END) as id_nulls,
    SUM(CASE WHEN name IS NULL THEN 1 ELSE 0 END) as name_nulls,
    SUM(CASE WHEN mime_type IS NULL THEN 1 ELSE 0 END) as mime_type_nulls,
    SUM(CASE WHEN drive_id IS NULL THEN 1 ELSE 0 END) as drive_id_nulls,
    SUM(CASE WHEN root_drive_id IS NULL THEN 1 ELSE 0 END) as root_drive_id_nulls,
    SUM(CASE WHEN parent_folder_id IS NULL THEN 1 ELSE 0 END) as parent_folder_id_nulls,
    SUM(CASE WHEN path IS NULL THEN 1 ELSE 0 END) as path_nulls,
    SUM(CASE WHEN is_root IS NULL THEN 1 ELSE 0 END) as is_root_nulls,
    SUM(CASE WHEN path_array IS NULL THEN 1 ELSE 0 END) as path_array_nulls,
    SUM(CASE WHEN path_depth IS NULL THEN 1 ELSE 0 END) as path_depth_nulls,
    SUM(CASE WHEN is_deleted IS NULL THEN 1 ELSE 0 END) as is_deleted_nulls,
    
    -- Metadata and File Attributes
    SUM(CASE WHEN metadata IS NULL THEN 1 ELSE 0 END) as metadata_nulls,
    SUM(CASE WHEN size IS NULL THEN 1 ELSE 0 END) as size_nulls,
    SUM(CASE WHEN modified_at IS NULL THEN 1 ELSE 0 END) as modified_at_nulls,
    SUM(CASE WHEN web_view_link IS NULL THEN 1 ELSE 0 END) as web_view_link_nulls,
    SUM(CASE WHEN thumbnail_link IS NULL THEN 1 ELSE 0 END) as thumbnail_link_nulls,
    
    -- Content Processing Fields
    SUM(CASE WHEN document_type_id IS NULL THEN 1 ELSE 0 END) as document_type_id_nulls,
    SUM(CASE WHEN expert_id IS NULL THEN 1 ELSE 0 END) as expert_id_nulls,
    
    -- Timestamps
    SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END) as created_at_nulls,
    SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) as updated_at_nulls,
    SUM(CASE WHEN last_indexed IS NULL THEN 1 ELSE 0 END) as last_indexed_nulls,
    
    -- Additional Fields
    SUM(CASE WHEN main_video_id IS NULL THEN 1 ELSE 0 END) as main_video_id_nulls
  FROM sources_google
)
SELECT * FROM (
  SELECT
    'Total Rows' as field_name,
    total_rows as total_count,
    0 as null_count,
    0.0 as null_percentage,
    0 as sort_order
  FROM null_counts

  UNION ALL

  SELECT 
    field_name, 
    total_rows, 
    null_count, 
    ROUND((null_count::float / total_rows::float * 100)::numeric, 2) as null_percentage,
    1 as sort_order
  FROM (
    SELECT 'id' as field_name, total_rows, id_nulls as null_count FROM null_counts
    UNION ALL SELECT 'name', total_rows, name_nulls FROM null_counts
    UNION ALL SELECT 'mime_type', total_rows, mime_type_nulls FROM null_counts
    UNION ALL SELECT 'drive_id', total_rows, drive_id_nulls FROM null_counts
    UNION ALL SELECT 'root_drive_id', total_rows, root_drive_id_nulls FROM null_counts
    UNION ALL SELECT 'parent_folder_id', total_rows, parent_folder_id_nulls FROM null_counts
    UNION ALL SELECT 'path', total_rows, path_nulls FROM null_counts
    UNION ALL SELECT 'is_root', total_rows, is_root_nulls FROM null_counts
    UNION ALL SELECT 'path_array', total_rows, path_array_nulls FROM null_counts
    UNION ALL SELECT 'path_depth', total_rows, path_depth_nulls FROM null_counts
    UNION ALL SELECT 'is_deleted', total_rows, is_deleted_nulls FROM null_counts
    UNION ALL SELECT 'metadata', total_rows, metadata_nulls FROM null_counts
    UNION ALL SELECT 'size', total_rows, size_nulls FROM null_counts
    UNION ALL SELECT 'modified_at', total_rows, modified_at_nulls FROM null_counts
    UNION ALL SELECT 'web_view_link', total_rows, web_view_link_nulls FROM null_counts
    UNION ALL SELECT 'thumbnail_link', total_rows, thumbnail_link_nulls FROM null_counts
    UNION ALL SELECT 'document_type_id', total_rows, document_type_id_nulls FROM null_counts
    UNION ALL SELECT 'expert_id', total_rows, expert_id_nulls FROM null_counts
    UNION ALL SELECT 'created_at', total_rows, created_at_nulls FROM null_counts
    UNION ALL SELECT 'updated_at', total_rows, updated_at_nulls FROM null_counts
    UNION ALL SELECT 'last_indexed', total_rows, last_indexed_nulls FROM null_counts
    UNION ALL SELECT 'main_video_id', total_rows, main_video_id_nulls FROM null_counts
  ) t
) final
ORDER BY 
  sort_order,
  null_percentage DESC;





update sources_google2 
set main_video_id = g.id
from sources_google2 g
where g.mime_type = 'video/mp4' and g.main_video_id is null;


UPDATE sources_google2 s
SET main_video_id = g.id
FROM sources_google2 g
WHERE g.mime_type = 'video/mp4' 
  AND s.main_video_id IS NULL
  AND s.id = g.id;  


where mime_type = 'video/mp4' 

and name = 'Sullivan.Ballantyne.5.3.23.mp4'


and name = 'Tauben.Sullivan.4.20.22.mp4'






SELECT * FROM sources_google2 
WHERE '2023-10-04-Hanscom' = ANY(path_array);


select * from presentations limit 5

where file_signature is null;


where id = 'b257d441-7bce-495d-8a54-3272d2f16c02'

name = 'test new document'
mime_type, name, path_depth, path_array, metadata FROM sources_google2 where is_deleted = true

update sources_google2 set path_depth = 0 WHERE id = 'c711a758-5b2b-439a-80df-7d17231a77d4';

["2023-10-04-Hanscom","Clawson-RUTs neuroscience","10.4.23.Hanscom:Clawson.mp4"]


CREATE TABLE sources_google2 AS 
SELECT * FROM sources_google2_backup_2024_03_26;



  
where name like '%test new document%';



CREATE INDEX IF NOT EXISTS sources_google2_drive_id_idx ON sources_google2 (drive_id);
CREATE INDEX IF NOT EXISTS sources_google2_root_drive_id_idx ON sources_google2 (root_drive_id);
CREATE INDEX IF NOT EXISTS sources_google2_parent_folder_id_idx ON sources_google2 (parent_folder_id);
CREATE INDEX IF NOT EXISTS sources_google2_mime_type_idx ON sources_google2 (mime_type);
CREATE INDEX IF NOT EXISTS sources_google2_path_idx ON sources_google2 (path);
CREATE INDEX IF NOT EXISTS sources_google2_name_idx ON sources_google2 (name);
CREATE INDEX IF NOT EXISTS sources_google2_document_type_id_idx ON sources_google2 (document_type_id);
CREATE INDEX IF NOT EXISTS sources_google2_expert_id_idx ON sources_google2 (expert_id);

-- Step 5: Verify the restoration
SELECT COUNT(*) as total_rows FROM sources_google2;



--CREATE TABLE sources_google2_backup_2024_03_26 AS 
--SELECT * FROM sources_google2;

--DROP TABLE IF EXISTS sources_google2;

CREATE TABLE sources_google2 AS 
SELECT * FROM sources_google2_backup_2024_03_26;

CREATE TABLE sources_google2_backup_2025_04_11 AS 
SELECT * FROM sources_google2_backup_2024_03_26;

select * from sources_google2 where name = 'test new document';
where updated_at::date = '2025-04-12'

select * from sources_google2 where drive_id in (
'1lY0Vxhv51RBZ5K9PmVQ9_T5PGpmcnkdh'
)

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'document_types'
ORDER BY ordinal_position;


CREATE TABLE google_sources_experts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources_google(id),
    expert_id UUID NOT NULL REFERENCES experts(id),
    role_description TEXT,                    -- For additional context when role is 'other'
    is_primary BOOLEAN DEFAULT false,         -- Whether this expert is the primary for this source
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_google_sources_experts_source_id ON
google_sources_experts(source_id);
CREATE INDEX idx_google_sources_experts_expert_id ON
google_sources_experts(expert_id);


  ALTER TABLE sources_google 
ADD PRIMARY KEY (id);

ALTER TABLE sources_google
DROP COLUMN expert_id




-- Add mnemonic column to experts table
ALTER TABLE public.experts
ADD COLUMN IF NOT EXISTS mnemonic TEXT;

-- Create unique index on mnemonic
CREATE UNIQUE INDEX IF NOT EXISTS idx_experts_mnemonic ON public.experts(mnemonic);

-- Update experts with mnemonics from the reference list
UPDATE public.experts e
SET mnemonic = m.mnemonic
FROM (VALUES
    -- ... previous values ...
  ('Miller', 'MIL')
    -- ... rest of previous values ...
) AS m(expert_name, mnemonic)
WHERE e.expert_name = m.expert_name;

-- Add comment explaining the mnemonic field
COMMENT ON COLUMN public.experts.mnemonic IS '3-character mnemonic code for the expert';

SELECT expert_name 
FROM public.experts 
WHERE mnemonic IS NULL
ORDER BY expert_name;



INSERT INTO experts (expert_name, full_name) VALUES
('Stockdale', 'Brenda Stockdale')

DELETE FROM experts where expert_name = 'Brenda'



select count(*) from sources_google where mime_type = 'video/mp4'

select * from presentations

-- First query: Find videos in sources_google that don't exist in presentations
-- First query: Find videos in sources_google that don't exist in presentations
WITH google_videos AS (
  SELECT 
    name,
    id as source_id
  FROM sources_google 
  WHERE mime_type = 'video/mp4'
),
presentation_files AS (
  SELECT 
    filename,
    id as presentation_id
  FROM presentations
)
SELECT * FROM (
  -- Videos in sources_google but not in presentations
  SELECT 
    'Missing in Presentations' as mismatch_type,
    gv.name as google_name,
    gv.source_id
  FROM google_videos gv
  WHERE NOT EXISTS (
    SELECT 1 
    FROM presentation_files pf 
    WHERE pf.filename = gv.name
  )

  UNION ALL

  -- Videos in presentations but not in sources_google
  SELECT 
    'Missing in Sources Google' as mismatch_type,
    pf.filename as google_name,
    pf.presentation_id
  FROM presentation_files pf
  WHERE NOT EXISTS (
    SELECT 1 
    FROM google_videos gv 
    WHERE gv.name = pf.filename
  )
) as mismatches
ORDER BY mismatch_type, google_name;


select id, category, document_type, description, mime_type, file_extension from document_types;


-- Create command_history table for tracking CLI pipeline command executions
  CREATE TABLE IF NOT EXISTS command_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    pipeline_name TEXT NOT NULL,
    command_name TEXT NOT NULL,
    execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
    records_affected INTEGER,
    affected_entity TEXT,
    summary TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
  );

  -- Create indexes for faster querying
  CREATE INDEX IF NOT EXISTS command_history_pipeline_name_idx ON command_history
  (pipeline_name);
  CREATE INDEX IF NOT EXISTS command_history_status_idx ON command_history (status);
  CREATE INDEX IF NOT EXISTS command_history_execution_time_idx ON command_history
  (execution_time DESC);

  -- Create RLS policy to allow authenticated users to view command history
  ALTER TABLE command_history ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Allow authenticated users to view command history"
  ON command_history
  FOR SELECT
  TO authenticated
  USING (true);

  -- Create RLS policy to allow service role to insert/update command history
  CREATE POLICY "Allow service role to insert/update command history"
  ON command_history
  FOR ALL
  TO service_role
  USING (true);

  -- Create function to get command execution stats
  -- Make sure the command_history table is created first
  CREATE TABLE IF NOT EXISTS command_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    pipeline_name TEXT NOT NULL,
    command_name TEXT NOT NULL,
    execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
    records_affected INTEGER,
    affected_entity TEXT,
    summary TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
  );

  -- Create the function after the table exists
  
  CREATE OR REPLACE FUNCTION get_command_stats()
  RETURNS TABLE (
    pipeline_name TEXT,
    command_name TEXT,
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    running_executions BIGINT,
    avg_duration_ms NUMERIC,
    last_execution TIMESTAMP WITH TIME ZONE
  ) AS $$
  BEGIN
    RETURN QUERY EXECUTE '
      SELECT 
        pipeline_name,
        command_name,
        COUNT(*) AS total_executions,
        COUNT(*) FILTER (WHERE status = ''success'') AS successful_executions,
        COUNT(*) FILTER (WHERE status = ''error'') AS failed_executions,
        COUNT(*) FILTER (WHERE status = ''running'') AS running_executions,
        AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS avg_duration_ms,
        MAX(execution_time) AS last_execution
      FROM 
        command_history
      GROUP BY 
        pipeline_name, command_name
      ORDER BY 
        MAX(execution_time) DESC
    ';
  END;
  $$ LANGUAGE plpgsql;




  -- Create cli_command_tracking table for tracking CLI pipeline command executions
  CREATE TABLE IF NOT EXISTS cli_command_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    pipeline_name TEXT NOT NULL,
    command_name TEXT NOT NULL,
    execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
    records_affected INTEGER,
    affected_entity TEXT,
    summary TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
  );

  -- Create indexes for faster querying
  CREATE INDEX IF NOT EXISTS cli_command_tracking_pipeline_name_idx ON cli_command_tracking
   (pipeline_name);
  CREATE INDEX IF NOT EXISTS cli_command_tracking_status_idx ON cli_command_tracking
  (status);
  CREATE INDEX IF NOT EXISTS cli_command_tracking_execution_time_idx ON
  cli_command_tracking (execution_time DESC);

  -- Create RLS policy to allow authenticated users to view command history
  ALTER TABLE cli_command_tracking ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Allow authenticated users to view CLI command tracking"
  ON cli_command_tracking
  FOR SELECT
  TO authenticated
  USING (true);

  -- Create RLS policy to allow service role to insert/update command history
  CREATE POLICY "Allow service role to insert/update CLI command tracking"
  ON cli_command_tracking
  FOR ALL
  TO service_role
  USING (true);

  Then, you'll need this function for the stats feature:

  -- Create function to get command execution stats
  CREATE OR REPLACE FUNCTION get_cli_command_stats()
  RETURNS TABLE (
    pipeline_name TEXT,
    command_name TEXT,
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    running_executions BIGINT,
    avg_duration_ms NUMERIC,
    last_execution TIMESTAMP WITH TIME ZONE
  ) LANGUAGE SQL STABLE
  AS $$
    SELECT
      pipeline_name,
      command_name,
      COUNT(*) AS total_executions,
      COUNT(*) FILTER (WHERE status = 'success') AS successful_executions,
      COUNT(*) FILTER (WHERE status = 'error') AS failed_executions,
      COUNT(*) FILTER (WHERE status = 'running') AS running_executions,
      AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS avg_duration_ms,
      MAX(execution_time) AS last_execution
    FROM
      cli_command_tracking
    GROUP BY
      pipeline_name, command_name
    ORDER BY
      MAX(execution_time) DESC NULLS LAST
  $$;


    SELECT
      classid::regclass AS dependent_object_type,
      objid::regclass AS dependent_object_name,
      objsubid,
      refclassid::regclass AS referenced_object_type,
      refobjid::regclass AS referenced_object_name,
      refobjsubid
  FROM pg_depend
  WHERE refobjid = 'command_history'::regclass;


DROP POLICY IF EXISTS "Allow authenticated users to view command history" ON
  command_history;
  DROP POLICY IF EXISTS "Allow service role to insert/update command history" ON
  command_history;
  DROP POLICY IF EXISTS "Enable read access for all users" ON command_history;
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON command_history;

  -- Step 2: Drop all indexes
  DROP INDEX IF EXISTS idx_command_history_category;
  DROP INDEX IF EXISTS idx_command_history_executed_at;
  DROP INDEX IF EXISTS idx_command_history_success;

DO $$
  DECLARE
      r RECORD;
  BEGIN
      FOR r IN (SELECT tc.constraint_name, tc.table_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = 'command_history')
      LOOP
          EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' ||
  quote_ident(r.constraint_name);
      END LOOP;
  END $$;

  -- Step 4: Remove foreign keys from this table to other tables
  ALTER TABLE command_history DROP CONSTRAINT IF EXISTS command_history_category_id_fkey;

  -- Step 5: Disable row level security
  ALTER TABLE command_history DISABLE ROW LEVEL SECURITY;

  -- Step 6: Finally drop the table (with CASCADE to handle any remaining dependencies)
  DROP TABLE command_history CASCADE;

  select * from cli_command_tracking



  WITH column_stats AS (
    SELECT 
        COUNT(*) as total_rows,
        GREATEST(COUNT(*), 1) as safe_count
    FROM expert_documents
)
SELECT 
    c.column_name,
    c.data_type,
    -- Count statistics
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE fields.value IS NULL) as null_count,
    -- Null percentage with 2 decimal places
    ROUND((COUNT(*) FILTER (WHERE fields.value IS NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2) as null_percentage,
    -- Non-null percentage with 2 decimal places
    ROUND((COUNT(*) FILTER (WHERE fields.value IS NOT NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2) as used_percentage,
    -- Distinct value analysis
    COUNT(DISTINCT fields.value) as distinct_values,
    -- For JSON fields
    CASE 
        WHEN c.data_type LIKE '%json%' THEN 
            ROUND((SUM(CASE WHEN fields.value = '{}' OR fields.value = '[]' THEN 1 ELSE 0 END))::numeric / 
                  NULLIF(COUNT(*), 0) * 100, 2)
    END as empty_json_percentage,
    -- Last modified
    MAX(fields.value) FILTER (WHERE c.column_name = 'updated_at') as last_updated,
    -- Sample values (for non-text/json fields)
    CASE 
        WHEN c.data_type NOT IN ('json', 'jsonb', 'text') AND 
             COUNT(DISTINCT fields.value) <= 5 THEN 
            string_agg(DISTINCT fields.value, ', ' ORDER BY fields.value)
        ELSE 'Multiple values'
    END as sample_values
FROM expert_documents
CROSS JOIN LATERAL jsonb_each_text(to_jsonb(expert_documents)) AS fields(column_name, value)
JOIN information_schema.columns c ON 
    c.table_name = 'expert_documents' AND 
    c.column_name = fields.column_name AND
    c.table_schema = 'public'
GROUP BY c.column_name, c.data_type
ORDER BY 
    null_percentage DESC,
    c.column_name ASC;