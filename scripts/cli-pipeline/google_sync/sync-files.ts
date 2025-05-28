#!/usr/bin/env ts-node
/**
 * Core file sync functionality - Fast and focused
 * 
 * This command performs the core sync operation:
 * - Lists files from Google Drive
 * - Compares with database
 * - Inserts new files (without processing)
 * - Marks missing files as deleted
 * 
 * Usage:
 *   ts-node sync-files.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be synced without making changes
 *   --max-depth <n>    Maximum folder depth to traverse (default: 6)
 *   --verbose          Show detailed logs
 *   --skip-deletions   Skip marking files as deleted
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService, GoogleDriveService } from '../../../packages/shared/services/google-drive';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';
import { displayActiveFilter } from './display-active-filter';

// Load environment files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const skipDeletions = args.includes('--skip-deletions');

const maxDepthIndex = args.indexOf('--max-depth');
const maxDepth = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
  ? parseInt(args[maxDepthIndex + 1], 10) 
  : 6;

// Default folder ID
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  path?: string;
  parentPath?: string;
  parentFolderId?: string;
  depth?: number;
}

interface SyncResult {
  filesFound: number;
  filesInserted: number;
  filesMarkedDeleted: number;
  filesSkipped: number;
  errors: string[];
  duration: number;
}

/**
 * Progress tracking for file scanning
 */
let scanProgress = {
  foldersScanned: 0,
  filesFound: 0,
  currentPath: '',
  startTime: Date.now(),
  lastUpdate: Date.now()
};

/**
 * Display progress update
 */
function updateScanProgress(path: string, filesInFolder: number) {
  scanProgress.foldersScanned++;
  scanProgress.filesFound += filesInFolder;
  scanProgress.currentPath = path;
  
  // Only update display every 100ms to avoid flickering
  const now = Date.now();
  if (now - scanProgress.lastUpdate < 100) return;
  scanProgress.lastUpdate = now;
  
  const elapsed = (now - scanProgress.startTime) / 1000;
  const rate = scanProgress.foldersScanned / elapsed;
  
  // Clear previous line and show progress
  process.stdout.write('\r\x1b[K'); // Clear line
  process.stdout.write(
    `📂 Scanning: ${scanProgress.foldersScanned} folders | ` +
    `📄 ${scanProgress.filesFound} files | ` +
    `⚡ ${rate.toFixed(1)} folders/sec | ` +
    `📍 ${path.slice(-50)}`
  );
}

/**
 * Show final scan summary
 */
function finalizeScanProgress() {
  const elapsed = (Date.now() - scanProgress.startTime) / 1000;
  const rate = scanProgress.foldersScanned / elapsed;
  
  process.stdout.write('\r\x1b[K'); // Clear line
  console.log(
    `✅ Scan complete: ${scanProgress.foldersScanned} folders | ` +
    `${scanProgress.filesFound} files | ` +
    `${elapsed.toFixed(1)}s | ` +
    `${rate.toFixed(1)} folders/sec`
  );
}

/**
 * List files recursively with optimized performance
 */
