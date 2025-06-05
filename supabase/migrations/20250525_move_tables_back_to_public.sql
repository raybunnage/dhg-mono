-- Migration: Move 3 tables back to public schema
-- Description: Move prompt_output_templates, prompt_template_associations, and user_profiles_v2 back to public schema

-- Step 1: Check if tables exist in backup schema and move them to public
-- Handle dependencies carefully by moving one at a time

-- Move prompt_output_templates from backup to public
DO $$ 
BEGIN
    -- Check if table exists in backup schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup' AND table_name = 'prompt_output_templates') THEN
        -- Check if table already exists in public schema
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_output_templates') THEN
            -- Move the table
            ALTER TABLE backup.prompt_output_templates SET SCHEMA public;
            RAISE NOTICE 'Moved prompt_output_templates from backup to public schema';
        ELSE
            RAISE NOTICE 'prompt_output_templates already exists in public schema';
        END IF;
    ELSE
        RAISE NOTICE 'prompt_output_templates not found in backup schema';
    END IF;
END $$;

-- Move prompt_template_associations from backup to public
DO $$ 
BEGIN
    -- Check if table exists in backup schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup' AND table_name = 'prompt_template_associations') THEN
        -- Check if table already exists in public schema
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_template_associations') THEN
            -- Move the table
            ALTER TABLE backup.prompt_template_associations SET SCHEMA public;
            RAISE NOTICE 'Moved prompt_template_associations from backup to public schema';
        ELSE
            RAISE NOTICE 'prompt_template_associations already exists in public schema';
        END IF;
    ELSE
        RAISE NOTICE 'prompt_template_associations not found in backup schema';
    END IF;
END $$;

-- Move user_profiles_v2 from backup to public
DO $$ 
BEGIN
    -- Check if table exists in backup schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup' AND table_name = 'user_profiles_v2') THEN
        -- Check if table already exists in public schema
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles_v2') THEN
            -- Move the table
            ALTER TABLE backup.user_profiles_v2 SET SCHEMA public;
            RAISE NOTICE 'Moved user_profiles_v2 from backup to public schema';
        ELSE
            RAISE NOTICE 'user_profiles_v2 already exists in public schema';
        END IF;
    ELSE
        RAISE NOTICE 'user_profiles_v2 not found in backup schema';
    END IF;
END $$;

-- Step 2: Update backup_metadata to reflect that these tables are no longer backups
-- Remove these tables from backup metadata since they're active tables again
DELETE FROM backup.backup_metadata 
WHERE backup_table_name IN ('prompt_output_templates', 'prompt_template_associations', 'user_profiles_v2');

-- Step 3: Grant appropriate permissions to moved tables
-- Ensure the tables have proper RLS and permissions in public schema

-- For prompt_output_templates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_output_templates') THEN
        -- Enable RLS
        ALTER TABLE public.prompt_output_templates ENABLE ROW LEVEL SECURITY;
        
        -- Create basic policies if they don't exist
        DROP POLICY IF EXISTS "Users can view prompt output templates" ON public.prompt_output_templates;
        CREATE POLICY "Users can view prompt output templates"
            ON public.prompt_output_templates FOR SELECT
            TO authenticated
            USING (true);
            
        DROP POLICY IF EXISTS "Service role can manage prompt output templates" ON public.prompt_output_templates;
        CREATE POLICY "Service role can manage prompt output templates"
            ON public.prompt_output_templates FOR ALL
            TO service_role
            USING (true);
    END IF;
END $$;

-- For prompt_template_associations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_template_associations') THEN
        -- Enable RLS
        ALTER TABLE public.prompt_template_associations ENABLE ROW LEVEL SECURITY;
        
        -- Create basic policies if they don't exist
        DROP POLICY IF EXISTS "Users can view prompt template associations" ON public.prompt_template_associations;
        CREATE POLICY "Users can view prompt template associations"
            ON public.prompt_template_associations FOR SELECT
            TO authenticated
            USING (true);
            
        DROP POLICY IF EXISTS "Service role can manage prompt template associations" ON public.prompt_template_associations;
        CREATE POLICY "Service role can manage prompt template associations"
            ON public.prompt_template_associations FOR ALL
            TO service_role
            USING (true);
    END IF;
END $$;

-- For user_profiles_v2
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles_v2') THEN
        -- Enable RLS
        ALTER TABLE public.user_profiles_v2 ENABLE ROW LEVEL SECURITY;
        
        -- Create basic policies if they don't exist
        DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles_v2;
        CREATE POLICY "Users can view own profile"
            ON public.user_profiles_v2 FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
            
        DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles_v2;
        CREATE POLICY "Users can update own profile"
            ON public.user_profiles_v2 FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id);
            
        DROP POLICY IF EXISTS "Service role can manage user profiles" ON public.user_profiles_v2;
        CREATE POLICY "Service role can manage user profiles"
            ON public.user_profiles_v2 FOR ALL
            TO service_role
            USING (true);
    END IF;
END $$;

-- Step 4: Add comment about the restoration
COMMENT ON SCHEMA public IS 'Public schema with restored tables: prompt_output_templates, prompt_template_associations, user_profiles_v2';