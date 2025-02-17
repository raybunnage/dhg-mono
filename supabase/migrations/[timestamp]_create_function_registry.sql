-- Previous SQL goes here -- Core function documentation table
CREATE TABLE public.function_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'deprecated', 'experimental')),
  location TEXT NOT NULL, -- File path relative to repo root
  category TEXT NOT NULL,
  repository TEXT NOT NULL, -- GitHub repository name
  app_name TEXT, -- For monorepo apps
  target_package TEXT, -- For shared packages
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Function analysis
  supabase_operations JSONB, -- Document Supabase table/function calls
  dependencies TEXT[], -- Array of package dependencies
  used_in TEXT[], -- Array of components/files using this function
  input_types JSONB, -- Parameter types documentation
  output_types JSONB, -- Return type documentation
  code_signature TEXT, -- Function signature
  implementation_notes TEXT, -- Detailed notes about the implementation
  
  -- Cross-repo linking
  similar_functions JSONB, -- Links to similar functions in other repos
  shared_package_status BOOLEAN DEFAULT false, -- Flag if moved to shared package
  
  -- Version tracking
  git_commit_hash TEXT,
  git_branch TEXT,
  last_modified_by TEXT,
  
  -- Constraints
  UNIQUE(repository, app_name, name, location)
);

-- Track function changes over time
CREATE TABLE public.function_registry_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_id UUID REFERENCES public.function_registry(id),
  change_type TEXT CHECK (change_type IN ('created', 'updated', 'deprecated', 'moved')),
  previous_state JSONB,
  new_state JSONB,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by TEXT,
  git_commit_hash TEXT
);

-- Track relationships between functions
CREATE TABLE public.function_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_function_id UUID REFERENCES public.function_registry(id),
  target_function_id UUID REFERENCES public.function_registry(id),
  relationship_type TEXT CHECK (relationship_type IN ('calls', 'extends', 'implements', 'similar_to', 'replaced_by')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track repository metadata
CREATE TABLE public.repository_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository TEXT NOT NULL UNIQUE,
  last_analyzed TIMESTAMPTZ,
  total_functions INTEGER,
  analysis_status TEXT CHECK (analysis_status IN ('pending', 'in_progress', 'completed', 'failed')),
  repository_type TEXT CHECK (repository_type IN ('monorepo', 'single_app')),
  apps TEXT[], -- For monorepos
  shared_packages TEXT[], -- For monorepos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_function_registry_repo_app ON public.function_registry(repository, app_name);
CREATE INDEX idx_function_registry_category ON public.function_registry(category);
CREATE INDEX idx_function_registry_status ON public.function_registry(status);
CREATE INDEX idx_function_relationships_source ON public.function_relationships(source_function_id);
CREATE INDEX idx_function_relationships_target ON public.function_relationships(target_function_id);

-- Add RLS policies
ALTER TABLE public.function_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_registry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_metadata ENABLE ROW LEVEL SECURITY;

-- Example policy (adjust according to your auth needs)
CREATE POLICY "Allow read access to all authenticated users"
ON public.function_registry
FOR SELECT
TO authenticated
USING (true);