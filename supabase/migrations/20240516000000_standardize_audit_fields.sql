-- Migration to standardize audit fields (created_at, updated_at, created_by, updated_by)
-- across all tables in the database

-- Step 1: Create or replace standardized trigger functions

-- Function to handle timestamps (created_at, updated_at)
CREATE OR REPLACE FUNCTION public.handle_audit_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = COALESCE(NEW.created_at, now());
    NEW.updated_at = COALESCE(NEW.updated_at, now());
  ELSIF TG_OP = 'UPDATE' THEN
    -- Don't change created_at on updates
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle user tracking (created_by, updated_by)
CREATE OR REPLACE FUNCTION public.handle_audit_users()
RETURNS TRIGGER AS $$
DECLARE
  auth_user_id UUID;
BEGIN
  -- Get current user ID from auth.uid() or fall back to a system user ID
  auth_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = COALESCE(NEW.created_by, auth_user_id);
    NEW.updated_by = COALESCE(NEW.updated_by, auth_user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Don't change created_by on updates
    NEW.updated_by = auth_user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION public.table_exists(p_schema_name text, p_table_name text)
RETURNS boolean AS $$
DECLARE
  exists_val boolean;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = p_schema_name AND table_name = p_table_name
  ) INTO exists_val;
  RETURN exists_val;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Add missing columns to tables

-- ai_processing_attempts
DO $$ BEGIN IF public.table_exists('public', 'ai_processing_attempts') THEN
ALTER TABLE public.ai_processing_attempts 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- audio_processing_stages
DO $$ BEGIN IF public.table_exists('public', 'audio_processing_stages') THEN
ALTER TABLE public.audio_processing_stages 
  ALTER COLUMN created_at SET DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- audio_processor_steps
DO $$ BEGIN IF public.table_exists('public', 'audio_processor_steps') THEN
ALTER TABLE public.audio_processor_steps 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- audio_segments
DO $$ BEGIN IF public.table_exists('public', 'audio_segments') THEN
ALTER TABLE public.audio_segments 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- processing_batches
DO $$ BEGIN IF public.table_exists('public', 'processing_batches') THEN
ALTER TABLE public.processing_batches 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- speaker_profiles
DO $$ BEGIN IF public.table_exists('public', 'speaker_profiles') THEN
ALTER TABLE public.speaker_profiles 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- tagged_items
DO $$ BEGIN IF public.table_exists('public', 'tagged_items') THEN
ALTER TABLE public.tagged_items 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- tags
DO $$ BEGIN IF public.table_exists('public', 'tags') THEN
ALTER TABLE public.tags 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- transcription_feedback
DO $$ BEGIN IF public.table_exists('public', 'transcription_feedback') THEN
ALTER TABLE public.transcription_feedback 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- user_annotations
DO $$ BEGIN IF public.table_exists('public', 'user_annotations') THEN
ALTER TABLE public.user_annotations 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- presentation_assets
DO $$ BEGIN IF public.table_exists('public', 'presentation_assets') THEN
ALTER TABLE public.presentation_assets 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;
END IF; END $$;

-- Step 3: Drop existing timestamp triggers to avoid conflicts
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN 
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_name IN ('set_updated_at', 'handle_updated_at', 'set_timestamps', 'update_updated_at_column')
      AND trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', 
                  trigger_rec.trigger_name, 
                  'public', 
                  trigger_rec.event_object_table);
  END LOOP;
END $$;

-- Step 4: Create new standardized triggers for all tables

-- Function to create audit triggers for a table
CREATE OR REPLACE FUNCTION public.create_audit_triggers(p_table_name text)
RETURNS void AS $$
BEGIN
  -- Check if the table has the required columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name AND column_name IN ('created_at', 'updated_at')
  ) THEN
    -- Create timestamp trigger
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_audit_timestamps ON public.%I;
      CREATE TRIGGER set_audit_timestamps
      BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.handle_audit_timestamps();
    ', p_table_name, p_table_name);
  END IF;
  
  -- Check if the table has user tracking columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name AND column_name IN ('created_by', 'updated_by')
  ) THEN
    -- Create user tracking trigger
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_audit_users ON public.%I;
      CREATE TRIGGER set_audit_users
      BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.handle_audit_users();
    ', p_table_name, p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
DO $$
DECLARE
  table_rec RECORD;
BEGIN
  FOR table_rec IN 
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma_%'
  LOOP
    PERFORM public.create_audit_triggers(table_rec.table_name);
  END LOOP;
END $$;

-- Step 5: Create RLS policies for audit fields if needed
DO $$ 
DECLARE
  table_rec RECORD;
BEGIN
  FOR table_rec IN 
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', 
                  table_rec.table_name);
  END LOOP;
END $$;

-- Create default policies (adjust as needed for your security requirements)
DO $$
DECLARE
  table_rec RECORD;
BEGIN
  FOR table_rec IN 
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma_%'
  LOOP
    -- Only create policies if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = table_rec.table_name 
      AND policyname = 'enable_select_for_authenticated_users'
    ) THEN
      EXECUTE format('
        CREATE POLICY enable_select_for_authenticated_users ON public.%I
        FOR SELECT USING (auth.role() = ''authenticated'');
      ', table_rec.table_name);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = table_rec.table_name 
      AND policyname = 'enable_insert_for_authenticated_users'
    ) THEN
      EXECUTE format('
        CREATE POLICY enable_insert_for_authenticated_users ON public.%I
        FOR INSERT WITH CHECK (auth.role() = ''authenticated'');
      ', table_rec.table_name);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = table_rec.table_name 
      AND policyname = 'enable_update_for_authenticated_users'
    ) THEN
      EXECUTE format('
        CREATE POLICY enable_update_for_authenticated_users ON public.%I
        FOR UPDATE USING (auth.role() = ''authenticated'');
      ', table_rec.table_name);
    END IF;
  END LOOP;
END $$;

-- Step 6: Clean up
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.table_exists() CASCADE; 