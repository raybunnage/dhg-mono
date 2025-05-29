-- SQL to update command_refactor_tracking table based on google-sync-reorganization-spec.md analysis

-- Updates for existing commands
UPDATE command_refactor_tracking 
SET status = 'refactor_into_report',
    keep_or_archive = 'refactor',
    category = 'listing',
    notes = 'Refactor into: report --type unprocessed'
WHERE command_name = 'analyze-unprocessed-files';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_media',
    keep_or_archive = 'refactor',
    category = 'media',
    notes = 'Refactor into: media --assign-video-id'
WHERE command_name = 'assign-main-video-id';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_classify',
    keep_or_archive = 'refactor',
    category = 'classification',
    notes = 'Refactor into: classify with --limit option'
WHERE command_name = 'bulk-classify';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_check',
    keep_or_archive = 'refactor',
    category = 'maintenance',
    notes = 'Refactor into: check --duplicates'
WHERE command_name = 'check-duplicates';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_check',
    keep_or_archive = 'refactor',
    category = 'maintenance',
    notes = 'Refactor into: check --expert-docs'
WHERE command_name = 'check-expert-doc';

UPDATE command_refactor_tracking 
SET status = 'not_analyzed',
    keep_or_archive = 'archive',
    category = 'uncategorized',
    notes = 'Not analyzed in reorganization spec - likely old implementation'
WHERE command_name = 'classify';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_classify',
    keep_or_archive = 'refactor',
    category = 'classification',
    notes = 'Refactor into: classify --types docx,txt'
WHERE command_name = 'classify-docs-service';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_classify',
    keep_or_archive = 'refactor',
    category = 'classification',
    notes = 'Refactor into: classify --types pdf'
WHERE command_name = 'classify-pdfs';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_classify',
    keep_or_archive = 'refactor',
    category = 'classification',
    notes = 'Refactor into: classify --types pptx'
WHERE command_name = 'classify-powerpoints';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_search',
    keep_or_archive = 'refactor',
    category = 'search',
    notes = 'Refactor into: search --name pattern'
WHERE command_name = 'find-folder';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_fix',
    keep_or_archive = 'refactor',
    category = 'maintenance',
    notes = 'Refactor into: fix --orphaned-docs --type docx'
WHERE command_name = 'fix-orphaned-docx';

UPDATE command_refactor_tracking 
SET status = 'deprecated',
    keep_or_archive = 'archive',
    category = 'filter',
    notes = 'Archive - related to failed filter system'
WHERE command_name = 'get-active-filter-profile';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_search',
    keep_or_archive = 'refactor',
    category = 'search',
    notes = 'Refactor into: search --drive-id'
WHERE command_name = 'get-current-drive-id';

UPDATE command_refactor_tracking 
SET status = 'tested',
    keep_or_archive = 'keep',
    category = 'core_sync',
    notes = 'Core command - recently fixed batch processing'
WHERE command_name = 'process-new-files-enhanced';

UPDATE command_refactor_tracking 
SET status = 'tested',
    keep_or_archive = 'keep',
    category = 'media',
    notes = 'New improved version with auto-discovery'
WHERE command_name = 'refresh-main-video-id';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_fix',
    keep_or_archive = 'refactor',
    category = 'maintenance',
    notes = 'Refactor into: fix --orphaned-docs --type pdf'
WHERE command_name = 'remove-expert-docs-pdf-records';

UPDATE command_refactor_tracking 
SET status = 'evaluate',
    keep_or_archive = 'keep',
    category = 'maintenance',
    notes = 'Useful for fixing specific folder issues'
WHERE command_name = 'repair-folder';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_report',
    keep_or_archive = 'refactor',
    category = 'listing',
    notes = 'Refactor into: report --type video-assignments'
WHERE command_name = 'report-folder-video-assignments';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_report',
    keep_or_archive = 'refactor',
    category = 'listing',
    notes = 'Refactor into: report --type main-video-ids'
WHERE command_name = 'report-main-video-ids';

UPDATE command_refactor_tracking 
SET status = 'keep_as_is',
    keep_or_archive = 'keep',
    category = 'core_sync',
    notes = 'Core command - sync files from Google Drive'
WHERE command_name = 'sync';

UPDATE command_refactor_tracking 
SET status = 'deprecated',
    keep_or_archive = 'archive',
    category = 'sync',
    notes = 'Functionality moved to process-new-files-enhanced'
WHERE command_name = 'sync-expert-documents';

UPDATE command_refactor_tracking 
SET status = 'keep_as_is',
    keep_or_archive = 'keep',
    category = 'core_sync',
    notes = 'Important for large-scale operations'
WHERE command_name = 'sync-files-batch';

UPDATE command_refactor_tracking 
SET status = 'refactor_into_classify',
    keep_or_archive = 'refactor',
    category = 'classification',
    notes = 'Refactor into: classify --dry-run'
