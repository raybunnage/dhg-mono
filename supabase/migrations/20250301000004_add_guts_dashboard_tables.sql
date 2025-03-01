-- Migration: Add tables for Guts dashboard feature
-- Description: Creates tables to track page dependencies, table usage, and function relationships

-- Table to track pages/dashboards in the application
CREATE TABLE IF NOT EXISTS public.app_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_name VARCHAR NOT NULL,
  page_path VARCHAR NOT NULL,
  description TEXT,
  app_name VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(app_name, page_path)
);

-- Table to track which Supabase tables are used by which pages
CREATE TABLE IF NOT EXISTS public.page_table_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES public.app_pages(id) ON DELETE CASCADE,
  table_name VARCHAR NOT NULL,
  operation_type VARCHAR[] NOT NULL, -- Array of operations: 'select', 'insert', 'update', 'delete'
  is_primary BOOLEAN DEFAULT false, -- Whether this is a primary/main table for the page
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(page_id, table_name)
);

-- Table to track which functions are used by which pages
CREATE TABLE IF NOT EXISTS public.page_function_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES public.app_pages(id) ON DELETE CASCADE,
  function_id UUID NOT NULL REFERENCES public.function_registry(id) ON DELETE CASCADE,
  usage_type VARCHAR NOT NULL, -- 'direct', 'imported', 'referenced'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(page_id, function_id)
);

-- Table to track external dependencies of pages
CREATE TABLE IF NOT EXISTS public.page_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES public.app_pages(id) ON DELETE CASCADE,
  dependency_type VARCHAR NOT NULL, -- 'google_drive', 'ai_service', 'external_api', etc.
  dependency_name VARCHAR NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(page_id, dependency_type, dependency_name)
);

-- Add additional fields to function_registry (without breaking existing records)
ALTER TABLE public.function_registry 
ADD COLUMN IF NOT EXISTS uses_react BOOLEAN,
ADD COLUMN IF NOT EXISTS ai_prompts JSONB,
ADD COLUMN IF NOT EXISTS refactor_candidate BOOLEAN,
ADD COLUMN IF NOT EXISTS specificity VARCHAR; -- 'common', 'dashboard_specific', 'page_specific'

-- Create view for the Guts dashboard
CREATE OR REPLACE VIEW public.page_guts_view AS
SELECT 
  ap.id as page_id,
  ap.page_name,
  ap.page_path,
  ap.app_name,
  
  -- Tables used
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'table_name', ptu.table_name,
        'operations', ptu.operation_type,
        'is_primary', ptu.is_primary
      )
    ) FILTER (WHERE ptu.id IS NOT NULL),
    '[]'::jsonb
  ) as tables_used,
  
  -- Functions used
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'function_id', fr.id,
        'function_name', fr.name,
        'location', fr.location,
        'uses_react', fr.uses_react,
        'ai_prompts', fr.ai_prompts,
        'refactor_candidate', fr.refactor_candidate,
        'specificity', fr.specificity,
        'usage_type', pfu.usage_type
      )
    ) FILTER (WHERE fr.id IS NOT NULL),
    '[]'::jsonb
  ) as functions_used,
  
  -- External dependencies
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'dependency_type', pd.dependency_type,
        'dependency_name', pd.dependency_name,
        'details', pd.details
      )
    ) FILTER (WHERE pd.id IS NOT NULL),
    '[]'::jsonb
  ) as external_dependencies
  
FROM 
  public.app_pages ap
LEFT JOIN 
  public.page_table_usage ptu ON ap.id = ptu.page_id
LEFT JOIN 
  public.page_function_usage pfu ON ap.id = pfu.page_id
LEFT JOIN 
  public.function_registry fr ON pfu.function_id = fr.id
LEFT JOIN 
  public.page_dependencies pd ON ap.id = pd.page_id
GROUP BY 
  ap.id, ap.page_name, ap.page_path, ap.app_name;

-- Create function to get page guts by path
CREATE OR REPLACE FUNCTION public.get_page_guts(p_page_path VARCHAR, p_app_name VARCHAR DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT 
    jsonb_build_object(
      'page_id', page_id,
      'page_name', page_name,
      'page_path', page_path,
      'app_name', app_name,
      'tables_used', tables_used,
      'functions_used', functions_used,
      'external_dependencies', external_dependencies
    )
  INTO v_result
  FROM 
    public.page_guts_view
  WHERE 
    page_path = p_page_path
    AND (p_app_name IS NULL OR app_name = p_app_name)
  LIMIT 1;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Create function to register a page
CREATE OR REPLACE FUNCTION public.register_page(
  p_page_name VARCHAR,
  p_page_path VARCHAR,
  p_app_name VARCHAR,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_page_id UUID;
BEGIN
  INSERT INTO public.app_pages (
    page_name,
    page_path,
    app_name,
    description
  )
  VALUES (
    p_page_name,
    p_page_path,
    p_app_name,
    p_description
  )
  ON CONFLICT (app_name, page_path) 
  DO UPDATE SET
    page_name = p_page_name,
    description = p_description,
    updated_at = now()
  RETURNING id INTO v_page_id;
  
  RETURN v_page_id;
END;
$$;

-- Create function to register table usage
CREATE OR REPLACE FUNCTION public.register_table_usage(
  p_page_id UUID,
  p_table_name VARCHAR,
  p_operations VARCHAR[],
  p_is_primary BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.page_table_usage (
    page_id,
    table_name,
    operation_type,
    is_primary
  )
  VALUES (
    p_page_id,
    p_table_name,
    p_operations,
    p_is_primary
  )
  ON CONFLICT (page_id, table_name) 
  DO UPDATE SET
    operation_type = p_operations,
    is_primary = p_is_primary,
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create function to register function usage
CREATE OR REPLACE FUNCTION public.register_function_usage(
  p_page_id UUID,
  p_function_id UUID,
  p_usage_type VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.page_function_usage (
    page_id,
    function_id,
    usage_type
  )
  VALUES (
    p_page_id,
    p_function_id,
    p_usage_type
  )
  ON CONFLICT (page_id, function_id) 
  DO UPDATE SET
    usage_type = p_usage_type,
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create function to register external dependency
CREATE OR REPLACE FUNCTION public.register_dependency(
  p_page_id UUID,
  p_dependency_type VARCHAR,
  p_dependency_name VARCHAR,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.page_dependencies (
    page_id,
    dependency_type,
    dependency_name,
    details
  )
  VALUES (
    p_page_id,
    p_dependency_type,
    p_dependency_name,
    p_details
  )
  ON CONFLICT (page_id, dependency_type, p_dependency_name) 
  DO UPDATE SET
    details = p_details,
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create function to update function metadata
CREATE OR REPLACE FUNCTION public.update_function_metadata(
  p_function_id UUID,
  p_uses_react BOOLEAN DEFAULT NULL,
  p_ai_prompts JSONB DEFAULT NULL,
  p_refactor_candidate BOOLEAN DEFAULT NULL,
  p_specificity VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.function_registry
  SET
    uses_react = COALESCE(p_uses_react, uses_react),
    ai_prompts = COALESCE(p_ai_prompts, ai_prompts),
    refactor_candidate = COALESCE(p_refactor_candidate, refactor_candidate),
    specificity = COALESCE(p_specificity, specificity),
    updated_at = now()
  WHERE
    id = p_function_id;
    
  RETURN FOUND;
END;
$$; 