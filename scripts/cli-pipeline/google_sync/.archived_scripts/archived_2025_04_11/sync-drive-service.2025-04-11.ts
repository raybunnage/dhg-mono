# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Sync Google Drive Folder Using Service Account
 * 
 * This script syncs files from a Google Drive folder to the database
 * using the Google service account for authentication.
 * 
 * Usage:
 *   npx ts-node sync-drive-service.ts [folderId] [options]
 * 
 * Options:
 *   --dry-run                 Show what would be synced without making changes
 *   --recursive               Recursively sync subfolders
 *   --limit <number>          Limit the number of files to process (default: 50)
 * 
 * Examples:
 *   npx ts-node sync-drive-service.ts 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run
 *   npx ts-node sync-drive-service.ts dynamic-healing --dry-run --recursive
 */

import { google } from 'googleapis';
import { Logger } from '../../../packages/shared/utils';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { defaultGoogleAuth, getGoogleDriveService } from '../../../packages/shared/services/google-drive';
import type { Database } from '../../../supabase/types';

// Initialize logger
import { LogLevel } from '../../../packages/shared/utils/logger';
Logger.setLevel(LogLevel.INFO);

// Known folder IDs
const KNOWN_FOLDERS: Record<string, string> = {
  'dynamic-healing': '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
  'polyvagal-steering': '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc',
  'dhg-repository': '1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1',
};

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  recursive: args.includes('--recursive'),
  stats: args.includes('--stats'),
  statsTypes: args.includes('--stats-types'),
  limit: 50
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Filter out option flags to get the folder ID
const folderId = args.find(arg => !arg.startsWith('--'));

// If we're just showing stats, we don't need a folder ID
if (!options.stats && !options.statsTypes && !folderId) {
  Logger.error('❌ Folder ID is required');
  Logger.info('Usage: npx ts-node sync-drive-service.ts <folderId> [options]');
  Logger.info('   or: npx ts-node sync-drive-service.ts --stats');
  Logger.info('   or: npx ts-node sync-drive-service.ts --stats-types');
  process.exit(1);
}

