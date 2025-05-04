-- Verify sources_google has all required fields
DO $$
BEGIN
  -- Check for drive_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sources_google' 
    AND column_name = 'drive_id'
  ) THEN
    ALTER TABLE public.sources_google ADD COLUMN drive_id TEXT;
  END IF;

  -- Check for web_view_link
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sources_google' 
    AND column_name = 'web_view_link'
  ) THEN
    ALTER TABLE public.sources_google ADD COLUMN web_view_link TEXT;
  END IF;

  -- Check for parent_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sources_google' 
    AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.sources_google ADD COLUMN parent_id TEXT;
  END IF;
  
  -- Check for modified_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sources_google' 
    AND column_name = 'modified_time'
  ) THEN
    ALTER TABLE public.sources_google ADD COLUMN modified_time TIMESTAMPTZ;
  END IF;
  
  -- Check for size
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sources_google' 
    AND column_name = 'size'
  ) THEN
    ALTER TABLE public.sources_google ADD COLUMN size BIGINT;
  END IF;
END
$$; 