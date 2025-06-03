#!/usr/bin/env ts-node
/**
 * Unified Find Media Command
 * 
 * Replaces: find-missing-media, find-processable-videos, find-untranscribed-media
 * 
 * Finds media files that need processing based on their current status.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

interface FindOptions {
  limit: number;
  status?: string;
  format?: 'table' | 'json' | 'commands';
  showAll?: boolean;
}

interface MediaFile {
  id: string;
  pipeline_status?: string;
  created_at: string;
  updated_at: string;
  google_sources: {
    id: string;
    name: string;
    drive_id: string;
    mime_type: string;
    size?: number;
    parent_folder_id: string;
  };
}

async function findMedia(options: FindOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Build query based on options
    let query = supabase
      .from('google_expert_documents')
      .select(`
        id,
        pipeline_status,
        created_at,
        updated_at,
        google_sources!inner(
          id,
          name,
          drive_id,
          mime_type,
          size,
          parent_folder_id
        )
      `)
      .eq('google_sources.mime_type', 'video/mp4')
      .eq('google_sources.is_deleted', false)
      .not('google_sources.id', 'is', null);

    // Filter by status if specified
    if (options.status && !options.showAll) {
      query = query.eq('pipeline_status', options.status);
    } else if (!options.showAll) {
      // Default: find files needing processing (null or unprocessed)
      query = query.or('pipeline_status.is.null,pipeline_status.eq.unprocessed');
    }

    // Apply limit
    query = query.limit(options.limit);

    // Execute query
    const { data, error } = await query as { data: MediaFile[] | null; error: any };

    if (error) {
      Logger.error(`Failed to find media files: ${error.message}`);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      Logger.info('No media files found matching criteria');
      return;
    }

    // Output based on format
    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(data, null, 2));
        break;
        
      case 'commands':
        console.log('# Commands to process found files:');
        data.forEach(file => {
          const name = file.google_sources?.name || 'Unknown';
          console.log(`media-processing-cli.sh process --file "${file.id}" # ${name}`);
        });
        break;
        
      case 'table':
      default:
        console.log('\n📁 Media Files Found:');
        console.log('─'.repeat(120));
        console.log(
          'Status'.padEnd(15) +
          'File Name'.padEnd(50) +
          'Size'.padEnd(10) +
          'Document ID'.padEnd(40)
        );
        console.log('─'.repeat(120));
        
        data.forEach(file => {
          if (!file.google_sources) {
            console.log(`Warning: No source info for document ${file.id}`);
            return;
          }
          
          const source = file.google_sources;
          const size = source.size 
            ? (source.size / (1024 * 1024)).toFixed(2) + ' MB'
            : 'Unknown';
          
          console.log(
            (file.pipeline_status || 'unprocessed').padEnd(15) +
            source.name.substring(0, 49).padEnd(50) +
            size.padEnd(10) +
            file.id
          );
        });
        
        console.log('─'.repeat(120));
        console.log(`Total: ${data.length} files\n`);
        
        // Show status summary
        const statusCounts: Record<string, number> = {};
        data.forEach(file => {
          const status = file.pipeline_status || 'unprocessed';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('📊 Status Summary:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`  ${status}: ${count}`);
        });
        break;
    }

  } catch (error: any) {
    Logger.error(`Error finding media files: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: FindOptions = {
  limit: 20,
  format: 'table'
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
    case '--status':
      options.status = args[++i];
      break;
    case '--format':
      options.format = args[++i] as any;
      break;
    case '--all':
      options.showAll = true;
      break;
    case '--help':
      console.log(`
Find Media Command - Find media files needing processing

Usage:
  find-media.ts [options]

Options:
  --limit [n]      Maximum number of files to find (default: 20)
  --status [s]     Filter by specific status (pending|converting|transcribing|completed|failed)
  --format [f]     Output format: table|json|commands (default: table)
  --all            Show all files regardless of status

Examples:
  # Find files needing processing
  find-media.ts --limit 10
  
  # Find only pending files
  find-media.ts --status pending
  
  # Get commands to process files
  find-media.ts --format commands --limit 5
      `);
      process.exit(0);
  }
}

// Run the command
findMedia(options).catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});