async function main() {
  try {
    // Get the Supabase client - skip connection test since it's failing
    const supabaseClientService = SupabaseClientService.getInstance();
    
    let supabase;
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('Got Supabase client');
    } catch (error) {
      Logger.error('Error getting Supabase client', error);
      process.exit(1);
    }

    // Check if auth service is ready
    if (!await defaultGoogleAuth.isReady()) {
      Logger.error('Google authentication is not ready');
      process.exit(1);
    }
    
    // Get access token
    const accessToken = await defaultGoogleAuth.getAccessToken();
    if (!accessToken) {
      Logger.error('Failed to get access token');
      process.exit(1);
    }
    
    // Create auth from the access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    // Initialize the Drive client
    const drive = google.drive({ version: 'v3', auth });
    
    if (!drive) {
      Logger.error('❌ Failed to initialize Drive client');
      process.exit(1);
    }

    // If we're just showing stats, display them and exit
    if (options.stats) {
      await showStats(supabase);
      return;
    }

    // If we're showing file type stats, display them and exit
    if (options.statsTypes) {
      await showStats(supabase, true);
      return;
    }

    // Get the resolved folder ID if it's an alias
    let resolvedFolderId = folderId || '';
    if (folderId && KNOWN_FOLDERS[folderId]) {
      resolvedFolderId = KNOWN_FOLDERS[folderId];
      Logger.info(`Using known folder ID for "${folderId}": ${resolvedFolderId}`);
    }

    Logger.info(`🔍 Checking folder with ID: ${resolvedFolderId}`);
    
    // Verify the folder exists in Google Drive
    try {
      const folderData = await drive.files.get({
        fileId: resolvedFolderId,
        fields: 'id,name,mimeType'
      });
      
      const isFolder = folderData.data.mimeType === 'application/vnd.google-apps.folder';
      
      if (!isFolder) {
        Logger.error(`❌ The provided ID is not a folder: ${folderData.data.mimeType}`);
        process.exit(1);
      }
      
      const folderName = folderData.data.name;
      Logger.info(`Syncing folder: "${folderName}" (${resolvedFolderId})`);
      Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
      Logger.info(`Recursive: ${options.recursive ? 'Yes' : 'No'}`);
      Logger.info(`Limit: ${options.limit} files per folder`);
      
      // Get folder details from the database
      const { data: dbFolder, error: dbError } = await supabase
        .from('sources_google')
        .select('id, drive_id, name, is_root, path')
        .eq('drive_id', resolvedFolderId)
        .eq('deleted', false)
        .single();
        
      if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
        throw dbError;
      }
      
      // Starting the sync process
      Logger.info('Starting sync process...');
      
      // Get files in the folder
      const files = await listFiles(drive, resolvedFolderId, options.recursive);
      
      Logger.info(`Found ${files.length} files in the folder`);
      
      // If dry run, just show what would be synced
      if (options.dryRun) {
        Logger.info('\n=== DRY RUN - No changes will be made ===\n');
        
        // Group files by mime type
        const filesByType: Record<string, any[]> = {};
        files.forEach(file => {
          const type = file.mimeType || 'unknown';
          if (!filesByType[type]) {
            filesByType[type] = [];
          }
          filesByType[type].push(file);
        });
        
        // Display summary by mime type
        Logger.info('Files by type:');
        Object.entries(filesByType).forEach(([type, typeFiles]) => {
          Logger.info(`- ${type}: ${typeFiles.length} files`);
        });
        
        // Show sample of each type
        Logger.info('\nSample files by type:');
        Object.entries(filesByType).forEach(([type, typeFiles]) => {
          Logger.info(`\n${type}:`);
          typeFiles.slice(0, 5).forEach(file => {
            Logger.info(`- ${file.name} (${file.id})`);
            if (file.path) {
              Logger.info(`  Path: ${file.path}`);
            }
          });
          if (typeFiles.length > 5) {
            Logger.info(`  ... and ${typeFiles.length - 5} more`);
          }
        });
        
        // Show folder structure if recursive
        if (options.recursive) {
          Logger.info('\nFolder structure:');
          const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
          folders.forEach(folder => {
            Logger.info(`- ${folder.path || '/'}`);
          });
        }
        
        Logger.info('\n=== END DRY RUN ===');
      } else {
        Logger.info('\n=== ACTUAL SYNC - Changes will be made to the database ===\n');
        
        // Process files in batches
        const now = new Date().toISOString();
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Process files in groups of 50
        for (let i = 0; i < files.length; i += 50) {
          const batch = files.slice(i, i + 50);
          Logger.info(`Processing batch ${i/50 + 1} of ${Math.ceil(files.length/50)} (${batch.length} files)...`);
          
          for (const file of batch) {
            // Check if the file already exists in the database
            const { data: existingFiles, error: queryError } = await supabase
              .from('sources_google')
              .select('id, drive_id, name, modified_time')
              .eq('drive_id', file.id)
              .eq('deleted', false);
              
            if (queryError) {
              Logger.error(`Error checking if file ${file.name} exists:`, queryError.message);
              continue;
            }
            
            const fileExists = existingFiles && existingFiles.length > 0;
            
            if (fileExists) {
              // Update existing file
              const existingFile = existingFiles[0];
              
              // Only update if modified time is different
              const existingModified = existingFile.modified_time ? new Date(existingFile.modified_time).getTime() : 0;
              const newModified = file.modifiedTime ? new Date(file.modifiedTime).getTime() : 0;
              
              if (Math.abs(existingModified - newModified) < 1000) { // Within 1 second
                Logger.debug(`Skipping unmodified file: ${file.name}`);
                skippedCount++;
                continue;
              }
              
              // Update the file
              const { error: updateError } = await supabase
                .from('sources_google')
                .update({
                  name: file.name,
                  mime_type: file.mimeType,
                  path: file.path,
                  parent_path: file.parentPath,
                  parent_folder_id: file.parentFolderId,
                  modified_time: file.modifiedTime,
                  size: file.size ? parseInt(file.size, 10) : null,
                  updated_at: now
                })
                .eq('id', existingFile.id);
                
              if (updateError) {
                Logger.error(`Error updating file ${file.name}:`, updateError.message);
              } else {
                updatedCount++;
                Logger.debug(`Updated file: ${file.name}`);
              }
            } else {
              // Insert new file
              const { error: insertError } = await supabase
                .from('sources_google')
                .insert({
                  drive_id: file.id,
                  name: file.name,
                  mime_type: file.mimeType,
                  path: file.path,
                  parent_path: file.parentPath,
                  parent_folder_id: file.parentFolderId,
                  is_root: false,
                  modified_time: file.modifiedTime,
                  size: file.size ? parseInt(file.size, 10) : null,
                  created_at: now,
                  updated_at: now,
                  deleted: false
                });
                
              if (insertError) {
                Logger.error(`Error inserting file ${file.name}:`, insertError.message);
              } else {
                insertedCount++;
                Logger.debug(`Inserted file: ${file.name}`);
              }
            }
          }
        }
        
        // Update stats
        Logger.info(`Sync completed successfully!`);
        Logger.info(`- Files processed: ${files.length}`);
        Logger.info(`- Files inserted: ${insertedCount}`);
        Logger.info(`- Files updated: ${updatedCount}`);
        Logger.info(`- Files skipped: ${skippedCount}`);
        
        // Update last_indexed on the root folder if this is a root folder
        if (dbFolder && dbFolder.is_root) {
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({
              last_indexed: now
            })
            .eq('id', dbFolder.id);
            
          if (updateError) {
            Logger.error(`Error updating last_indexed for root folder:`, updateError.message);
          } else {
            Logger.info(`Updated last_indexed for root folder: ${dbFolder.name}`);
          }
        }
      }
      
    } catch (error: any) {
      Logger.error(`❌ Error accessing folder: ${error.message}`);
      process.exit(1);
    }
  
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Show statistics about synced files in the database
 * @param supabase Supabase client
 * @param detailedFileTypes If true, shows more detailed file type statistics
 */
