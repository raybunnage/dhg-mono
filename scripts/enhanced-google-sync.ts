#!/usr/bin/env ts-node
/**
 * Enhanced Google Drive Sync Script
 * 
 * This script provides a command-line interface for the enhanced Google Drive
 * synchronization service with additional cleaning capabilities.
 * 
 * Features:
 * - Sync folders recursively from Google Drive to Supabase
 * - Clean/remove files and folders based on a root folder ID
 * - Detailed progress reporting and statistics
 * 
 * Usage:
 *   ts-node scripts/enhanced-google-sync.ts [command] [options]
 * 
 * Commands:
 *   sync        Sync files from Google Drive to Supabase
 *   clean       Clean files and folders from database
 *   stats       Display sync statistics
 * 
 * Options:
 *   --folder-id <id>         Google Drive folder ID
 *   --dry-run                Show what would happen without making changes
 *   --recursive              Recursively process subfolders (default: true)
 *   --max-depth <n>          Maximum folder depth to traverse (default: 10)
 *   --batch-size <n>         Process files in batches (default: 50)
 *   --mark-deleted           Mark files as deleted instead of removing them (default: true)
 *   --permanent-delete       Permanently delete files instead of marking them (default: false)
 *   --force-delete           Override safety limits for large deletions (default: false)
 *   --verbose                Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import GoogleAuthService from '../packages/shared/services/google-drive/google-auth-service';
import GoogleDriveService from '../packages/shared/services/google-drive/google-drive-service';
import GoogleDriveSyncService from '../packages/shared/services/google-drive/google-drive-sync-service';
import type { Database } from '../supabase/types';

// Load environment variables from multiple files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.development', '.env.local'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

// Load environment variables
loadEnvFiles();

// Process command-line arguments
interface Options {
  command: string;
  folderId: string;
  dryRun: boolean;
  recursive: boolean;
  maxDepth: number;
  batchSize: number;
  markAsDeleted: boolean;
  permanentDelete: boolean;
  forceDelete: boolean;
  verbose: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  
  // Default options
  const options: Options = {
    command: args[0] || 'help',
    folderId: '',
    dryRun: false,
    recursive: true,
    maxDepth: 10,
    batchSize: 50,
    markAsDeleted: true,
    permanentDelete: false,
    forceDelete: false,
    verbose: false
  };
  
  // Parse folder ID
  const folderIdIndex = args.indexOf('--folder-id');
  if (folderIdIndex !== -1 && args[folderIdIndex + 1]) {
    options.folderId = args[folderIdIndex + 1];
  }
  
  // Parse flags
  options.dryRun = args.includes('--dry-run');
  options.verbose = args.includes('--verbose');
  options.forceDelete = args.includes('--force-delete');
  options.permanentDelete = args.includes('--permanent-delete');
  
  // Overrides
  if (args.includes('--no-recursive')) options.recursive = false;
  if (args.includes('--no-mark-deleted')) options.markAsDeleted = false;
  
  // Parse numeric values
  const maxDepthIndex = args.indexOf('--max-depth');
  if (maxDepthIndex !== -1 && args[maxDepthIndex + 1]) {
    options.maxDepth = parseInt(args[maxDepthIndex + 1], 10) || options.maxDepth;
  }
  
  const batchSizeIndex = args.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    options.batchSize = parseInt(args[batchSizeIndex + 1], 10) || options.batchSize;
  }
  
  return options;
}

// Display help information
function showHelp() {
  console.log(`
Enhanced Google Drive Sync Script

This script provides a command-line interface for the enhanced Google Drive
synchronization service with additional cleaning capabilities.

Usage:
  ts-node scripts/enhanced-google-sync.ts [command] [options]

Commands:
  sync        Sync files from Google Drive to Supabase
  clean       Clean files and folders from database
  stats       Display sync statistics
  help        Display this help message

Options:
  --folder-id <id>      Google Drive folder ID (required)
  --dry-run             Show what would happen without making changes
  --recursive           Recursively process subfolders (default: true)
  --no-recursive        Do not process subfolders
  --max-depth <n>       Maximum folder depth to traverse (default: 10)
  --batch-size <n>      Process files in batches (default: 50)
  --mark-deleted        Mark files as deleted instead of removing them (default: true)
  --no-mark-deleted     Don't mark files as deleted (used with clean command)
  --permanent-delete    Permanently delete files instead of marking them (default: false)
  --force-delete        Override safety limits for large deletions (default: false)
  --verbose             Show detailed logs

Examples:
  # Sync a Google Drive folder recursively (dry run)
  ts-node scripts/enhanced-google-sync.ts sync --folder-id 1abc123def456 --dry-run

  # Sync a Google Drive folder with max depth of 3
  ts-node scripts/enhanced-google-sync.ts sync --folder-id 1abc123def456 --max-depth 3

  # Clean files from a folder in the database (mark as deleted)
  ts-node scripts/enhanced-google-sync.ts clean --folder-id 1abc123def456 --dry-run

  # Clean files from a folder in the database (permanently delete)
  ts-node scripts/enhanced-google-sync.ts clean --folder-id 1abc123def456 --permanent-delete --force-delete

  # Get sync statistics for a folder
  ts-node scripts/enhanced-google-sync.ts stats --folder-id 1abc123def456
`);
}

// Initialize services
async function initServices() {
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or key not found in environment variables');
    process.exit(1);
  }
  
  if (!accessToken) {
    console.error('❌ Google access token not found in environment variables');
    console.log('Please make sure VITE_GOOGLE_ACCESS_TOKEN is set in .env.development');
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Create OAuth client with the access token
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: accessToken
  });
  
  // Create Google Drive API client
  const drive = google.drive({ version: 'v3', auth });
  
  // Create custom GoogleAuthService implementation for drive service
  class OAuthGoogleAuthService implements GoogleAuthService {
    async getAccessToken(): Promise<string> {
      return accessToken;
    }
  }
  
  // Initialize Drive service with OAuth authentication
  const authService = new OAuthGoogleAuthService();
  const driveService = GoogleDriveService.getInstance(authService, supabase);
  
  // Create a Supabase-compatible implementation of GoogleDriveSyncService
  class SupabaseDriveSyncService extends GoogleDriveSyncService {
    // Override the abstract methods with Supabase-specific implementations
    
    protected async getExistingDriveIds(): Promise<Set<string>> {
      try {
        const { data, error } = await supabase
          .from('sources_google')
          .select('drive_id')
          .eq('deleted', false);
          
        if (error) {
          console.error('Error fetching existing drive IDs:', error);
          return new Set<string>();
        }
        
        return new Set((data || []).map(record => record.drive_id));
      } catch (error) {
        console.error('Error fetching existing drive IDs:', error);
        return new Set<string>();
      }
    }
    
    protected async insertBatch(
      files: any[]
    ): Promise<{ inserted: number; errors: Error[] }> {
      try {
        // Prepare records for insertion
        const records = files.map(file => ({
          drive_id: file.drive_id,
          name: file.name,
          mime_type: file.mime_type,
          path: file.path,
          parent_path: file.parent_path,
          parent_folder_id: file.parent_folder_id,
          content_extracted: false,
          deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          web_view_link: file.web_view_link,
          modified_time: file.modified_time,
          size: file.size_bytes,
          thumbnail_link: file.thumbnail_link,
          metadata: file.metadata || {}
        }));
        
        const { data, error } = await supabase
          .from('sources_google')
          .insert(records);
          
        if (error) {
          return { inserted: 0, errors: [new Error(error.message)] };
        }
        
        return { inserted: records.length, errors: [] };
      } catch (error) {
        return { inserted: 0, errors: [error as Error] };
      }
    }
    
    protected async getFilesForCleanup(
      rootFolderId: string
    ): Promise<{ id: string; drive_id: string }[]> {
      try {
        // Get files where parent_folder_id matches the root folder
        const { data, error } = await supabase
          .from('sources_google')
          .select('id, drive_id')
          .eq('parent_folder_id', rootFolderId)
          .eq('deleted', false);
          
        if (error) {
          console.error('Error fetching files for cleanup:', error);
          return [];
        }
        
        return data || [];
      } catch (error) {
        console.error('Error fetching files for cleanup:', error);
        return [];
      }
    }
    
    protected async permanentlyDeleteFiles(
      fileIds: string[]
    ): Promise<{ deleted: number; errors: Error[] }> {
      try {
        if (fileIds.length === 0) return { deleted: 0, errors: [] };
        
        // Delete records from the database
        const { data, error } = await supabase
          .from('sources_google')
          .delete()
          .in('id', fileIds);
          
        if (error) {
          return { deleted: 0, errors: [new Error(error.message)] };
        }
        
        return { deleted: fileIds.length, errors: [] };
      } catch (error) {
        return { deleted: 0, errors: [error as Error] };
      }
    }
    
    protected async markFilesAsDeleted(
      fileIds: string[]
    ): Promise<{ marked: number; errors: Error[] }> {
      try {
        if (fileIds.length === 0) return { marked: 0, errors: [] };
        
        // Mark records as deleted in the database
        const { data, error } = await supabase
          .from('sources_google')
          .update({ 
            deleted: true,
            updated_at: new Date().toISOString()
          })
          .in('id', fileIds);
          
        if (error) {
          return { marked: 0, errors: [new Error(error.message)] };
        }
        
        return { marked: fileIds.length, errors: [] };
      } catch (error) {
        return { marked: 0, errors: [error as Error] };
      }
    }
  }
  
  // Initialize sync service with our implementation
  const syncService = SupabaseDriveSyncService.getInstance(driveService, supabase);
  
  return {
    drive,
    supabase,
    driveService,
    syncService
  };
}

// Display progress
function displayProgress(progress: { current: number; total: number; percentage: number }): void {
  process.stdout.write(`\rProgress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
  
  if (progress.current === progress.total) {
    process.stdout.write('\n');
  }
}

// Run sync command
async function runSync(options: Options, services: any): Promise<void> {
  console.log('=== Google Drive Sync ===');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Folder ID: ${options.folderId}`);
  console.log(`Recursive: ${options.recursive}`);
  console.log(`Max depth: ${options.maxDepth}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log('============================');
  
  if (!options.folderId) {
    console.error('❌ Folder ID is required. Use --folder-id option.');
    process.exit(1);
  }
  
  try {
    // First check if folder exists
    const folder = await services.driveService.getFile(options.folderId);
    console.log(`✅ Folder exists: "${folder.name}"`);
    
    // Sync folder
    const syncResult = await services.syncService.syncFolderRecursive(
      options.folderId,
      {
        recursive: options.recursive,
        maxDepth: options.maxDepth,
        batchSize: options.batchSize,
        dryRun: options.dryRun
      },
      displayProgress
    );
    
    // Display results
    console.log('\n=== Sync Summary ===');
    console.log(`Files found: ${syncResult.stats.filesFound}`);
    console.log(`Files inserted: ${syncResult.stats.filesInserted}`);
    console.log(`Files updated: ${syncResult.stats.filesUpdated}`);
    console.log(`Files skipped: ${syncResult.stats.filesSkipped}`);
    console.log(`Folders processed: ${syncResult.stats.foldersFound}`);
    console.log(`Total size: ${(syncResult.stats.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Duration: ${
      syncResult.stats.endTime 
        ? (syncResult.stats.endTime.getTime() - syncResult.stats.startTime.getTime()) / 1000 
        : 0
    }s`);
    
    // Display errors if any
    if (syncResult.errors.length > 0) {
      console.error('\n❌ Errors encountered during sync:');
      syncResult.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error.message || error}`);
      });
    }
    
    console.log('\n✅ Sync complete!');
  } catch (error: any) {
    console.error('❌ Error during sync:', error.message || error);
    process.exit(1);
  }
}

// Run clean command
async function runClean(options: Options, services: any): Promise<void> {
  console.log('=== Google Drive Clean ===');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL CLEAN'}`);
  console.log(`Folder ID: ${options.folderId}`);
  console.log(`Mark as deleted: ${options.markAsDeleted}`);
  console.log(`Permanent delete: ${options.permanentDelete}`);
  console.log(`Force delete: ${options.forceDelete}`);
  console.log('============================');
  
  if (!options.folderId) {
    console.error('❌ Folder ID is required. Use --folder-id option.');
    process.exit(1);
  }
  
  try {
    // Clean folder
    const cleanResult = await services.syncService.cleanFolder(
      options.folderId,
      {
        dryRun: options.dryRun,
        batchSize: options.batchSize,
        forceDelete: options.forceDelete,
        markAsDeleted: options.markAsDeleted,
        permanentDelete: options.permanentDelete
      },
      displayProgress
    );
    
    // Display results
    console.log('\n=== Clean Summary ===');
    console.log(`Folders cleaned: ${cleanResult.foldersCleaned}`);
    console.log(`Files deleted: ${cleanResult.filesDeleted}`);
    console.log(`Files marked as deleted: ${cleanResult.filesMarkedAsDeleted}`);
    console.log(`Files skipped: ${cleanResult.filesSkipped}`);
    console.log(`Duration: ${
      (cleanResult.endTime.getTime() - cleanResult.startTime.getTime()) / 1000
    }s`);
    
    // Display errors if any
    if (cleanResult.errors.length > 0) {
      console.error('\n❌ Errors encountered during clean:');
      cleanResult.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error.message || error}`);
      });
    }
    
    console.log('\n✅ Clean complete!');
  } catch (error: any) {
    console.error('❌ Error during clean:', error.message || error);
    process.exit(1);
  }
}

// Run stats command
async function runStats(options: Options, services: any): Promise<void> {
  console.log('=== Google Drive Stats ===');
  console.log(`Folder ID: ${options.folderId || 'All folders'}`);
  console.log('============================');
  
  try {
    // Get statistics
    const stats = await services.syncService.getSyncStats(options.folderId || undefined);
    
    // Display statistics
    console.log('\n=== Sync Statistics ===');
    console.log(`Total files: ${stats.totalFiles}`);
    console.log(`Total folders: ${stats.totalFolders}`);
    console.log(`Total size: ${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Synced files: ${stats.syncedFiles}`);
    console.log(`Failed files: ${stats.failedFiles}`);
    
    if (stats.fileTypes) {
      console.log('\nFile types:');
      Object.entries(stats.fileTypes).forEach(([type, count]: [string, any]) => {
        console.log(`- ${type}: ${count} files`);
      });
    }
    
    console.log('\n✅ Statistics complete!');
  } catch (error: any) {
    console.error('❌ Error getting statistics:', error.message || error);
    process.exit(1);
  }
}

// Main function
async function main(): Promise<void> {
  const options = parseArgs();
  
  // Show help if requested or no command provided
  if (options.command === 'help') {
    showHelp();
    return;
  }
  
  // Initialize services
  const services = await initServices();
  
  // Execute command
  switch (options.command) {
    case 'sync':
      await runSync(options, services);
      break;
    case 'clean':
      await runClean(options, services);
      break;
    case 'stats':
      await runStats(options, services);
      break;
    default:
      console.error(`❌ Unknown command: ${options.command}`);
      showHelp();
      process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});