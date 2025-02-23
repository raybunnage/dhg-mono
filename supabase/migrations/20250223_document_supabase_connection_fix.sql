INSERT INTO function_registry (
  id,
  name,
  description,
  category,
  location,
  implementation_notes,
  repository,
  app_name,
  code_signature,
  input_types,
  output_types,
  supabase_operations,
  status
) VALUES (
  gen_random_uuid(),
  'supabase-connection-fix-2025-02',
  'Documentation of fixing Supabase 401 authentication errors by comparing working vs non-working implementations',
  'debugging',
  'apps/dhg-improve-experts/src/integrations/supabase/client.ts',
  $$ 
  Key findings from debugging:
  1. Environment variables were not the issue - hardcoded credentials from working app solved it
  2. Path structure mattered: @/integrations/supabase/client vs @/utils/supabase
  3. Authentication flow needed to be established before making queries
  4. TypeScript types needed to be properly imported from central location
  $$,
  'dhg',
  'dhg-improve-experts',
  'createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)',
  jsonb_build_object(
    'credentials', jsonb_build_object(
      'SUPABASE_URL', 'string',
      'SUPABASE_PUBLISHABLE_KEY', 'string'
    ),
    'environment', jsonb_build_object(
      'required', false,
      'note', 'Hardcoded credentials worked while env vars failed'
    )
  ),
  jsonb_build_object(
    'connection', 'SupabaseClient<Database>',
    'authentication', 'Promise<AuthResponse>'
  ),
  jsonb_build_object(
    'before', jsonb_build_object(
      'error', '401 Unauthorized',
      'cause', 'Environment variables not loading correctly',
      'location', '@/utils/supabase'
    ),
    'after', jsonb_build_object(
      'solution', 'Used working credentials from other app',
      'path', '@/integrations/supabase/client',
      'auth_flow', 'Added explicit authentication step'
    ),
    'key_changes', jsonb_build_array(
      'Moved client to correct path structure',
      'Used hardcoded working credentials',
      'Added authentication before queries',
      'Imported types from central location'
    )
  ),
  'active'
);

-- Add relationships to show connection with other components
INSERT INTO function_relationships (
  id,
  source_function_id,
  target_function_id,
  relationship_type,
  details
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM function_registry WHERE name = 'supabase-connection-fix-2025-02'),
  (SELECT id FROM function_registry WHERE name = 'registry-viewer'),
  'implements',
  jsonb_build_object(
    'description', 'RegistryViewer component uses the fixed Supabase connection',
    'files_affected', jsonb_build_array(
      'src/integrations/supabase/client.ts',
      'src/components/RegistryViewer.tsx',
      'src/App.tsx'
    )
  )
); 