async function listFilesRecursively(
  driveService: GoogleDriveService, 
  folderId: string, 
  maxDepth: number = 6,
  currentDepth: number = 0,
  parentPath: string = '/'
): Promise<GoogleDriveFile[]> {
  let allFiles: GoogleDriveFile[] = [];
  
  if (currentDepth > maxDepth) {
    if (isVerbose) console.log(`\nReached max depth (${maxDepth}) at ${parentPath}`);
    return [];
  }
  
  try {
    // Get files in the folder with larger page size for efficiency
    const listResult = await driveService.listFiles(folderId, {
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, parents, modifiedTime, size, thumbnailLink)',
      pageSize: 1000
    });
    
    const files = listResult.files;
    
    if (isVerbose && listResult.nextPageToken) {
      console.log(`\nWarning: More files exist beyond page size in folder ${folderId}`);
    }
    
    // Process files
    const enhancedFiles = files.map((file: GoogleDriveFile) => {
      const filePath = `${parentPath}${file.name}`;
      return {
        ...file,
        path: filePath,
        parentPath: parentPath,
        parentFolderId: folderId,
        depth: currentDepth
      };
    });
    
    allFiles = [...allFiles, ...enhancedFiles];
    
    // Update progress
    updateScanProgress(parentPath, files.length);
    
    // Process subfolders recursively
    const folders = files.filter((file: GoogleDriveFile) => 
      file.mimeType === 'application/vnd.google-apps.folder'
    );
    
    // Process folders in parallel for speed
    const subfolderPromises = folders.map(folder => 
      listFilesRecursively(
        driveService, 
        folder.id, 
        maxDepth, 
        currentDepth + 1, 
        `${parentPath}${folder.name}/`
      )
    );
    
    const subfolderResults = await Promise.all(subfolderPromises);
    for (const subfolderFiles of subfolderResults) {
      allFiles = [...allFiles, ...subfolderFiles];
    }
    
  } catch (error: any) {
    console.error(`Error listing files in folder ${folderId}: ${error.message}`);
  }
  
  return allFiles;
}

/**
 * Display new files in a formatted table grouped by folder
 */
