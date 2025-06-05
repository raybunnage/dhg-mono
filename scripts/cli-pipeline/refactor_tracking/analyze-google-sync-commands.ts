#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

interface CommandInfo {
  filename: string;
  commandName: string;
  description: string;
  category: string;
  status: string;
  keepOrArchive: 'keep' | 'archive' | 'refactor';
  notes: string;
}

// Based on the reorganization spec, map commands to their fate
const commandMappings: Record<string, Partial<CommandInfo>> = {
  // Core sync operations - KEEP
  'sync-all': { status: 'keep_as_is', keepOrArchive: 'keep', category: 'core_sync', notes: 'Core command - complete pipeline' },
  'sync-files': { status: 'keep_as_is', keepOrArchive: 'keep', category: 'core_sync', notes: 'Core command - fast file check' },
  'process-new-files-enhanced': { status: 'tested', keepOrArchive: 'keep', category: 'core_sync', notes: 'Core command - recently fixed batch processing' },
  'update-metadata': { status: 'keep_as_is', keepOrArchive: 'keep', category: 'core_sync', notes: 'Core command - metadata updates' },
  'verify-deletions': { status: 'keep_as_is', keepOrArchive: 'keep', category: 'core_sync', notes: 'Core command - deletion verification' },
  'health-check': { status: 'keep_as_is', keepOrArchive: 'keep', category: 'core_sync', notes: 'Core command - API health check' },

  // Classification commands - TO BE REFACTORED into unified 'classify' command
  'classify-pdfs': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types pdf' },
  'classify-powerpoints': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types pptx' },
  'classify-docs-service': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types docx,txt' },
  'classify-docx': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types docx' },
  'classify-txt': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types txt' },
  'classify-markdown': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types md' },
  'update-media-document-types': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --types audio,video' },
  'bulk-classify': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify with --limit option' },
  'test-classify': { status: 'refactor_into_classify', keepOrArchive: 'refactor', category: 'classification', notes: 'Refactor into: classify --dry-run' },

  // Listing commands - TO BE REFACTORED into unified 'list' command
  'list-pipeline-status': { status: 'refactor_into_list', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: list --status all' },
  'list-google-sources': { status: 'refactor_into_list', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: list' },
  'list-unprocessed-files': { status: 'refactor_into_list', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: list --status unprocessed' },
  'analyze-unprocessed-files': { status: 'refactor_into_report', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: report --type unprocessed' },
  'show-expert-documents': { status: 'refactor_into_report', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: report --type expert-coverage' },
  'report-folder-video-assignments': { status: 'refactor_into_report', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: report --type video-assignments' },
  'report-main-video-ids': { status: 'refactor_into_report', keepOrArchive: 'refactor', category: 'listing', notes: 'Refactor into: report --type main-video-ids' },

  // Search commands - TO BE REFACTORED
  'find-folder': { status: 'refactor_into_search', keepOrArchive: 'refactor', category: 'search', notes: 'Refactor into: search --name pattern' },
  'get-current-drive-id': { status: 'refactor_into_search', keepOrArchive: 'refactor', category: 'search', notes: 'Refactor into: search --drive-id' },

  // Maintenance commands - TO BE REFACTORED
  'clean-orphaned-records': { status: 'refactor_into_fix', keepOrArchive: 'refactor', category: 'maintenance', notes: 'Refactor into: fix --orphaned-docs' },
  'fix-orphaned-docx': { status: 'refactor_into_fix', keepOrArchive: 'refactor', category: 'maintenance', notes: 'Refactor into: fix --orphaned-docs --type docx' },
  'remove-expert-docs-pdf-records': { status: 'refactor_into_fix', keepOrArchive: 'refactor', category: 'maintenance', notes: 'Refactor into: fix --orphaned-docs --type pdf' },
  'sources-google-integrity': { status: 'refactor_into_check', keepOrArchive: 'refactor', category: 'maintenance', notes: 'Refactor into: check --integrity' },
  'check-duplicates': { status: 'refactor_into_check', keepOrArchive: 'refactor', category: 'maintenance', notes: 'Refactor into: check --duplicates' },
  'check-expert-doc': { status: 'refactor_into_check', keepOrArchive: 'refactor', category: 'maintenance', notes: 'Refactor into: check --expert-docs' },

  // Video/Media specific - KEEP or REFACTOR
  'update-main-video-id': { status: 'deprecated', keepOrArchive: 'archive', category: 'media', notes: 'Low success rate (44%), replaced by refresh-main-video-id' },
  'refresh-main-video-id': { status: 'tested', keepOrArchive: 'keep', category: 'media', notes: 'New improved version with auto-discovery' },
  'assign-main-video-id': { status: 'refactor_into_media', keepOrArchive: 'refactor', category: 'media', notes: 'Refactor into: media --assign-video-id' },

  // Filter profile commands - ARCHIVE (100% failure rate)
  'set-active-filter-profile': { status: 'deprecated', keepOrArchive: 'archive', category: 'filter', notes: 'Archive - 100% failure rate in usage stats' },
  'get-active-filter-profile': { status: 'deprecated', keepOrArchive: 'archive', category: 'filter', notes: 'Archive - related to failed filter system' },
  'clear-active-filter-profile': { status: 'deprecated', keepOrArchive: 'archive', category: 'filter', notes: 'Archive - related to failed filter system' },

  // Batch processing - KEEP
  'sync-files-batch': { status: 'keep_as_is', keepOrArchive: 'keep', category: 'core_sync', notes: 'Important for large-scale operations' },

  // Special purpose - EVALUATE
  'repair-folder': { status: 'evaluate', keepOrArchive: 'keep', category: 'maintenance', notes: 'Useful for fixing specific folder issues' },
  'sync-expert-documents': { status: 'deprecated', keepOrArchive: 'archive', category: 'sync', notes: 'Functionality moved to process-new-files-enhanced' },
};

async function analyzeGoogleSyncCommands() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const googleSyncDir = path.join(__dirname, '../google_sync');
  
  console.log('📂 Analyzing Google Sync Commands...\n');

  // Get all TypeScript files
  const files = fs.readdirSync(googleSyncDir)
    .filter(f => f.endsWith('.ts') && !f.includes('.test.') && !f.includes('.spec.'));

  // Extract command information from files
  const commands: CommandInfo[] = [];
  
  for (const file of files) {
    const filePath = path.join(googleSyncDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract command name (remove .ts extension)
    const commandName = file.replace('.ts', '');
    
    // Try to extract description from file content
    let description = 'No description found';
    const descMatch = content.match(/description:\s*['"`]([^'"`]+)['"`]/);
    if (descMatch) {
      description = descMatch[1];
    } else {
      // Try to find it in a comment
      const commentMatch = content.match(/\/\/\s*(.+?)\n/);
      if (commentMatch && commentMatch[1].length > 10) {
        description = commentMatch[1];
      }
    }

    // Get mapping info or set defaults
    const mapping = commandMappings[commandName] || {
      status: 'not_analyzed',
      keepOrArchive: 'archive',
      category: 'uncategorized',
      notes: 'Not analyzed in reorganization spec'
    };

    commands.push({
      filename: file,
      commandName,
      description,
      category: mapping.category || 'uncategorized',
      status: mapping.status || 'not_analyzed',
      keepOrArchive: mapping.keepOrArchive || 'archive',
      notes: mapping.notes || ''
    });
  }

  // Get existing entries from database
  const { data: existingEntries } = await supabase
    .from('command_refactor_tracking')
    .select('command_name');
  
  const existingCommandNames = new Set(existingEntries?.map(e => e.command_name) || []);

  // Prepare SQL for updates and inserts
  const updates: string[] = [];
  const inserts: string[] = [];

  for (const cmd of commands) {
    if (existingCommandNames.has(cmd.commandName)) {
      // Update existing
      updates.push(`
UPDATE command_refactor_tracking 
SET status = '${cmd.status}',
    keep_or_archive = '${cmd.keepOrArchive}',
    category = '${cmd.category}',
    notes = '${cmd.notes.replace(/'/g, "''")}'
WHERE command_name = '${cmd.commandName}';`);
    } else {
      // Insert new
      inserts.push(`('${cmd.commandName}', '${cmd.description.replace(/'/g, "''")}', '${cmd.category}', '${cmd.status}', '${cmd.keepOrArchive}', '${cmd.notes.replace(/'/g, "''")}')`);
    }
  }

  // Generate SQL output
  console.log('-- SQL to update command_refactor_tracking table\n');
  
  if (updates.length > 0) {
    console.log('-- Updates for existing commands');
    console.log(updates.join('\n'));
  }

  if (inserts.length > 0) {
    console.log('\n-- Inserts for new commands');
    console.log(`INSERT INTO command_refactor_tracking (command_name, description, category, status, keep_or_archive, notes) VALUES`);
    console.log(inserts.join(',\n') + ';');
  }

  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log(`Total files analyzed: ${files.length}`);
  console.log(`Commands to keep: ${commands.filter(c => c.keepOrArchive === 'keep').length}`);
  console.log(`Commands to refactor: ${commands.filter(c => c.keepOrArchive === 'refactor').length}`);
  console.log(`Commands to archive: ${commands.filter(c => c.keepOrArchive === 'archive').length}`);
  
  console.log('\n📦 By Category:');
  const byCategory = commands.reduce((acc, cmd) => {
    acc[cmd.category] = (acc[cmd.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\n🎯 By Status:');
  const byStatus = commands.reduce((acc, cmd) => {
    acc[cmd.status] = (acc[cmd.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

analyzeGoogleSyncCommands().catch(console.error);