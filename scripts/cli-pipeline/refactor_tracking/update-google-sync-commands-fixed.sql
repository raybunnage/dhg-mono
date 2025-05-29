-- SQL to update command_refactor_tracking table based on google-sync-reorganization-spec.md analysis
-- Using correct column names: current_status, notes

-- Updates for existing commands
UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: report --type unprocessed'
WHERE command_name = 'analyze-unprocessed-files';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: media --assign-video-id'
WHERE command_name = 'assign-main-video-id';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: classify with --limit option'
WHERE command_name = 'bulk-classify';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: check --duplicates'
WHERE command_name = 'check-duplicates';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: check --expert-docs'
WHERE command_name = 'check-expert-doc';

UPDATE command_refactor_tracking 
SET current_status = 'deprecated',
    notes = 'Archive - old implementation, not part of main CLI'
WHERE command_name = 'classify';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: classify --types docx,txt'
WHERE command_name = 'classify-docs-service';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: classify --types pdf'
WHERE command_name = 'classify-pdfs';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: classify --types pptx'
WHERE command_name = 'classify-powerpoints';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: search --name pattern'
WHERE command_name = 'find-folder';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: fix --orphaned-docs --type docx'
WHERE command_name = 'fix-orphaned-docx';

UPDATE command_refactor_tracking 
SET current_status = 'deprecated',
    notes = 'Archive - related to failed filter system (100% failure rate)'
WHERE command_name = 'get-active-filter-profile';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: search --drive-id'
WHERE command_name = 'get-current-drive-id';

UPDATE command_refactor_tracking 
SET current_status = 'tested',
    notes = 'KEEP - Core command - recently fixed batch processing issue'
WHERE command_name = 'process-new-files-enhanced';

UPDATE command_refactor_tracking 
SET current_status = 'tested',
    notes = 'KEEP - New improved version with auto-discovery, replaces update-main-video-id'
WHERE command_name = 'refresh-main-video-id';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: fix --orphaned-docs --type pdf'
WHERE command_name = 'remove-expert-docs-pdf-records';

UPDATE command_refactor_tracking 
SET current_status = 'in_progress',
    notes = 'KEEP - Useful for fixing specific folder issues, needs evaluation'
WHERE command_name = 'repair-folder';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: report --type video-assignments'
WHERE command_name = 'report-folder-video-assignments';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: report --type main-video-ids'
WHERE command_name = 'report-main-video-ids';

UPDATE command_refactor_tracking 
SET current_status = 'completed',
    notes = 'KEEP - Core command - sync files from Google Drive'
WHERE command_name = 'sync';

UPDATE command_refactor_tracking 
SET current_status = 'deprecated',
    notes = 'Archive - functionality moved to process-new-files-enhanced'
WHERE command_name = 'sync-expert-documents';

UPDATE command_refactor_tracking 
SET current_status = 'completed',
    notes = 'KEEP - Important for large-scale batch operations'
WHERE command_name = 'sync-files-batch';

UPDATE command_refactor_tracking 
SET current_status = 'refactor_needed',
    notes = 'Refactor into: classify --dry-run'
WHERE command_name = 'test-classify';

-- Insert new commands discovered from file analysis
-- First, let's insert the core commands that should be kept
INSERT INTO command_refactor_tracking (command_name, description, command_type, current_status, notes) VALUES
('sync-all', 'Complete sync pipeline - sync files, process new, update metadata', 'sync', 'completed', 'KEEP - Core command - complete pipeline (recommended default)'),
('sync-files', 'Fast file existence check only (~30s)', 'sync', 'completed', 'KEEP - Core command - fast file check'),
('update-metadata', 'Update file size, thumbnails, names', 'sync', 'completed', 'KEEP - Core command - metadata updates'),
('verify-deletions', 'Verify and optionally restore deleted files', 'sync', 'completed', 'KEEP - Core command - deletion verification'),
('health-check', 'Verify Google Drive API connection', 'sync', 'completed', 'KEEP - Core command - API health check')
ON CONFLICT (command_name) DO UPDATE
SET current_status = EXCLUDED.current_status,
    notes = EXCLUDED.notes;

