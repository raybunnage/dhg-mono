-- Create sync_history table
CREATE TABLE IF NOT EXISTS public.sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id TEXT NOT NULL,
  folder_name TEXT NOT NULL DEFAULT 'Google Drive',
  status TEXT NOT NULL DEFAULT 'pending',
  items_processed INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  -- RLS policies will be applied later as needed
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'completed_with_errors', 'failed'))
);

-- Add comment
COMMENT ON TABLE public.sync_history IS 'Records of Google Drive sync operations';

-- Make sure sources_google has a sync_id field if it doesn't already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sources_google' 
    AND column_name = 'sync_id'
  ) THEN
    ALTER TABLE public.sources_google ADD COLUMN sync_id UUID REFERENCES public.sync_history(id);
  END IF;
END
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_history_folder_id ON public.sync_history(folder_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON public.sync_history(status);
CREATE INDEX IF NOT EXISTS idx_sync_history_timestamp ON public.sync_history(timestamp);

-- Grant necessary permissions
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to select
CREATE POLICY select_sync_history ON public.sync_history
  FOR SELECT USING (true);

-- Create policy for authenticated users to insert
CREATE POLICY insert_sync_history ON public.sync_history
  FOR INSERT WITH CHECK (true);

-- Create policy for authenticated users to update their own records
CREATE POLICY update_sync_history ON public.sync_history
  FOR UPDATE USING (
    created_by = auth.uid() OR created_by IS NULL
  ); 