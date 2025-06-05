-- Migration: Add new Google sync commands from reorganization spec to command_refactor_tracking
-- Description: Add the proposed new commands from the google-sync-reorganization-spec.md to track their implementation

-- Insert new commands from the reorganization spec
INSERT INTO command_refactor_tracking (command_name, command_type, current_status, description, test_criteria, notes) VALUES

-- Unified Classification System (Primary Focus)
('classify', 'new', 'not_started', 'Universal classification command that handles all file types through a single entry point', 
 ARRAY[
   'Can classify PDF files correctly',
   'Can classify DOCX/TXT files correctly',
   'Can classify PowerPoint files correctly',
   'Can classify media files correctly',
   'Supports --types filter for specific file types',
   'Supports --limit option',
   'Supports --concurrency for parallel processing',
   'Supports --force for reclassification',
   'Supports --dry-run mode',
   'Integrates with prompt service for type-specific prompts'
 ],
 'Primary focus of Phase 1. Will replace: classify-pdfs, classify-powerpoints, classify-docs-service, update-media-document-types'),

-- Listing and Reporting Commands
('list', 'new', 'not_started', 'Universal listing command with extensive filtering options',
 ARRAY[
   'Can filter by pipeline status',
   'Can filter by file types',
   'Can filter by recent modifications',
   'Can filter by expert',
   'Can filter by expert document presence',
   'Supports multiple output formats (table, json, csv)',
   'Supports sorting options'
 ],
 'Will replace: list-pipeline-status, list-google-sources, show-expert-documents'),

('report', 'new', 'not_started', 'Generate comprehensive reports with various types and formats',
 ARRAY[
   'Can generate pipeline status report',
   'Can generate expert coverage report',
   'Can generate classification quality metrics',
   'Can generate duplicate analysis report',
   'Can generate performance metrics report',
   'Supports markdown and HTML output formats',
   'Can save to file'
 ],
 'Consolidates various reporting commands'),

('search', 'new', 'not_started', 'Find specific files or folders with advanced search capabilities',
 ARRAY[
   'Can search by name with wildcards',
   'Can search by path',
   'Can search by drive ID',
   'Can search within document content',
   'Can search by associated expert'
 ],
 'Enhanced version of find-folder with more capabilities'),

-- Maintenance and Repair Commands
('fix', 'new', 'not_started', 'Universal repair command for various data issues',
 ARRAY[
   'Can remove orphaned expert documents',
   'Can fix incorrect folder document types',
   'Can resolve duplicate records',
   'Can populate missing metadata',
   'Can clear stuck reprocessing flags',
   'Supports --dry-run mode'
 ],
 'Will replace: clean-orphaned-records, fix-bad-folders, and other fix commands'),

('check', 'new', 'not_started', 'Universal validation command for data integrity',
 ARRAY[
   'Can perform full data integrity check',
   'Can check for duplicate records',
   'Can check for orphaned records',
   'Can check data consistency',
   'Can check system performance',
   'Supports detailed and summary output formats'
 ],
 'Will replace: sources-google-integrity, check-duplicates, check-reprocessing-status'),

('mark', 'new', 'not_started', 'Mark files for processing with various criteria',
 ARRAY[
   'Can mark files for reprocessing',
   'Can filter by file types',
   'Can specify file IDs directly',
   'Can use SQL-like conditions',
   'Can include reason for marking'
 ],
 'Enhanced version of needs-reprocessing with more options'),

-- Media-Specific Commands
('media', 'new', 'not_started', 'Media file operations including audio extraction and metadata',
 ARRAY[
   'Can extract audio from video files',
   'Can generate video thumbnails',
   'Can update media duration metadata',
   'Can link media to transcript documents',
   'Supports batch processing'
 ],
 'Consolidates media-specific operations')

ON CONFLICT (command_name) DO UPDATE SET
  command_type = EXCLUDED.command_type,
  description = EXCLUDED.description,
  test_criteria = EXCLUDED.test_criteria,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Update the notes for existing commands that will be archived
UPDATE command_refactor_tracking 
SET 
  command_type = 'to_archive',
  notes = CASE 
    WHEN notes IS NULL THEN 'Will be replaced by new unified commands'
    ELSE notes || E'\nWill be replaced by new unified commands'
  END,
  updated_at = NOW()
WHERE command_name IN (
  'classify-pdfs',
  'classify-powerpoints', 
  'classify-docs-service',
  'update-media-document-types',
  'list-pipeline-status',
  'list-google-sources',
  'show-expert-documents',
  'clean-orphaned-records',
  'fix-bad-folders',
  'sources-google-integrity',
  'check-duplicates',
  'check-reprocessing-status',
  'needs-reprocessing'
)
AND command_type != 'to_archive';

-- Add comment about the new commands
COMMENT ON TABLE command_refactor_tracking IS 'Temporary table to track the refactoring status of google sync CLI commands during the reorganization project. Updated 2025-05-30 to include new unified commands from the reorganization spec.';