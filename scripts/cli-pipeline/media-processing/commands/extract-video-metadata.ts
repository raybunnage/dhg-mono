#!/usr/bin/env ts-node
/**
 * Extract Video Metadata Command
 * 
 * This command extracts metadata (especially duration) from MP4 video files
 * and updates the metadata field in the sources_google table.
 * 
 * Usage:
 *   extract-video-metadata.ts [options]
 * 
 * Options:
 *   --dry-run             Show what would be updated without making changes
 *   --limit <number>      Limit to processing <number> of videos (default: 50)
 *   --file-id <id>        Process a specific file by its sources_google.id
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { converterService } from '../../../../packages/shared/services/converter-service';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  fileId: '',
  limit: 50
};

// Get file-id if specified
const fileIdIndex = args.indexOf('--file-id');
if (fileIdIndex !== -1 && args[fileIdIndex + 1]) {
  options.fileId = args[fileIdIndex + 1];
}

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

/**
 * Find an MP4 file in local directories
 */
function findLocalMP4(filename: string): string | null {
  const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
  const possiblePaths = [
    path.join(mp4Dir, filename),
    path.join(mp4Dir, `INGESTED_${filename}`),
    // Add other possible locations/naming patterns
    path.join(mp4Dir, filename.replace('.mp4', '') + '.mp4'),
    path.join(mp4Dir, filename.replace(/\s+/g, '_') + '.mp4'),
    path.join(mp4Dir, filename.replace(/[^\w.]/g, '_') + '.mp4')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

/**
 * Extract and update metadata for a single file
 */
async function extractMetadataForFile(fileId: string, supabase: any): Promise<boolean> {
  try {
    Logger.info(`Fetching file data for ${fileId}...`);
    
    // Get the file from the database
    const { data: file, error: fileError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type, metadata, size')
      .eq('id', fileId)
      .single();
    
    if (fileError) {
      Logger.error(`❌ Error fetching file with ID ${fileId}: ${fileError.message}`);
      return false;
    }
    
    if (!file) {
      Logger.error(`❌ File with ID ${fileId} not found`);
      return false;
    }
    
    if (file.mime_type !== 'video/mp4') {
      Logger.warn(`⚠️ File ${file.name} is not an MP4 video (mime type: ${file.mime_type})`);
      return false;
    }
    
    // Find the MP4 file in the local directory
    const localPath = findLocalMP4(file.name);
    if (!localPath) {
      Logger.warn(`⚠️ MP4 file ${file.name} not found in the local file_types/mp4 directory`);
      return false;
    }
    
    Logger.info(`✅ Found local MP4 file: ${localPath}`);
    
    // Extract metadata
    Logger.info(`🔍 Extracting metadata from ${file.name}...`);
    const { success, metadata, error } = await converterService.extractVideoMetadata(localPath);
    
    if (!success || !metadata) {
      Logger.error(`❌ Failed to extract metadata: ${error}`);
      return false;
    }
    
    Logger.info(`✅ Successfully extracted metadata:`);
    Logger.info(`   Duration: ${metadata.durationSeconds} seconds (${Math.floor(metadata.durationSeconds / 60)}:${Math.floor(metadata.durationSeconds % 60).toString().padStart(2, '0')})`);
    if (metadata.width && metadata.height) {
      Logger.info(`   Resolution: ${metadata.width}x${metadata.height}`);
    }
    if (metadata.bitrate) {
      Logger.info(`   Bitrate: ${Math.round(metadata.bitrate / 1000)} kbps`);
    }
    
    // Format duration for display
    let formattedDuration = '';
    if (metadata.durationSeconds) {
      const hours = Math.floor(metadata.durationSeconds / 3600);
      const minutes = Math.floor((metadata.durationSeconds % 3600) / 60);
      const seconds = Math.floor(metadata.durationSeconds % 60);
      
      if (hours > 0) {
        formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    // Prepare the update
    const currentMetadata = file.metadata || {};
    const updateData = {
      metadata: {
        ...currentMetadata,
        videoDuration: metadata.durationSeconds,
        formattedDuration,
        videoMetadata: {
          ...metadata,
          extractedAt: new Date().toISOString()
        }
      }
    };
    
    if (options.dryRun) {
      Logger.info(`🔄 DRY RUN: Would update metadata for ${file.name}`);
      return true;
    }
    
    // Update the database
    const { error: updateError } = await supabase
      .from('google_sources')
      .update(updateData)
      .eq('id', fileId);
    
    if (updateError) {
      Logger.error(`❌ Error updating metadata: ${updateError.message}`);
      return false;
    }
    
    Logger.info(`✅ Successfully updated metadata for ${file.name}`);
    return true;
  } catch (error: any) {
    Logger.error(`❌ Exception processing file ${fileId}: ${error.message}`);
    return false;
  }
}

/**
 * Process a batch of MP4 files
 */
async function processBatch(supabase: any, limit: number): Promise<{ success: number; failed: number }> {
  try {
    Logger.info(`Fetching up to ${limit} MP4 files that need metadata extraction...`);
    
    // Get MP4 files that need metadata extraction
    // Using a simpler query that works reliably with Supabase
    const { data: files, error: queryError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type, metadata')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      // Process files with null metadata or empty metadata
      .is('metadata', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (queryError) {
      Logger.error(`❌ Error fetching files: ${queryError.message}`);
      return { success: 0, failed: 0 };
    }
    
    if (!files || files.length === 0) {
      Logger.info('ℹ️ No files found that need metadata extraction');
      return { success: 0, failed: 0 };
    }
    
    Logger.info(`📋 Found ${files.length} MP4 files that need metadata extraction`);
    
    let success = 0;
    let failed = 0;
    
    // Process each file
    for (const file of files) {
      Logger.info(`\n📋 Processing file: ${file.name} (${file.id})`);
      const result = await extractMetadataForFile(file.id, supabase);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  } catch (error: any) {
    Logger.error(`❌ Exception in processBatch: ${error.message}`);
    return { success: 0, failed: 0 };
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Get the Supabase client using singleton pattern
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('✅ Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error('❌ Error getting Supabase client', error);
      process.exit(1);
    }
    
    // Display configuration
    Logger.info('🎬 MP4 Metadata Extraction');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    
    // Handle single file
    if (options.fileId) {
      Logger.info(`📋 Processing single file with ID: ${options.fileId}`);
      const result = await extractMetadataForFile(options.fileId, supabase);
      if (result) {
        Logger.info('✅ Processing completed successfully');
      } else {
        Logger.error('❌ Processing failed');
        process.exit(1);
      }
    }
    // Handle batch processing
    else {
      Logger.info(`📋 Processing batch of up to ${options.limit} files`);
      const { success, failed } = await processBatch(supabase, options.limit);
      Logger.info(`✅ Batch processing complete: ${success} succeeded, ${failed} failed`);
    }
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Default export function for CLI integration
 */
export default async function(cliOptions?: any): Promise<void> {
  // Override default options with CLI options if provided
  if (cliOptions) {
    if (cliOptions.dryRun) options.dryRun = true;
    if (cliOptions.fileId) options.fileId = cliOptions.fileId;
    if (cliOptions.limit) options.limit = parseInt(cliOptions.limit);
  }
  
  try {
    await main();
  } catch (error: any) {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  }
}

// If running directly (not imported), execute the main function
if (require.main === module) {
  main().catch((error: any) => {
    Logger.error('Unhandled error:', error);
    process.exit(1);
  });
}