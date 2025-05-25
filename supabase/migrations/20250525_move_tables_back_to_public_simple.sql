-- Migration: Move 3 tables back to public schema (simplified)
-- Description: Move prompt_output_templates, prompt_template_associations, and user_profiles_v2 back to public schema

-- Step 1: Move tables from backup to public schema
-- These tables exist in backup schema and need to be in public

ALTER TABLE IF EXISTS backup.prompt_output_templates SET SCHEMA public;
ALTER TABLE IF EXISTS backup.prompt_template_associations SET SCHEMA public;
ALTER TABLE IF EXISTS backup.user_profiles_v2 SET SCHEMA public;

-- Step 2: Update backup_metadata to reflect that these tables are no longer backups
DELETE FROM backup.backup_metadata 
WHERE backup_table_name IN ('prompt_output_templates', 'prompt_template_associations', 'user_profiles_v2');

-- Step 3: Grant basic permissions without assuming column structure
-- Grant access to authenticated users and service role

GRANT SELECT ON public.prompt_output_templates TO authenticated;
GRANT ALL ON public.prompt_output_templates TO service_role;

GRANT SELECT ON public.prompt_template_associations TO authenticated;
GRANT ALL ON public.prompt_template_associations TO service_role;

GRANT SELECT ON public.user_profiles_v2 TO authenticated;
GRANT ALL ON public.user_profiles_v2 TO service_role;

-- Step 4: Add comment about the restoration
COMMENT ON SCHEMA public IS 'Public schema with restored tables: prompt_output_templates, prompt_template_associations, user_profiles_v2';