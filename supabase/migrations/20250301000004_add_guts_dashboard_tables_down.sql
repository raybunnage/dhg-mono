-- Down Migration: Remove tables for Guts dashboard feature
-- Description: Removes tables and functions created for the Guts dashboard feature

-- Drop functions
DROP FUNCTION IF EXISTS public.update_function_metadata;
DROP FUNCTION IF EXISTS public.register_dependency;
DROP FUNCTION IF EXISTS public.register_function_usage;
DROP FUNCTION IF EXISTS public.register_table_usage;
DROP FUNCTION IF EXISTS public.register_page;
DROP FUNCTION IF EXISTS public.get_page_guts;

-- Drop view
DROP VIEW IF EXISTS public.page_guts_view;

-- Remove added columns from function_registry
ALTER TABLE public.function_registry 
DROP COLUMN IF EXISTS uses_react,
DROP COLUMN IF EXISTS ai_prompts,
DROP COLUMN IF EXISTS refactor_candidate,
DROP COLUMN IF EXISTS specificity;

-- Drop tables
DROP TABLE IF EXISTS public.page_dependencies;
DROP TABLE IF EXISTS public.page_function_usage;
DROP TABLE IF EXISTS public.page_table_usage;
DROP TABLE IF EXISTS public.app_pages; 