#!/usr/bin/env ts-node
/**
 * Register Local MP4 Files Command
 * 
 * This utility adds local MP4 files that are not already in the database to the sources_google table.
 * It helps bridge the gap between local files and the database records when files haven't been
 * synced directly from Google Drive.
 * 
 * Usage:
 *   register-local-mp4-files.ts [options]
 * 
 * Options:
 *   --dry-run              Show what would be added without making changes
 *   --force                Add files even if similar filenames exist (will create new entries)
 *   --specific-files       Only register specific files (comma-separated list)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';
import * as crypto from 'crypto';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command-line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  specificFiles: ''
};

// Parse specific files if provided
const specificFilesIndex = args.indexOf('--specific-files');
if (specificFilesIndex !== -1 && args[specificFilesIndex + 1]) {
  options.specificFiles = args[specificFilesIndex + 1];
}

// Define file paths
const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');

interface LocalFileInfo {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  status: 'pending' | 'added' | 'exists' | 'error';
  error?: string;
}

/**
 * Format file size to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Get all local MP4 files
 */
function getLocalMp4Files(): string[] {
  try {
    if (!fs.existsSync(MP4_DIR)) {
      Logger.warn(`Directory ${MP4_DIR} does not exist`);
      return [];
    }

    let files = fs.readdirSync(MP4_DIR)
      .filter(file => file.toLowerCase().endsWith('.mp4'));
    
    // Filter to specific files if requested
    if (options.specificFiles) {
      const specificFilesArray = options.specificFiles.split(',').map(f => f.trim().toLowerCase());
      files = files.filter(file => 
        specificFilesArray.some(specific => 
          file.toLowerCase().includes(specific.toLowerCase())
        )
      );
      Logger.info(`Filtered to ${files.length} files matching specified patterns`);
    }
    
    return files;
  } catch (error: any) {
    Logger.error(`Error reading ${MP4_DIR}: ${error.message}`);
    return [];
  }
}

/**
 * Check if a file already exists in the database
 */
async function checkFileExistsInDb(supabase: any, filename: string): Promise<boolean> {
  try {
    // Try exact match first
    const { data: exactMatches, error: exactError } = await supabase
      .from('google_sources')
      .select('id, name')
      .eq('name', filename)
      .eq('deleted', false);

    if (exactError) {
      Logger.error(`Error checking database for ${filename}: ${exactError.message}`);
      return false;
    }

    if (exactMatches && exactMatches.length > 0) {
      return true;
    }

    // Try fuzzy match (contains)
    const filenameBase = filename.replace(/\.mp4$/i, '').toLowerCase();
    
    const { data: fuzzyMatches, error: fuzzyError } = await supabase
      .from('google_sources')
      .select('id, name')
      .ilike('name', `%${filenameBase}%`)
      .eq('deleted', false);

    if (fuzzyError) {
      Logger.error(`Error fuzzy-checking database for ${filename}: ${fuzzyError.message}`);
      return false;
    }

    return (fuzzyMatches && fuzzyMatches.length > 0);
  } catch (error: any) {
    Logger.error(`Exception checking database for ${filename}: ${error.message}`);
    return false;
  }
}

/**
 * Add local MP4 files to the database
 */
