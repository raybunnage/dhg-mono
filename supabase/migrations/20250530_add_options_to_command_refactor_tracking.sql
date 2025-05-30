-- Migration: Add options column to command_refactor_tracking and populate for new commands
-- Description: Add command options to help understand what each command will do

-- Add options column to store command-line options
ALTER TABLE command_refactor_tracking 
ADD COLUMN IF NOT EXISTS options JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN command_refactor_tracking.options IS 'Command-line options available for this command, stored as JSON object with option name as key and description as value';

-- Update the new commands with their options
UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--types', 'File types to process (pdf,docx,pptx,txt,md,audio,video)',
  '--limit', 'Number of files to process',
  '--concurrency', 'Parallel processing limit (default: 3)',
  '--force', 'Force reclassification of already classified files',
  '--dry-run', 'Preview changes without applying them',
  '--verbose', 'Show detailed output during processing',
  '--filter-profile', 'Use specific filter profile by name',
  '--status', 'Process only files with specific pipeline status'
),
updated_at = NOW()
WHERE command_name = 'classify';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--status', 'Filter by pipeline status (unprocessed, processed, etc.)',
  '--type', 'Filter by file types (pdf,docx)',
  '--recent', 'Show recently modified files (e.g., 7d, 30d)',
  '--expert', 'Filter by expert name',
  '--has-expert-doc', 'Only show files with expert documents',
  '--missing-expert-doc', 'Only show files without expert documents',
  '--format', 'Output format (table|json|csv)',
  '--limit', 'Limit number of results (default: 50)',
  '--sort', 'Sort order (name|date|type)'
),
updated_at = NOW()
WHERE command_name = 'list';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--type', 'Report type (pipeline-status|expert-coverage|classification|duplicates|performance)',
  '--format', 'Output format (markdown|html)',
  '--output', 'Save report to file',
  '--date-range', 'Date range for metrics (e.g., 7d, 30d)',
  '--filter-profile', 'Use specific filter profile for data'
),
updated_at = NOW()
WHERE command_name = 'report';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--name', 'Search by name (supports wildcards)',
  '--path', 'Search by path pattern',
  '--drive-id', 'Find by specific Google Drive ID',
  '--content', 'Search within document content',
  '--expert', 'Search by associated expert name',
  '--limit', 'Limit search results',
  '--format', 'Output format (table|json)'
),
updated_at = NOW()
WHERE command_name = 'search';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--orphaned-docs', 'Remove orphaned expert documents',
  '--bad-folders', 'Fix incorrect folder document types',
  '--duplicates', 'Resolve duplicate records',
  '--missing-metadata', 'Populate missing metadata fields',
  '--reprocessing-status', 'Clear stuck reprocessing flags',
  '--dry-run', 'Preview changes without applying them',
  '--limit', 'Limit number of fixes to apply'
),
updated_at = NOW()
WHERE command_name = 'fix';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--integrity', 'Perform full data integrity check',
  '--duplicates', 'Check for duplicate records',
  '--orphans', 'Check for orphaned records',
  '--consistency', 'Check data consistency across tables',
  '--performance', 'Check system performance metrics',
  '--format', 'Output detail level (detailed|summary)',
  '--output', 'Save check results to file'
),
updated_at = NOW()
WHERE command_name = 'check';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--reprocess', 'Mark files for reprocessing',
  '--types', 'Filter by file types (pdf,docx)',
  '--ids', 'Specific file IDs (comma-separated)',
  '--where', 'SQL-like condition for filtering',
  '--reason', 'Reason for marking (stored in metadata)',
  '--dry-run', 'Preview what would be marked'
),
updated_at = NOW()
WHERE command_name = 'mark';

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--extract-audio', 'Extract audio from video files',
  '--generate-thumbnails', 'Generate video thumbnails',
  '--update-duration', 'Update media duration metadata',
  '--link-transcripts', 'Link media files to transcript documents',
  '--batch-id', 'Process specific batch by ID',
  '--format', 'Output audio format (m4a|mp3)',
  '--quality', 'Audio quality setting'
),
updated_at = NOW()
WHERE command_name = 'media';

-- Also update some existing commands that might benefit from options documentation
UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--no-options', 'Complete sync pipeline with all steps'
),
updated_at = NOW()
WHERE command_name = 'sync-all' AND options IS NULL;

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--dry-run', 'Show what would be synced without making changes',
  '--max-depth', 'Maximum folder depth to traverse (default: 6)',
  '--verbose', 'Show detailed logs',
  '--skip-deletions', 'Skip marking files as deleted'
),
updated_at = NOW()
WHERE command_name = 'sync-files' AND options IS NULL;

UPDATE command_refactor_tracking 
SET options = jsonb_build_object(
  '--verbose', 'Show detailed file hierarchy',
  '--limit', 'Limit number of files to process',
  '--dry-run', 'Preview without creating expert documents'
),
updated_at = NOW()
WHERE command_name = 'process-new-files-enhanced' AND options IS NULL;