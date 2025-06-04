-- Create unified media processing status table
-- This table tracks the complete lifecycle of media processing

CREATE TABLE IF NOT EXISTS media_processing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- File identification
  source_id UUID REFERENCES google_sources(id) ON DELETE CASCADE,
  expert_document_id UUID REFERENCES google_expert_documents(id) ON DELETE CASCADE,
  drive_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT valid_status CHECK (status IN (
    'pending',           -- File identified, not yet processed
    'downloading',       -- Downloading from Google Drive
    'converting',        -- Converting MP4 to M4A
    'transcribing',      -- Transcribing audio
    'summarizing',       -- Generating AI summary
    'uploading',         -- Uploading M4A back to Drive
    'completed',         -- All processing complete
    'failed',           -- Processing failed
    'skipped'           -- Skipped (too large, corrupted, etc)
  )),
  
  -- Processing details
  mp4_path TEXT,              -- Local path to MP4 file
  m4a_path TEXT,              -- Local path to M4A file
  transcript_path TEXT,       -- Local path to transcript
  summary_path TEXT,          -- Local path to summary
  
  -- Google Drive upload info
  m4a_drive_id TEXT,          -- Drive ID of uploaded M4A file
  m4a_uploaded_at TIMESTAMPTZ,
  
  -- Processing metadata
  file_size_bytes BIGINT,
  duration_seconds INTEGER,
  processing_model TEXT,      -- Whisper model used
  processing_accelerator TEXT, -- GPU accelerator used
  
  -- Error tracking
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Ensure unique processing per source file
  CONSTRAINT unique_source_processing UNIQUE (source_id)
);

-- Create indexes for common queries
CREATE INDEX idx_media_processing_status_state ON media_processing_status(status);
CREATE INDEX idx_media_processing_status_source ON media_processing_status(source_id);
CREATE INDEX idx_media_processing_status_document ON media_processing_status(expert_document_id);
CREATE INDEX idx_media_processing_status_created ON media_processing_status(created_at);
CREATE INDEX idx_media_processing_status_drive_id ON media_processing_status(drive_id);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_media_processing_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_processing_status_updated_at
  BEFORE UPDATE ON media_processing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_media_processing_status_updated_at();

-- Create function to get processing statistics
CREATE OR REPLACE FUNCTION get_media_processing_stats()
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  avg_duration_seconds NUMERIC,
  total_size_gb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mps.status,
    COUNT(*)::BIGINT as count,
    AVG(EXTRACT(EPOCH FROM (mps.completed_at - mps.started_at)))::NUMERIC as avg_duration_seconds,
    (SUM(mps.file_size_bytes) / 1073741824.0)::NUMERIC as total_size_gb
  FROM media_processing_status mps
  GROUP BY mps.status
  ORDER BY 
    CASE mps.status
      WHEN 'pending' THEN 1
      WHEN 'downloading' THEN 2
      WHEN 'converting' THEN 3
      WHEN 'transcribing' THEN 4
      WHEN 'summarizing' THEN 5
      WHEN 'uploading' THEN 6
      WHEN 'completed' THEN 7
      WHEN 'failed' THEN 8
      WHEN 'skipped' THEN 9
    END;
END;
$$ LANGUAGE plpgsql;

-- Create function to update processing status with validation
CREATE OR REPLACE FUNCTION update_media_processing_status(
  p_source_id UUID,
  p_new_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_valid_transition BOOLEAN;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM media_processing_status
  WHERE source_id = p_source_id;
  
  -- Validate status transition
  v_valid_transition := CASE
    WHEN v_current_status = 'pending' AND p_new_status IN ('downloading', 'converting', 'skipped', 'failed') THEN TRUE
    WHEN v_current_status = 'downloading' AND p_new_status IN ('converting', 'failed') THEN TRUE
    WHEN v_current_status = 'converting' AND p_new_status IN ('transcribing', 'failed') THEN TRUE
    WHEN v_current_status = 'transcribing' AND p_new_status IN ('summarizing', 'uploading', 'completed', 'failed') THEN TRUE
    WHEN v_current_status = 'summarizing' AND p_new_status IN ('uploading', 'completed', 'failed') THEN TRUE
    WHEN v_current_status = 'uploading' AND p_new_status IN ('completed', 'failed') THEN TRUE
    WHEN v_current_status = 'failed' AND p_new_status IN ('pending', 'downloading') THEN TRUE -- Allow retry
    ELSE FALSE
  END;
  
  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
  END IF;
  
  -- Update the status
  UPDATE media_processing_status
  SET 
    status = p_new_status,
    started_at = CASE 
      WHEN p_new_status = 'downloading' AND started_at IS NULL THEN CURRENT_TIMESTAMP 
      ELSE started_at 
    END,
    completed_at = CASE 
      WHEN p_new_status = 'completed' THEN CURRENT_TIMESTAMP 
      ELSE completed_at 
    END,
    error_message = CASE 
      WHEN p_new_status = 'failed' THEN p_error_message 
      ELSE error_message 
    END,
    error_count = CASE 
      WHEN p_new_status = 'failed' THEN error_count + 1 
      ELSE error_count 
    END,
    last_error_at = CASE 
      WHEN p_new_status = 'failed' THEN CURRENT_TIMESTAMP 
      ELSE last_error_at 
    END
  WHERE source_id = p_source_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE media_processing_status ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all records
CREATE POLICY "media_processing_status_read_policy" ON media_processing_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role to insert/update/delete
CREATE POLICY "media_processing_status_write_policy" ON media_processing_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE media_processing_status IS 'Unified tracking table for media processing pipeline';
COMMENT ON COLUMN media_processing_status.status IS 'Current processing status of the media file';
COMMENT ON COLUMN media_processing_status.m4a_drive_id IS 'Google Drive ID of the uploaded M4A file';
COMMENT ON FUNCTION get_media_processing_stats() IS 'Get statistics about media processing by status';
COMMENT ON FUNCTION update_media_processing_status(UUID, TEXT, TEXT) IS 'Update media processing status with validation';