async function showStats(supabase: any, detailedFileTypes: boolean = false) {
  Logger.info('📊 Retrieving Google Drive sync statistics...');
  
  try {
    // Get total count and size
    const { count: totalCount, error: countError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .eq('deleted', false);
      
    if (countError) {
      throw countError;
    }
    
    // Get folder count
    const { count: folderCount, error: folderError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .eq('deleted', false)
      .eq('mime_type', 'application/vnd.google-apps.folder');
      
    if (folderError) {
      throw folderError;
    }
    
    // Get total size
    const { data: sizeData, error: sizeError } = await supabase
      .from('sources_google')
      .select('size')
      .eq('deleted', false);
      
    if (sizeError) {
      throw sizeError;
    }
    
    // Calculate total size
    const totalSize = sizeData.reduce((sum: number, file: any) => {
      return sum + (parseInt(file.size, 10) || 0);
    }, 0);
    
    // Get counts by mime type - we'll just fetch all items and count types in memory
    const { data: typeData, error: typeError } = await supabase
      .from('sources_google')
      .select('mime_type')
      .eq('deleted', false)
      .not('mime_type', 'is', null);
      
    if (typeError) {
      throw typeError;
    }
    
    // Count mime types manually
    const typeMap: Record<string, number> = {};
    typeData.forEach((item: any) => {
      const type = item.mime_type;
      typeMap[type] = (typeMap[type] || 0) + 1;
    });
    
    // Get root folders
    const { data: rootFolders, error: rootFoldersError } = await supabase
      .from('sources_google')
      .select('name, drive_id, last_indexed')
      .eq('deleted', false)
      .eq('is_root', true);
      
    if (rootFoldersError) {
      throw rootFoldersError;
    }
    
    // Display statistics
    Logger.info('\n=== Google Drive Sync Statistics ===');
    Logger.info(`Total files: ${totalCount - folderCount}`);
    Logger.info(`Total folders: ${folderCount}`);
    Logger.info(`Total items: ${totalCount}`);
    Logger.info(`Total size: ${formatBytes(totalSize)}`);
    
    // Display file types
    Logger.info('\nFile types:');
    
    if (detailedFileTypes) {
      // For detailed file types, show more categories and group similar types
      Logger.info('\n=== DETAILED FILE TYPE STATISTICS ===');
      
      // Group file types by category
      const categories: Record<string, number> = {
        'Documents': 0,
        'Spreadsheets': 0,
        'Presentations': 0,
        'Images': 0,
        'Audio': 0,
        'Video': 0,
        'PDFs': 0,
        'Code': 0,
        'Folders': 0,
        'Other': 0
      };
      
      // Count by high-level category
      Object.entries(typeMap).forEach(([type, count]) => {
        const typeLower = type.toLowerCase();
        
        if (type === 'application/vnd.google-apps.folder') {
          categories['Folders'] += count;
        } else if (typeLower.includes('document') || typeLower.includes('msword') || 
                   typeLower.includes('text/') || typeLower.includes('rtf')) {
          categories['Documents'] += count;
        } else if (typeLower.includes('sheet') || typeLower.includes('excel') || 
                   typeLower.includes('csv')) {
          categories['Spreadsheets'] += count;
        } else if (typeLower.includes('presentation') || typeLower.includes('powerpoint') || 
                   typeLower.includes('slide')) {
          categories['Presentations'] += count;
        } else if (typeLower.includes('image/') || typeLower.includes('photo')) {
          categories['Images'] += count;
        } else if (typeLower.includes('audio/') || typeLower.includes('sound')) {
          categories['Audio'] += count;
        } else if (typeLower.includes('video/') || typeLower.includes('movie')) {
          categories['Video'] += count;
        } else if (typeLower.includes('pdf')) {
          categories['PDFs'] += count;
        } else if (typeLower.includes('code') || typeLower.includes('javascript') ||
                   typeLower.includes('python') || typeLower.includes('java') ||
                   typeLower.includes('typescript')) {
          categories['Code'] += count;
        } else {
          categories['Other'] += count;
        }
      });
      
      // Display high-level categories
      Logger.info('File categories:');
      Object.entries(categories)
        .filter(([_category, count]) => count > 0)
        .sort(([_c1, a], [_c2, b]) => b - a)
        .forEach(([category, count]) => {
          Logger.info(`- ${category}: ${count}`);
        });
          
      // Show detailed breakdown
      Logger.info('\nDetailed file types:');
    }
    
    // Always show file types sorted by count
    Object.entries(typeMap)
      .sort(([, a], [, b]) => b - a) // Sort by count, descending
      .forEach(([type, count]) => {
        Logger.info(`- ${type}: ${count}`);
      });
    
    // Display root folders
    Logger.info('\nRoot folders:');
    rootFolders.forEach((folder: any) => {
      Logger.info(`- ${folder.name} (${folder.drive_id})`);
      if (folder.last_indexed) {
        Logger.info(`  Last synced: ${new Date(folder.last_indexed).toLocaleString()}`);
      } else {
        Logger.info('  Never synced');
      }
    });
    
    Logger.info('\n=== End of Statistics ===');
  } catch (error: any) {
    Logger.error(`❌ Error fetching statistics: ${error.message}`);
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Initialize Google Drive client using service account
 */
/**
 * No longer used - we are using defaultGoogleAuth instead
 */
async function initDriveClient() {
  try {
    // This function is no longer used
    Logger.error('This function is deprecated');
    return null;
    
  } catch (error: any) {
    Logger.error('❌ Error initializing Drive client:', error.message);
    return null;
  }
}

/**
 * List files in a Google Drive folder
 */
async function listFiles(drive: any, folderId: string, recursive: boolean = false): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken = null;
  const parentFolder = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType'
  });
  
  const parentPath = `/${parentFolder.data.name}`;
  
  // Query to get files in the current folder
  const query = `'${folderId}' in parents and trashed=false`;
  
  do {
    Logger.info(`Fetching files from folder ${folderId}...`);
    
    // Get a page of files
    const response: any = await drive.files.list({
      q: query,
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, size)',
      pageToken: pageToken
    });
    
    const files = response.data.files || [];
    
    // Process files
    const enhancedFiles = files.map((file: any) => {
      return {
        ...file,
        path: `${parentPath}/${file.name}`,
        parentPath: parentPath,
        parentFolderId: folderId
      };
    });
    
    // Add files to the collection
    allFiles = [...allFiles, ...enhancedFiles];
    
    if (recursive) {
      // Process subfolders
      const folders = files.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder');
      
      for (const folder of folders) {
        Logger.info(`Processing subfolder: ${folder.name} (${folder.id})...`);
        const subFiles = await listFiles(drive, folder.id, true);
        allFiles = [...allFiles, ...subFiles];
      }
    }
    
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

// Execute the main function
main().catch(error => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});