-- Insert classification commands that need refactoring
INSERT INTO command_refactor_tracking (command_name, description, command_type, current_status, notes) VALUES
('classify-docx', 'Classify DOCX files', 'classification', 'refactor_needed', 'Refactor into: classify --types docx'),
('classify-txt', 'Classify TXT files', 'classification', 'refactor_needed', 'Refactor into: classify --types txt'),
('classify-markdown', 'Classify Markdown files', 'classification', 'refactor_needed', 'Refactor into: classify --types md'),
('update-media-document-types', 'Update document types for media files', 'classification', 'refactor_needed', 'Refactor into: classify --types audio,video')
ON CONFLICT (command_name) DO UPDATE
SET current_status = EXCLUDED.current_status,
    notes = EXCLUDED.notes;

-- Insert listing/reporting commands to refactor
INSERT INTO command_refactor_tracking (command_name, description, command_type, current_status, notes) VALUES
('list-pipeline-status', 'Show pipeline status distribution', 'listing', 'refactor_needed', 'Refactor into: list --status all'),
('list-google-sources', 'Basic listing of google sources', 'listing', 'refactor_needed', 'Refactor into: list'),
('list-unprocessed-files', 'List files with unprocessed status', 'listing', 'refactor_needed', 'Refactor into: list --status unprocessed'),
('show-expert-documents', 'Show expert document coverage', 'listing', 'refactor_needed', 'Refactor into: report --type expert-coverage')
ON CONFLICT (command_name) DO UPDATE
SET current_status = EXCLUDED.current_status,
    notes = EXCLUDED.notes;

-- Insert maintenance commands to refactor
INSERT INTO command_refactor_tracking (command_name, description, command_type, current_status, notes) VALUES
('clean-orphaned-records', 'Remove orphaned expert documents', 'maintenance', 'refactor_needed', 'Refactor into: fix --orphaned-docs'),
('sources-google-integrity', 'Check data integrity', 'maintenance', 'refactor_needed', 'Refactor into: check --integrity')
ON CONFLICT (command_name) DO UPDATE
SET current_status = EXCLUDED.current_status,
    notes = EXCLUDED.notes;

-- Insert deprecated commands
INSERT INTO command_refactor_tracking (command_name, description, command_type, current_status, notes) VALUES
('update-main-video-id', 'Update main video ID for folders', 'media', 'deprecated', 'Archive - Low success rate (44%), replaced by refresh-main-video-id'),
('set-active-filter-profile', 'Set active filter profile', 'filter', 'deprecated', 'Archive - 100% failure rate in usage stats'),
('clear-active-filter-profile', 'Clear active filter profile', 'filter', 'deprecated', 'Archive - related to failed filter system')
ON CONFLICT (command_name) DO UPDATE
SET current_status = EXCLUDED.current_status,
    notes = EXCLUDED.notes;

-- Mark all test/debug/utility files as deprecated
UPDATE command_refactor_tracking
SET current_status = 'deprecated',
    notes = 'Archive - test/debug/utility file not part of main CLI'
WHERE command_name LIKE 'test-%' 
   OR command_name LIKE 'check-%'
   OR command_name LIKE 'analyze-%'
   OR command_name LIKE 'debug-%'
   OR command_name LIKE 'fix-%'
   OR command_name IN (
     'add-find-duplicates-function',
     'create-google-sources-experts',
     'create-sources-google',
     'delete-file-from-db',
     'delete-orphaned-records',
     'display-active-filter',
     'expert-documents-duplicates',
     'expert-documents-purge',
     'finalize-rename',
     'find-documents-with-content',
     'generate-audio-batch',
     'generate-main-video-files-report',
     'identify-orphaned-records',
     'index',
     'insert-missing-sources',
     'insert-specific-file',
     'list-main-video-folders-tree',
     'list-main-video-folders',
     'list-unclassified-files',
     'list-unsupported-document-types',
     'migrate-sources-google',
     'needs-reprocessing',
     'pipeline-status-summary',
     'process-unprocessed',
     'purge-orphaned-with-presentations',
     'reclassify-docs-helper',
     'reclassify-docs-with-service',
     'reclassify_docs_helper',
     'renamed-file',
     'reprocess-docx-files',
     'reset-and-mark-for-processing',
     'reset-deleted-files',
     'reset-document-type',
     'reset-sources-processing-status',
     'run-classify-pdfs',
     'run-fix-many-documents',
     'show-tables',
     'simple-document-check',
     'source-info',
     'sync-and-update-metadata',
     'update-document-type-id',
     'update-file-signatures',
     'update-main-video-ids',
     'update-paths-and-roots',
     'update-pipeline-status',
     'update-processed-records',
     'update-schema-from-json',
     'update-sources-from-json',
     'upload-audio-files',
     'validate-pdf-classification',
     'verify-file-in-db'
   )
AND current_status = 'not_started';