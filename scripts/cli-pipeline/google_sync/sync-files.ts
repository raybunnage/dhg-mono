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
        .from('sources_google')
        .select('id, drive_id, is_root')
        .eq('drive_id', rootDriveId)
        .eq('is_deleted', false)
        .single();
      
      if (!existingRoot) {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('sources_google')
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
      .from('sources_google')
      .select('id, drive_id, name')
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
    
    // Insert new files in batches
    if (newFiles.length > 0) {
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
          .from('sources_google')
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
            .from('sources_google')
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
    // Check for active filter profile
    const activeFilter = await getActiveFilterProfile();
    let rootDriveId = DYNAMIC_HEALING_FOLDER_ID;
    
    if (activeFilter && activeFilter.rootDriveId) {
      console.log(`🔍 Active filter: "${activeFilter.profile.name}"`);
      console.log(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
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
      console.log('\n💡 Tip: Run process-new-files to create expert_documents for new files');
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