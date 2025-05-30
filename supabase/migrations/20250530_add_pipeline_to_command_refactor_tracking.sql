-- Migration: Add pipeline field to command_refactor_tracking table
-- Description: Add a field to track which CLI pipeline the command belongs to

-- Add the pipeline column to command_refactor_tracking (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'command_refactor_tracking' 
    AND column_name = 'pipeline'
  ) THEN
    ALTER TABLE command_refactor_tracking
    ADD COLUMN pipeline text;
  END IF;
END $$;

-- Add comment to describe the column
COMMENT ON COLUMN command_refactor_tracking.pipeline IS 'The CLI pipeline this command belongs to (e.g., google_sync, document, media-processing, etc.)';

-- Update existing records based on their new_implementation_path or command context
UPDATE command_refactor_tracking
SET pipeline = CASE
  -- Google sync commands (based on description and command names)
  WHEN command_name IN ('sync', 'find-folder', 'get-current-drive-id', 'check-duplicates', 'list', 'report', 'search', 'validate', 'fix', 'health-check', 'stats', 'import', 'export') THEN 'google_sync'
  
  -- Classification commands
  WHEN command_name LIKE 'classify%' OR command_name LIKE '%classification%' THEN 'document'
  
  -- Document type commands
  WHEN command_name LIKE '%document-type%' OR command_name LIKE 'update-doc-types%' THEN 'document_types'
  
  -- Media processing commands
  WHEN command_name LIKE '%media%' OR command_name LIKE '%audio%' OR command_name LIKE '%video%' THEN 'media-processing'
  
  -- Analysis commands (these are being archived)
  WHEN command_name LIKE 'analyze-%' THEN 'analysis'
  
  -- Script management commands
  WHEN command_name LIKE '%script%' THEN 'scripts'
  
  -- Presentation commands
  WHEN command_name LIKE '%presentation%' THEN 'presentations'
  
  -- Default to google_sync for any unmatched commands (since this is primarily for google sync refactoring)
  ELSE 'google_sync'
END
WHERE pipeline IS NULL;

-- Create an index on pipeline for faster filtering (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_command_refactor_tracking_pipeline ON command_refactor_tracking(pipeline);

-- Update the command_refactor_status_summary view to include pipeline
-- First drop the existing view if it exists
DROP VIEW IF EXISTS command_refactor_status_summary;

-- Recreate the view with pipeline included
CREATE VIEW command_refactor_status_summary AS
SELECT 
  pipeline,
  command_type,
  current_status,
  COUNT(*) as count
FROM command_refactor_tracking
GROUP BY pipeline, command_type, current_status
ORDER BY pipeline, command_type, current_status;