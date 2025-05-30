#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface CommandRefactorEntry {
  id: string;
  command_name: string;
  command_type: string;
  current_status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Commands that should be archived according to the reorganization spec
const COMMANDS_TO_ARCHIVE = [
  // Classification commands being replaced by unified 'classify' command
  'classify-pdfs',
  'classify-powerpoints',
  'classify-docs-service',
  'update-media-document-types',
  'classify-documents',
  'classify-markdown-documents',
  'classify-text-documents',
  'classify-missing-docs-with-service',
  'classify-pdfs-with-service',
  'classify-unprocessed-with-content',
  'direct-classify-pdfs',
  'force-classify-docs',
  'force-reclassify',
  'reclassify-docs-helper',
  'reclassify_docs_helper',
  'reclassify-docs-with-service',
  'reprocess-docx-files',
  'run-classify-pdfs',
  'validate-pdf-classification',
  
  // Listing commands being replaced by unified 'list' command
  'list-pipeline-status',
  'list-google-sources',
  'show-expert-documents',
  'list-unprocessed',
  'list-needs-reprocessing',
  'list-by-status',
  'list-unclassified-files',
  'list-unsupported-document-types',
  'pipeline-status-summary',
  
  // Maintenance commands being replaced by unified 'fix' and 'check' commands
  'clean-orphaned-records',
  'sources-google-integrity',
  'check-duplicates',
  'fix-bad-folders',
  'mark-for-reprocessing',
  'clear-reprocessing-status',
  'clear-reprocessing',
  'delete-orphaned-records',
  'expert-documents-duplicates',
  'expert-documents-purge',
  'fix-mp4-processing-status',
  'identify-orphaned-records',
  'purge-orphaned-with-presentations',
  'reset-and-mark-for-processing',
  'reset-deleted-files',
  'reset-document-type',
  'reset-sources-processing-status',
  'update-pipeline-status',
  
  // Report commands being replaced by unified 'report' command
  'pipeline-report',
  'expert-coverage-report',
  'classification-report',
  'generate-main-video-files-report',
  
  // Search commands being replaced by unified 'search' command
  'find-folder',
  'find-by-expert',
  'find-duplicates',
  'find-documents-with-content',
  
  // Media-specific commands being replaced by unified 'media' command
  'extract-audio',
  'generate-thumbnails',
  'update-media-duration',
  'link-transcripts',
  'update-main-video-id',
  'update-main-video-ids',
  'generate-audio-batch',
  'count-mp4-files',
  
  // Analysis commands being replaced by unified analysis tools
  'analyze-audio-gaps',
  'analyze-command-usage',
  'analyze-document-types-path-depth',
  'analyze-expert-documents',
  'analyze-folders-query',
  
  // Check/debug commands being replaced by unified 'check' command
  'check-concepts',
  'check-concepts-of-document',
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
  
  // Other deprecated commands mentioned in usage statistics
  'filter-commands', // 100% failure rate, deprecated
  'display-active-filter',
  'get-active-filter-profile',
  
  // File operations being replaced by sync operations
  'delete-file-from-db',
  'insert-missing-sources',
  'insert-specific-file',
  'renamed-file',
  'update-file-signatures',
  'fix-specific-document',
  'run-fix-many-documents',
  'update-document-type-id',
  'update-processed-records',
  
  // Migration/schema commands no longer needed
  'copy-data-to-sources-google',
  'create-google-sources-experts',
  'create-sources-google',
  'migrate-sources-google',
  'update-schema-from-json',
  'update-sources-from-json',
  'finalize-rename',
  'fix-root-path-depth',
  'update-paths-and-roots',
  
  // Test commands being replaced
  'test-active-filter',
  'test-direct-sql',
  'test-prompt-service',
  'test-query',
  'test-skip-reprocessing',
  'test-source-extensions',
  
  // Utility commands being replaced
  'add-find-duplicates-function',
  'index',
  'needs-reprocessing',
  'process-unprocessed',
  'simple-document-check',
  'source-info',
  'sync-and-update-metadata',
  'verify-file-in-db',
  
  // Folder operations being replaced
  'list-main-video-folders',
  'list-main-video-folders-tree',
  'upload-audio-files',
  'show-tables',
];

