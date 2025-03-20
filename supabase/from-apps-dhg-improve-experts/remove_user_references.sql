-- SQL to remove created_by and updated_by from all tables, triggers, and functions

-- Disable trigger first to prevent errors during column dropping
DROP TRIGGER IF EXISTS validate_sources_google_users ON public.sources_google;

-- Drop functions that reference these columns
DROP FUNCTION IF EXISTS public.validate_user_references;
DROP FUNCTION IF EXISTS public.fix_expert_documents_nulls;
DROP FUNCTION IF EXISTS public.admin_fix_audio_processing_configs;
DROP FUNCTION IF EXISTS public.transfer_temp_experts_to_experts;

-- List of common tables likely to have these columns
DO $$
DECLARE
  tablename text;
BEGIN
  FOR tablename IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    -- Check if created_by exists in this table
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = tablename AND column_name = 'created_by'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN created_by', tablename);
      RAISE NOTICE 'Dropped created_by from %', tablename;
    END IF;
    
    -- Check if updated_by exists in this table
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = tablename AND column_name = 'updated_by'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN updated_by', tablename);
      RAISE NOTICE 'Dropped updated_by from %', tablename;
    END IF;
  END LOOP;
END$$;

-- Finally, update any remaining triggers that might reference these columns
-- This requires customization based on your specific triggers

-- Note: After running this, you should also remove any code that tries to
-- set these fields throughout your application.