async function displayNewFilesTable(files: GoogleDriveFile[], existingRecords: any[]) {
  console.log('\n📋 New Files Found:');
  
  // Generate source IDs (UUIDs) for new files
  const sourceIdMap = new Map<string, string>();
  files.forEach(file => {
    sourceIdMap.set(file.id, uuidv4());
  });
  
  // Group all items by parent folder
  const filesByFolder = new Map<string, GoogleDriveFile[]>();
  const folderInfoMap = new Map<string, GoogleDriveFile>();
  
  // Create a map of existing records by drive_id for quick lookup
  const existingByDriveId = new Map<string, any>();
  existingRecords.forEach(record => {
    existingByDriveId.set(record.drive_id, record);
  });
  
  // First pass: identify all new folders
  files.forEach(file => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      folderInfoMap.set(file.id, file);
    }
  });
  
  // Second pass: group ALL items (folders AND files) by their parent folder
  files.forEach(file => {
    const parentId = file.parentFolderId || 'root';
    
    if (!filesByFolder.has(parentId)) {
      filesByFolder.set(parentId, []);
    }
    filesByFolder.get(parentId)!.push(file);
  });
  
  // Also ensure new folders appear as their own entries if they're empty
  folderInfoMap.forEach((folder, folderId) => {
    if (!filesByFolder.has(folderId)) {
      filesByFolder.set(folderId, []);
    }
  });
  
  // Sort folders by path
  const sortedFolderIds = Array.from(filesByFolder.keys()).sort((a, b) => {
    const folderA = folderInfoMap.get(a);
    const folderB = folderInfoMap.get(b);
    const pathA = folderA?.path || files.find(f => f.parentFolderId === a)?.parentPath || '';
    const pathB = folderB?.path || files.find(f => f.parentFolderId === b)?.parentPath || '';
    return pathA.localeCompare(pathB);
  });
  
  // Define column widths for file display
  const NAME_WIDTH = 55;
  const ID_WIDTH = 36;
  const PARENT_ID_WIDTH = 36;
  const MIME_WIDTH = 40; // Adjusted for space
  const DATE_WIDTH = 10;
  
  // Calculate total width (with parent_folder_id column)
  const TOTAL_WIDTH = NAME_WIDTH + ID_WIDTH + PARENT_ID_WIDTH + MIME_WIDTH + DATE_WIDTH + 16; // 16 for separators and padding
  
  let totalDisplayed = 0;
  const MAX_DISPLAY = 50; // Max files to display
  
  // Display files grouped by folder
  for (const folderId of sortedFolderIds) {
    if (totalDisplayed >= MAX_DISPLAY) break;
    
    const filesInFolder = filesByFolder.get(folderId)!;
    if (filesInFolder.length === 0) continue;
    
    // Get folder info
    const folderInfo = folderInfoMap.get(folderId);
    const firstFile = filesInFolder[0];
    
    // Display folder header
    console.log('\n' + '═'.repeat(TOTAL_WIDTH));
    
    // Check if this folder exists in our new files (it's a new folder)
    const newFolderInfo = folderInfoMap.get(folderId);
    
    // Check if this folder exists in the database already
    const existingFolderInfo = existingByDriveId.get(folderId);
    
    if (newFolderInfo) {
      // This is a NEW folder being added
      const createdDate = newFolderInfo.modifiedTime 
        ? new Date(newFolderInfo.modifiedTime).toLocaleDateString()
        : new Date().toLocaleDateString();
      const modifiedDate = newFolderInfo.modifiedTime 
        ? new Date(newFolderInfo.modifiedTime).toLocaleDateString()
        : 'Unknown';
      
      const folderSourceId = sourceIdMap.get(newFolderInfo.id) || 'Unknown';
      
      console.log(`📁 NEW FOLDER: ${newFolderInfo.name}`);
      console.log(`   Source ID (to be created): ${folderSourceId}`);
      console.log(`   Drive ID: ${newFolderInfo.id}`);
      console.log(`   Parent Folder ID: ${newFolderInfo.parentFolderId || 'root'}`);
      console.log(`   Path: ${newFolderInfo.path || '/'}`);
      console.log(`   Path Depth: ${newFolderInfo.depth !== undefined ? newFolderInfo.depth : 0}`);
      console.log(`   Created: ${createdDate} | Modified: ${modifiedDate}`);
      
      // Show parent folder info if this new folder is nested
      if (newFolderInfo.parentFolderId) {
        const parentInfo = existingByDriveId.get(newFolderInfo.parentFolderId);
        if (parentInfo) {
          console.log(`   Parent Name: ${parentInfo.name} (existing, depth: ${parentInfo.path_depth})`);
        }
      }
    } else if (existingFolderInfo) {
      // This is an EXISTING folder that contains new files
      console.log(`📁 EXISTING FOLDER: ${existingFolderInfo.name}`);
      console.log(`   Supabase ID: ${existingFolderInfo.id}`);
      console.log(`   Drive ID: ${existingFolderInfo.drive_id}`);
      console.log(`   Parent Folder ID: ${existingFolderInfo.parent_folder_id || 'root'}`);
      console.log(`   Path: ${existingFolderInfo.path || '/'}`);
      console.log(`   Path Depth: ${existingFolderInfo.path_depth !== undefined ? existingFolderInfo.path_depth : 0}`);
    } else if (firstFile) {
      // Parent folder not found in either new files or existing records
      // This shouldn't happen often, but let's handle it
      console.log(`📁 PARENT FOLDER (not found in records)`);
      console.log(`   Parent Folder Drive ID: ${folderId}`);
      console.log(`   Parent Path from file: ${firstFile.parentPath || '/'}`);
      console.log(`   ⚠️  This folder should exist but wasn't found in the database`);
    } else {
      // Fallback case - might be an empty new folder
      console.log(`📁 Folder Drive ID: ${folderId}`);
      console.log(`   (No information available)`);
    }
    console.log('─'.repeat(TOTAL_WIDTH));
    
    // Table header for files
    console.log(
      '│ ' + 
      'File Name'.padEnd(NAME_WIDTH) + ' │ ' +
      'Source ID'.padEnd(ID_WIDTH) + ' │ ' +
      'Parent Folder ID'.padEnd(PARENT_ID_WIDTH) + ' │ ' +
      'MIME Type'.padEnd(MIME_WIDTH) + ' │ ' +
      'Modified'.padEnd(DATE_WIDTH) + ' │'
    );
    console.log('─'.repeat(TOTAL_WIDTH));
    
    // Sort items in this folder by type (folders first) then by name
    const sortedItems = filesInFolder.sort((a, b) => {
      // Folders first
      if (a.mimeType === 'application/vnd.google-apps.folder' && b.mimeType !== 'application/vnd.google-apps.folder') return -1;
      if (a.mimeType !== 'application/vnd.google-apps.folder' && b.mimeType === 'application/vnd.google-apps.folder') return 1;
      // Then by name
      return a.name.localeCompare(b.name);
    });
    
    // Display items in this folder
    for (const item of sortedItems) {
      if (totalDisplayed >= MAX_DISPLAY) break;
      
      // Truncate name if too long
      const itemName = item.name.length > NAME_WIDTH 
        ? item.name.substring(0, NAME_WIDTH - 3) + '...' 
        : item.name;
      
      // Format mime type - show folder type clearly
      const mimeType = item.mimeType || 'Unknown';
      const displayMimeType = mimeType === 'application/vnd.google-apps.folder' 
        ? '📁 FOLDER' 
        : mimeType;
      const mimeTypeTruncated = displayMimeType.length > MIME_WIDTH
        ? displayMimeType.substring(0, MIME_WIDTH - 3) + '...'
        : displayMimeType;
      
      // Format date
      const modifiedDate = item.modifiedTime 
        ? new Date(item.modifiedTime).toLocaleDateString()
        : 'Unknown';
      
      // Get the source ID (UUID) for this item
      const sourceId = sourceIdMap.get(item.id) || 'Unknown';
      
      console.log(
        '│ ' + 
        itemName.padEnd(NAME_WIDTH) + ' │ ' +
        sourceId.padEnd(ID_WIDTH) + ' │ ' +
        (item.parentFolderId || 'root').padEnd(PARENT_ID_WIDTH) + ' │ ' +
        mimeTypeTruncated.padEnd(MIME_WIDTH) + ' │ ' +
        modifiedDate.padEnd(DATE_WIDTH) + ' │'
      );
      
      totalDisplayed++;
    }
    
    console.log('─'.repeat(TOTAL_WIDTH));
  }
  
  if (files.length > totalDisplayed) {
    console.log(`\n... and ${files.length - totalDisplayed} more files`);
  }
  
  // Show file type summary
  console.log('\n📊 File Type Summary:');
  const typeCount = new Map<string, number>();
  
  files.forEach(file => {
    const type = file.mimeType || 'Unknown';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });
  
  // Sort by count descending
  const sortedTypes = Array.from(typeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 types
  
  sortedTypes.forEach(([type, count]) => {
    const percentage = ((count / files.length) * 100).toFixed(1);
    console.log(`  • ${type}: ${count} files (${percentage}%)`);
  });
  
  if (typeCount.size > 10) {
    console.log(`  ... and ${typeCount.size - 10} more file types`);
  }
}

