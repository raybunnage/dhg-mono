-- Create table to track google sync command refactoring status
CREATE TABLE IF NOT EXISTS command_refactor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_name TEXT NOT NULL UNIQUE,
  command_type TEXT NOT NULL, -- 'existing', 'new', 'to_archive'
  current_status TEXT NOT NULL DEFAULT 'not_started', -- 'not_started', 'in_progress', 'needs_testing', 'tested', 'signed_off', 'archived'
  description TEXT,
  old_implementation_path TEXT,
  new_implementation_path TEXT,
  test_criteria TEXT[],
  test_results TEXT,
  issues_found TEXT,
  signed_off_by TEXT,
  signed_off_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_command_refactor_tracking_status ON command_refactor_tracking(current_status);
CREATE INDEX idx_command_refactor_tracking_type ON command_refactor_tracking(command_type);

-- Add comment to explain the table
COMMENT ON TABLE command_refactor_tracking IS 'Temporary table to track the refactoring status of google sync CLI commands during the reorganization project';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_command_refactor_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_command_refactor_tracking_updated_at
  BEFORE UPDATE ON command_refactor_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_command_refactor_tracking_updated_at();

-- Insert initial commands based on the google-sync-cli.sh help text
INSERT INTO command_refactor_tracking (command_name, command_type, description, test_criteria) VALUES
  -- File Management Commands
  ('sync', 'existing', 'Sync files from Google Drive to the database', ARRAY[
    'Correctly syncs new files',
    'Updates existing files',
    'Handles deletions properly',
    'Respects active filter'
  ]),
  ('find-folder', 'existing', 'Find a folder in Google Drive by name or partial name', ARRAY[
    'Finds folders by exact name',
    'Finds folders by partial name',
    'Returns correct metadata'
  ]),
  ('get-current-drive-id', 'existing', 'Get the current drive_id for a file in Google Drive', ARRAY[
    'Returns correct drive_id',
    'Handles non-existent files',
    'Works with service account'
  ]),
  ('sync-files-batch', 'existing', 'Process syncing in batches (calls sync-files internally)', ARRAY[
    'Processes correct batch size',
    'Handles errors gracefully',
    'Completes all batches'
  ]),
  ('process-new-files-enhanced', 'existing', 'Find and process new files without expert_documents', ARRAY[
    'Correctly identifies new files',
    'Creates expert documents',
    'Assigns main_video_id',
    'Handles batch processing for large sets'
  ]),
  
  -- Classification Commands
  ('classify', 'existing', 'Classify documents by type (general document classification)', ARRAY[
    'Correctly classifies document types',
    'Updates database records',
    'Handles errors gracefully'
  ]),
  ('test-classify', 'existing', 'Test classification without updating the database', ARRAY[
    'Returns classification results',
    'Does not update database',
    'Shows reasoning'
  ]),
  ('classify-docs-service', 'existing', 'Classify DOCX/TXT files using shared DocumentClassificationService', ARRAY[
    'Classifies DOCX files',
    'Classifies TXT files',
    'Uses correct AI prompts'
  ]),
  ('classify-pdfs', 'existing', 'Classify PDF files using shared classification service', ARRAY[
    'Extracts PDF content',
    'Classifies correctly',
    'Handles large PDFs'
  ]),
  ('classify-powerpoints', 'existing', 'Classify PowerPoint presentations', ARRAY[
    'Extracts slide content',
    'Classifies presentations',
    'Captures metadata'
  ]),
  ('bulk-classify', 'existing', 'Classify multiple unclassified files by type', ARRAY[
    'Processes multiple files',
    'Separates by file type',
    'Provides summary report'
  ]),
  
  -- Maintenance Commands
  ('check-duplicates', 'existing', 'Check for duplicate files in sources_google', ARRAY[
    'Identifies duplicates by name',
    'Identifies duplicates by drive_id',
    'Verifies current existence'
  ]),
  ('check-expert-doc', 'existing', 'Check the most recent expert document for proper content extraction', ARRAY[
    'Shows expert document details',
    'Displays extracted content',
    'Shows classification info'
  ]),
  ('fix-orphaned-docx', 'existing', 'Fix DOCX files with document_type_id but no expert_documents', ARRAY[
    'Identifies orphaned files',
    'Creates missing expert documents',
    'Maintains data integrity'
  ]),
  ('remove-expert-docs-pdf-records', 'existing', 'Remove expert_documents for PDF files with null document_type_id', ARRAY[
    'Identifies target records',
    'Safely removes records',
    'Reports results'
  ]),
  ('sync-expert-documents', 'existing', 'Sync sources_google files with expert_documents records', ARRAY[
    'Creates missing expert documents',
    'Handles all file types',
    'Respects skip criteria'
  ]),
  ('assign-main-video-id', 'existing', 'Assign main_video_id to all nested folders/files', ARRAY[
    'Updates all nested items',
    'Handles folder hierarchy',
    'Preserves existing data'
  ]),
  ('refresh-main-video-id', 'new', 'Find MP4 in folder and auto-update main_video_id', ARRAY[
    'Finds MP4 automatically',
    'Updates all nested items',
    'Handles orphaned references'
  ]),
  ('report-folder-video-assignments', 'existing', 'Generate report showing main_video_id assignments', ARRAY[
    'Shows complete hierarchy',
    'Displays video assignments',
    'Identifies issues'
  ]),
  
  -- Reporting Commands
  ('report-main-video-ids', 'existing', 'Generate a report of main_video_id assignments', ARRAY[
    'Shows all assignments',
    'Groups by folder',
    'Identifies missing videos'
  ]),
  ('analyze-unprocessed-files', 'existing', 'Analyze and report on unprocessed files', ARRAY[
    'Identifies unprocessed files',
    'Groups by type',
    'Shows processing status'
  ]),
  
  -- Utility Commands  
  ('get-active-filter-profile', 'existing', 'Display the current active filter profile', ARRAY[
    'Shows active filter',
    'Displays filter details',
    'Shows affected folders'
  ]),
  ('repair-folder', 'existing', 'Repair a high-level folder by re-syncing', ARRAY[
    'Deletes old records',
    'Re-syncs from Drive',
    'Recreates expert documents'
  ])
ON CONFLICT (command_name) DO NOTHING;

-- Add RLS policies (even for temporary tables, good practice)
ALTER TABLE command_refactor_tracking ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (since it's a dev tool)
CREATE POLICY "Allow all operations on command_refactor_tracking" ON command_refactor_tracking
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create a view for easy status overview
CREATE OR REPLACE VIEW command_refactor_status_summary AS
SELECT 
  command_type,
  current_status,
  COUNT(*) as count
FROM command_refactor_tracking
GROUP BY command_type, current_status
ORDER BY command_type, current_status;

-- Create a view for commands needing attention
CREATE OR REPLACE VIEW commands_needing_attention AS
SELECT 
  command_name,
  command_type,
  current_status,
  description,
  CASE 
    WHEN current_status = 'not_started' THEN 1
    WHEN current_status = 'in_progress' THEN 2
    WHEN current_status = 'needs_testing' THEN 3
    ELSE 4
  END as priority
FROM command_refactor_tracking
WHERE current_status NOT IN ('signed_off', 'archived')
ORDER BY priority, command_name;