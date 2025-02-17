-- Previous SQL goes here

-- First, let's check the allowed relationship types from the original table definition
CREATE TABLE public.function_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_function_id UUID REFERENCES public.function_registry(id),
  target_function_id UUID REFERENCES public.function_registry(id),
  relationship_type TEXT CHECK (relationship_type IN ('calls', 'extends', 'implements', 'similar_to', 'replaced_by')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert the working solution into function_registry
INSERT INTO function_registry (
  name,
  description,
  status,
  location,
  category,
  repository,
  supabase_operations,
  dependencies,
  implementation_notes,
  code_signature
) VALUES (
  'generate_supabase_types',
  'Generate TypeScript types from Supabase schema without Docker',
  'active',
  'scripts/supabase/gen-types.ts',
  'database',
  'dhg-mono',
  jsonb_build_object(
    'required_env_vars', array[
      'SUPABASE_PROJECT_ID',
      'SUPABASE_DB_PASSWORD',
      'SUPABASE_DB_URL',
      'SUPABASE_URL',
      'SUPABASE_KEY'
    ],
    'cli_commands', array[
      'pnpm supabase gen types typescript --debug > supabase/types.ts'
    ]
  ),
  array['@supabase/cli@2.12.1'],
  'Working solution for type generation without Docker dependency. Requires proper environment setup and direct database connection.',
  $CODE$
// Command signature
pnpm supabase gen types typescript --debug > supabase/types.ts

// Required .env structure
SUPABASE_PROJECT_ID=project_id
SUPABASE_DB_PASSWORD=db_password
SUPABASE_DB_URL=postgresql://postgres:password@db.project_id.supabase.co:5432/postgres
SUPABASE_URL=https://project_id.supabase.co
SUPABASE_KEY=anon_key
$CODE$
);

-- Track the relationship with environment setup
INSERT INTO function_relationships (
  source_function_id,
  target_function_id,
  relationship_type,
  details
) VALUES (
  (SELECT id FROM function_registry WHERE name = 'generate_supabase_types'),
  (SELECT id FROM function_registry WHERE name = 'setup_supabase_env'),
  'calls',  -- Changed from 'requires' to 'calls' to match allowed types
  jsonb_build_object(
    'env_files', array['.env', '.env.development'],
    'critical_vars', array[
      'SUPABASE_PROJECT_ID',
      'SUPABASE_DB_PASSWORD'
    ]
  )
);

-- Create a view to show function registry entries with their relationships
CREATE OR REPLACE VIEW function_registry_view AS
WITH relationship_details AS (
  SELECT 
    fr.source_function_id,
    jsonb_agg(
      jsonb_build_object(
        'related_function', fr2.name,
        'relationship_type', fr.relationship_type,
        'details', fr.details
      )
    ) as relationships
  FROM function_relationships fr
  JOIN function_registry fr2 ON fr.target_function_id = fr2.id
  GROUP BY fr.source_function_id
)
SELECT 
  f.id,
  f.name,
  f.description,
  f.status,
  f.location,
  f.category,
  f.repository,
  f.supabase_operations,
  f.dependencies,
  f.implementation_notes,
  f.code_signature,
  f.created_at,
  f.updated_at,
  COALESCE(rd.relationships, '[]'::jsonb) as relationships,
  EXISTS (
    SELECT 1 
    FROM function_registry_history h 
    WHERE h.function_id = f.id
  ) as has_history
FROM function_registry f
LEFT JOIN relationship_details rd ON f.id = rd.source_function_id
ORDER BY f.created_at DESC;

-- Create a view for function history
CREATE OR REPLACE VIEW function_history_view AS
SELECT 
  h.id as history_id,
  f.name as function_name,
  h.change_type,
  h.previous_state,
  h.new_state,
  h.changed_at,
  h.changed_by,
  h.git_commit_hash
FROM function_registry_history h
JOIN function_registry f ON h.function_id = f.id
ORDER BY h.changed_at DESC;

-- Helper function to get complete function details
CREATE OR REPLACE FUNCTION get_function_details(p_name TEXT)
RETURNS TABLE (
  function_details jsonb,
  relationships jsonb,
  history jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(f.*) - 'id' as function_details,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'related_function', fr2.name,
            'relationship_type', fr.relationship_type,
            'details', fr.details
          )
        )
        FROM function_relationships fr
        JOIN function_registry fr2 ON fr.target_function_id = fr2.id
        WHERE fr.source_function_id = f.id
      ),
      '[]'::jsonb
    ) as relationships,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'change_type', h.change_type,
            'changed_at', h.changed_at,
            'changed_by', h.changed_by,
            'previous_state', h.previous_state,
            'new_state', h.new_state,
            'git_commit_hash', h.git_commit_hash
          )
          ORDER BY h.changed_at DESC
        )
        FROM function_registry_history h
        WHERE h.function_id = f.id
      ),
      '[]'::jsonb
    ) as history
  FROM function_registry f
  WHERE f.name = p_name;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM function_registry_view;
-- SELECT * FROM function_history_view;
-- SELECT * FROM get_function_details('generate_supabase_types');