async function registerLocalMp4Files(): Promise<LocalFileInfo[]> {
  const fileInfoList: LocalFileInfo[] = [];
  
  // Get local files
  const localFiles = getLocalMp4Files();
  Logger.info(`Found ${localFiles.length} MP4 files in ${MP4_DIR}`);

  if (localFiles.length === 0) {
    Logger.warn('No local MP4 files found to register');
    return fileInfoList;
  }

  // Get Supabase client
  const supabaseClientService = SupabaseClientService.getInstance();
  let supabase;
  
  try {
    supabase = supabaseClientService.getClient();
    Logger.info('Successfully connected to Supabase');
  } catch (error: any) {
    Logger.error(`Error getting Supabase client: ${error.message}`);
    process.exit(1);
  }

  // Process each file
  for (const filename of localFiles) {
    const filePath = path.join(MP4_DIR, filename);
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    const fileInfo: LocalFileInfo = {
      name: filename,
      path: filePath,
      size: fileSize,
      sizeFormatted: formatFileSize(fileSize),
      status: 'pending'
    };

    // Check if file already exists in database
    const exists = options.force ? false : await checkFileExistsInDb(supabase, filename);
    
    if (exists) {
      Logger.info(`Skipping ${filename} - already exists in database`);
      fileInfo.status = 'exists';
      fileInfo.error = 'Already exists in database';
      fileInfoList.push(fileInfo);
      continue;
    }

    // Log the planned addition
    Logger.info(`${options.dryRun ? 'Would add' : 'Adding'} ${filename} (${fileInfo.sizeFormatted}) to database`);
    
    if (!options.dryRun) {
      try {
        // Generate a unique drive_id for this file (used as if it came from Google Drive)
        const driveId = crypto.randomUUID();
        
        // Current timestamp for created_at and updated_at
        const now = new Date().toISOString();
        
        // Insert record into sources_google table
        const { data, error } = await supabase
          .from('google_sources')
          .insert({
            drive_id: driveId,
            name: filename,
            mime_type: 'video/mp4',
            path: `/mp4/${filename}`,
            parent_path: '/mp4',
            parent_folder_id: null, // Local files don't have a folder ID
            content_extracted: false,
            deleted: false,
            created_at: now,
            updated_at: now,
            size: fileSize,
            metadata: {
              locally_registered: true,
              registration_date: now,
              file_path: filePath
            }
          })
          .select()
          .single();
        
        if (error) {
          Logger.error(`❌ Error adding ${filename} to database: ${error.message}`);
          fileInfo.status = 'error';
          fileInfo.error = error.message;
        } else {
          Logger.info(`✅ Successfully added ${filename} with ID: ${data.id}`);
          fileInfo.status = 'added';
        }
      } catch (error: any) {
        Logger.error(`❌ Exception adding ${filename} to database: ${error.message}`);
        fileInfo.status = 'error';
        fileInfo.error = error.message;
      }
    } else {
      // In dry run mode
      fileInfo.status = 'pending';
    }
    
    fileInfoList.push(fileInfo);
  }

  return fileInfoList;
}

/**
 * Display a summary of the registration results
 */
function displaySummary(fileInfoList: LocalFileInfo[]): void {
  const added = fileInfoList.filter(f => f.status === 'added').length;
  const pending = fileInfoList.filter(f => f.status === 'pending').length;
  const exists = fileInfoList.filter(f => f.status === 'exists').length;
  const errors = fileInfoList.filter(f => f.status === 'error').length;
  
  Logger.info('\n=== REGISTRATION SUMMARY ===');
  Logger.info(`Total files processed: ${fileInfoList.length}`);
  
  if (options.dryRun) {
    Logger.info(`Files that would be added: ${pending}`);
  } else {
    Logger.info(`Files successfully added to database: ${added}`);
  }
  
  Logger.info(`Files skipped (already exist): ${exists}`);
  Logger.info(`Files with errors: ${errors}`);
  
  if (options.dryRun) {
    Logger.info('\n=== DRY RUN - No changes were made ===');
    Logger.info('Run without --dry-run to register the files');
  }
  
  if (fileInfoList.length > 0 && !options.dryRun && added > 0) {
    Logger.info('\n=== NEXT STEPS ===');
    Logger.info('1. Update disk status to mark files as available:');
    Logger.info('   ./scripts/cli-pipeline/media-processing/media-processing-cli.sh update-disk-status --force');
    Logger.info('2. Register expert documents for the files:');
    Logger.info('   ./scripts/cli-pipeline/media-processing/media-processing-cli.sh register-expert-docs');
    Logger.info('3. Now you can process the videos:');
    Logger.info('   ./scripts/cli-pipeline/media-processing/media-processing-cli.sh find-processable-videos');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    Logger.info('🔄 MP4 File Registration Utility');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL REGISTRATION'}`);
    Logger.info(`Force registration: ${options.force ? 'ON' : 'OFF'}`);
    if (options.specificFiles) {
      Logger.info(`Specific files: ${options.specificFiles}`);
    }
    
    const fileInfoList = await registerLocalMp4Files();
    displaySummary(fileInfoList);
  } catch (error: any) {
    Logger.error(`Error in register-local-mp4-files: ${error.message}`);
    process.exit(1);
  }
}

// If this script is run directly, execute the main function
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}

// Export the main function for use in the CLI
export default main;