async function checkDeprecatedCommands() {
  console.log('Checking deprecated commands that should be archived...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Query all deprecated commands
    const { data: deprecatedCommands, error } = await supabase
      .from('command_refactor_tracking')
      .select('*')
      .eq('current_status', 'deprecated')
      .order('command_type', { ascending: true })
      .order('command_name', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    if (!deprecatedCommands || deprecatedCommands.length === 0) {
      console.log('No commands found with status "deprecated".');
      return;
    }
    
    console.log(`Found ${deprecatedCommands.length} deprecated commands.\n`);
    
    // Separate commands that should be archived vs remain deprecated
    const toArchive: CommandRefactorEntry[] = [];
    const remainDeprecated: CommandRefactorEntry[] = [];
    
    for (const cmd of deprecatedCommands) {
      if (COMMANDS_TO_ARCHIVE.includes(cmd.command_name)) {
        toArchive.push(cmd);
      } else {
        remainDeprecated.push(cmd);
      }
    }
    
    // Display commands that should be archived
    if (toArchive.length > 0) {
      console.log(`\n=== Commands that should be ARCHIVED (${toArchive.length}) ===\n`);
      console.log('These commands are being replaced by unified commands according to the reorganization spec:\n');
      
      // Group by command type
      const byType = toArchive.reduce((acc, cmd) => {
        if (!acc[cmd.command_type]) acc[cmd.command_type] = [];
        acc[cmd.command_type].push(cmd);
        return acc;
      }, {} as Record<string, CommandRefactorEntry[]>);
      
      for (const [type, commands] of Object.entries(byType)) {
        console.log(`${type}:`);
        for (const cmd of commands) {
          const replacement = getReplacementCommand(cmd.command_name);
          console.log(`  - ${cmd.command_name} → ${replacement}`);
        }
        console.log();
      }
      
      // Generate SQL update statement
      console.log('=== SQL to update these commands ===\n');
      const ids = toArchive.map(cmd => `'${cmd.id}'`).join(', ');
      console.log(`UPDATE command_refactor_tracking`);
      console.log(`SET current_status = 'archived', updated_at = NOW()`);
      console.log(`WHERE id IN (${ids});\n`);
    }
    
    // Display commands that should remain deprecated
    if (remainDeprecated.length > 0) {
      console.log(`\n=== Commands that should remain DEPRECATED (${remainDeprecated.length}) ===\n`);
      console.log('These commands are not mentioned in the reorganization spec:\n');
      
      const byType = remainDeprecated.reduce((acc, cmd) => {
        if (!acc[cmd.command_type]) acc[cmd.command_type] = [];
        acc[cmd.command_type].push(cmd);
        return acc;
      }, {} as Record<string, CommandRefactorEntry[]>);
      
      for (const [type, commands] of Object.entries(byType)) {
        console.log(`${type}:`);
        for (const cmd of commands) {
          console.log(`  - ${cmd.command_name}`);
        }
        console.log();
      }
    }
    
  } catch (error) {
    console.error('Error checking deprecated commands:', error);
    process.exit(1);
  }
}

function getReplacementCommand(oldCommand: string): string {
  const replacements: Record<string, string> = {
    // Classification commands
    'classify-pdfs': 'classify --types pdf',
    'classify-powerpoints': 'classify --types pptx',
    'classify-docs-service': 'classify --types docx,txt',
    'update-media-document-types': 'classify --types audio,video',
    'classify-documents': 'classify --types docx',
    'classify-markdown-documents': 'classify --types md',
    'classify-text-documents': 'classify --types txt',
    
    // Listing commands
    'list-pipeline-status': 'list --status all',
    'list-google-sources': 'list',
    'show-expert-documents': 'report --type expert-coverage',
    'list-unprocessed': 'list --status unprocessed',
    'list-needs-reprocessing': 'list --status needs-reprocessing',
    'list-by-status': 'list --status [status]',
    
    // Maintenance commands
    'clean-orphaned-records': 'fix --orphaned-docs',
    'sources-google-integrity': 'check --integrity',
    'check-duplicates': 'check --duplicates',
    'fix-bad-folders': 'fix --bad-folders',
    'mark-for-reprocessing': 'mark --reprocess',
    'clear-reprocessing-status': 'fix --reprocessing-status',
    
    // Report commands
    'pipeline-report': 'report --type pipeline-status',
    'expert-coverage-report': 'report --type expert-coverage',
    'classification-report': 'report --type classification',
    
    // Search commands
    'find-folder': 'search --name [pattern]',
    'find-by-expert': 'search --expert [name]',
    'find-duplicates': 'report --type duplicates',
    
    // Media commands
    'extract-audio': 'media --extract-audio',
    'generate-thumbnails': 'media --generate-thumbnails',
    'update-media-duration': 'media --update-duration',
    'link-transcripts': 'media --link-transcripts',
    
    // Other
    'update-main-video-id': 'media --update-metadata',
    'filter-commands': '(removed - use --filter-profile option)',
  };
  
  return replacements[oldCommand] || 'classify';
}

// Run the check
checkDeprecatedCommands();