/**
 * Core sync function - focused on file existence only
 */
async function syncFiles(
  driveService: GoogleDriveService,
  rootDriveId: string
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    filesFound: 0,
    filesInserted: 0,
    filesMarkedDeleted: 0,
    filesSkipped: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Get folder details
    const folder = await driveService.getFile(
      rootDriveId,
      'id,name,mimeType,webViewLink,modifiedTime'
    );
    
    console.log(`📁 Syncing folder: ${folder.name} (${rootDriveId})`);
    
    // Ensure root folder exists in database
    if (!isDryRun) {
      const { data: existingRoot } = await supabase
        .from('google_sources')
        .select('id, drive_id, is_root')
        .eq('drive_id', rootDriveId)
        .eq('is_deleted', false)
        .single();
      
      if (!existingRoot) {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('google_sources')
          .insert({
            id: uuidv4(),
            drive_id: rootDriveId,
            name: folder.name,
            is_root: true,
            mime_type: 'application/vnd.google-apps.folder',
            path: `/${folder.name}`,
            path_array: ['', folder.name],
            path_depth: 2,
            parent_folder_id: null,
            metadata: { 
              isRootFolder: true,
              webViewLink: folder.webViewLink,
              modifiedTime: folder.modifiedTime
            },
            created_at: now,
            updated_at: now,
            is_deleted: false,
            root_drive_id: rootDriveId
          });
        
        if (error) throw error;
        console.log('✓ Registered root folder');
      }
    }
    
    // List all files
    console.log(`🔍 Scanning files (max depth: ${maxDepth})...`);
    scanProgress.startTime = Date.now(); // Reset timer for scanning
    const allFiles = await listFilesRecursively(driveService, rootDriveId, maxDepth);
    
    finalizeScanProgress(); // Show final scan summary
    
    result.filesFound = allFiles.length;
    console.log(`\n📊 Total files found: ${allFiles.length}`);
    
    if (isDryRun) {
      console.log(`DRY RUN: Would process ${allFiles.length} files`);
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    // Get existing files for this root
    console.log('\n🔍 Checking existing files in database...');
    const queryStartTime = Date.now();
    
    const { data: existingRecords, error: queryError } = await supabase
      .from('google_sources')
      .select('id, drive_id, name, path, path_depth, mime_type, parent_folder_id')
      .eq('root_drive_id', rootDriveId)
      .eq('is_deleted', false);
    
    if (queryError) throw queryError;
    
    const queryElapsed = (Date.now() - queryStartTime) / 1000;
    console.log(`✅ Found ${existingRecords?.length || 0} existing files (${queryElapsed.toFixed(1)}s)`);
    
    // Create lookup sets
    console.log('\n📊 Analyzing changes...');
    const foundDriveIds = new Set([...allFiles.map(f => f.id), rootDriveId]);
    const existingDriveIds = new Set((existingRecords || []).map(r => r.drive_id));
    
    // Find new files
    const newFiles = allFiles.filter(file => !existingDriveIds.has(file.id));
    console.log(`📝 ${newFiles.length} new files to insert`);
    
    // Display new files table
    if (newFiles.length > 0) {
      await displayNewFilesTable(newFiles, existingRecords || []);
    }
    
    // Insert new files in batches
    if (newFiles.length > 0 && !isDryRun) {
      const BATCH_SIZE = 100;
      const batches = Math.ceil(newFiles.length / BATCH_SIZE);
      
      console.log(`\n📥 Inserting ${newFiles.length} new files in ${batches} batches...`);
      const insertStartTime = Date.now();
      
      for (let i = 0; i < batches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, newFiles.length);
        const batch = newFiles.slice(start, end);
        
        const insertData = batch.map(file => ({
          id: uuidv4(),
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          path: file.path,
          path_array: file.path?.split('/').filter(Boolean) || [],
          path_depth: file.depth || 0,
          parent_folder_id: file.parentFolderId,
          root_drive_id: rootDriveId,
          size: file.size ? parseInt(file.size, 10) : null,
          thumbnail_link: file.thumbnailLink,
          web_view_link: file.webViewLink,
          modified_at: file.modifiedTime,
          metadata: {
            webViewLink: file.webViewLink,
            thumbnailLink: file.thumbnailLink,
            modifiedTime: file.modifiedTime
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        }));
        
        const { error } = await supabase
          .from('google_sources')
          .insert(insertData);
        
        if (error) {
          result.errors.push(`Batch ${i + 1} error: ${error.message}`);
          result.filesSkipped += batch.length;
          process.stdout.write('\r\x1b[K');
          console.log(`❌ Batch ${i + 1}/${batches} failed (${batch.length} files): ${error.message}`);
        } else {
          result.filesInserted += batch.length;
          const elapsed = (Date.now() - insertStartTime) / 1000;
          const rate = result.filesInserted / elapsed;
          
          process.stdout.write('\r\x1b[K');
          process.stdout.write(
            `📥 Progress: ${i + 1}/${batches} batches | ` +
            `${result.filesInserted}/${newFiles.length} files | ` +
            `⚡ ${rate.toFixed(0)} files/sec`
          );
        }
      }
      
      const totalElapsed = (Date.now() - insertStartTime) / 1000;
      process.stdout.write('\r\x1b[K');
      console.log(
        `✅ Insert complete: ${result.filesInserted} files | ` +
        `${totalElapsed.toFixed(1)}s | ` +
        `${(result.filesInserted / totalElapsed).toFixed(0)} files/sec`
      );
    }
    
    // Handle deletions
    if (!skipDeletions) {
      const recordsToDelete = (existingRecords || [])
        .filter(r => r.drive_id !== rootDriveId && !foundDriveIds.has(r.drive_id));
      
      if (recordsToDelete.length > 0) {
        console.log(`\n🗑️  Marking ${recordsToDelete.length} files as deleted...`);
        
        const deleteStartTime = Date.now();
        const deleteIds = recordsToDelete.map(r => r.id);
        
        // Process deletions in batches for performance
        const DELETE_BATCH_SIZE = 100;
        const deleteBatches = Math.ceil(deleteIds.length / DELETE_BATCH_SIZE);
        
        for (let i = 0; i < deleteBatches; i++) {
          const start = i * DELETE_BATCH_SIZE;
          const end = Math.min(start + DELETE_BATCH_SIZE, deleteIds.length);
          const batchIds = deleteIds.slice(start, end);
          
          const { error } = await supabase
            .from('google_sources')
            .update({
              is_deleted: true,
              updated_at: new Date().toISOString()
            })
            .in('id', batchIds);
          
          if (error) {
            result.errors.push(`Deletion batch ${i + 1} error: ${error.message}`);
          } else {
            result.filesMarkedDeleted += batchIds.length;
            
            process.stdout.write('\r\x1b[K');
            process.stdout.write(
              `🗑️  Progress: ${i + 1}/${deleteBatches} batches | ` +
              `${result.filesMarkedDeleted}/${recordsToDelete.length} files`
            );
          }
        }
        
        const deleteElapsed = (Date.now() - deleteStartTime) / 1000;
        process.stdout.write('\r\x1b[K');
        console.log(
          `✅ Deletion complete: ${result.filesMarkedDeleted} files | ` +
          `${deleteElapsed.toFixed(1)}s`
        );
      }
    }
    
  } catch (error: any) {
    console.error('❌ Sync error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Google Drive File Sync (Core) ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max depth: ${maxDepth}`);
  console.log(`Skip deletions: ${skipDeletions}`);
  console.log('=====================================\n');
  
  try {
    // Display active filter prominently
    const activeFilter = await displayActiveFilter();
    let rootDriveId = DYNAMIC_HEALING_FOLDER_ID;
    
    if (activeFilter && activeFilter.rootDriveId) {
      rootDriveId = activeFilter.rootDriveId;
    }
    
    // Initialize Google Drive service
    const driveService = getGoogleDriveService(supabase);
    
    // Run sync
    const result = await syncFiles(driveService, rootDriveId);
    
    // Display results
    console.log('\n=== Sync Complete ===');
    console.log(`✓ Files found: ${result.filesFound}`);
    console.log(`✓ Files inserted: ${result.filesInserted}`);
    console.log(`✓ Files deleted: ${result.filesMarkedDeleted}`);
    console.log(`✓ Files skipped: ${result.filesSkipped}`);
    console.log(`✓ Errors: ${result.errors.length}`);
    console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (result.filesInserted > 0) {
      console.log('\n💡 Tip: Run process-new-files-enhanced to create expert_documents for new files');
    }
    
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { syncFiles };

// Run if called directly
if (require.main === module) {
  main();
}