WHERE command_name = 'test-classify';

-- Insert new commands discovered from file analysis
INSERT INTO command_refactor_tracking (command_name, description, category, status, keep_or_archive, notes) VALUES
-- Core sync operations (KEEP)
('sync-all', 'Complete sync pipeline - sync files, process new, update metadata', 'core_sync', 'keep_as_is', 'keep', 'Core command - complete pipeline (recommended default)'),
('sync-files', 'Fast file existence check only (~30s)', 'core_sync', 'keep_as_is', 'keep', 'Core command - fast file check'),
('update-metadata', 'Update file size, thumbnails, names', 'core_sync', 'keep_as_is', 'keep', 'Core command - metadata updates'),
('verify-deletions', 'Verify and optionally restore deleted files', 'core_sync', 'keep_as_is', 'keep', 'Core command - deletion verification'),
('health-check', 'Verify Google Drive API connection', 'core_sync', 'keep_as_is', 'keep', 'Core command - API health check'),

-- Classification commands to refactor
('classify-docx', 'Classify DOCX files', 'classification', 'refactor_into_classify', 'refactor', 'Refactor into: classify --types docx'),
('classify-txt', 'Classify TXT files', 'classification', 'refactor_into_classify', 'refactor', 'Refactor into: classify --types txt'),
('classify-markdown', 'Classify Markdown files', 'classification', 'refactor_into_classify', 'refactor', 'Refactor into: classify --types md'),
('update-media-document-types', 'Update document types for media files', 'classification', 'refactor_into_classify', 'refactor', 'Refactor into: classify --types audio,video'),

-- Listing/reporting commands to refactor
('list-pipeline-status', 'Show pipeline status distribution', 'listing', 'refactor_into_list', 'refactor', 'Refactor into: list --status all'),
('list-google-sources', 'Basic listing of google sources', 'listing', 'refactor_into_list', 'refactor', 'Refactor into: list'),
('list-unprocessed-files', 'List files with unprocessed status', 'listing', 'refactor_into_list', 'refactor', 'Refactor into: list --status unprocessed'),
('show-expert-documents', 'Show expert document coverage', 'listing', 'refactor_into_report', 'refactor', 'Refactor into: report --type expert-coverage'),

-- Maintenance commands to refactor
('clean-orphaned-records', 'Remove orphaned expert documents', 'maintenance', 'refactor_into_fix', 'refactor', 'Refactor into: fix --orphaned-docs'),
('sources-google-integrity', 'Check data integrity', 'maintenance', 'refactor_into_check', 'refactor', 'Refactor into: check --integrity'),

-- Media specific commands
('update-main-video-id', 'Update main video ID for folders', 'media', 'deprecated', 'archive', 'Low success rate (44%), replaced by refresh-main-video-id'),

-- Filter profile commands (deprecated)
('set-active-filter-profile', 'Set active filter profile', 'filter', 'deprecated', 'archive', 'Archive - 100% failure rate in usage stats'),
('clear-active-filter-profile', 'Clear active filter profile', 'filter', 'deprecated', 'archive', 'Archive - related to failed filter system')
ON CONFLICT (command_name) DO UPDATE
SET status = EXCLUDED.status,
    keep_or_archive = EXCLUDED.keep_or_archive,
    category = EXCLUDED.category,
    notes = EXCLUDED.notes;

-- Mark all the test/debug/utility files as archive
UPDATE command_refactor_tracking
SET status = 'deprecated',
    keep_or_archive = 'archive',
    category = 'utility',
    notes = 'Archive - test/debug/utility file not part of main CLI'
WHERE command_name IN (
  'add-find-duplicates-function',
  'analyze-audio-gaps',
  'analyze-command-usage',
  'analyze-document-types-path-depth',
  'analyze-expert-documents',
  'analyze-folders-query',
  'check-concepts-of-document',
  'check-concepts',
  'check-deleted-files',
  'check-document-ids',
  'check-document-status',
  'check-document-types',
  'check-duplicate-prevention',
  'check-expert-docs',
  'check-m4a-mp4-relationship',
  'check-mp4-status',
  'check-path-depths',
  'check-pptx-files',
  'check-recent-updates',
  'check-reprocessing-status',
  'check-table-schema',
  'check-updated-fields',
  'test-active-filter',
  'test-direct-sql',
  'test-prompt-service',
  'test-query',
  'test-skip-reprocessing',
  'test-source-extensions'
);

-- Summary of the reorganization:
-- Keep as-is: 7 core commands (sync-all, sync-files, process-new-files-enhanced, update-metadata, verify-deletions, health-check, repair-folder)
-- Refactor: 18 commands into new unified commands (classify, list, report, search, fix, check, media)
-- Archive: 96+ commands (old implementations, test files, debug utilities)