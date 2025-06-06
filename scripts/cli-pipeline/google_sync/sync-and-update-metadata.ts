#!/usr/bin/env ts-node
/**
 * Sync and Update Google Drive Metadata using Service Account
 * 
 * This script synchronizes files from the Dynamic Healing Discussion Group
 * folder in Google Drive to the local database, and then updates metadata 
 * for the files. It uses a Google Service Account for authentication, which
 * is more stable than using short-lived OAuth tokens.
 * 
 * Usage:
 *   ts-node sync-and-update-metadata.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be synced/updated without making changes
 *   --limit <n>        Limit to updating n records (default: 10)
 *   --max-depth <n>    Maximum folder depth to traverse (default: 3)
 *   --verbose          Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService, GoogleDriveService } from '../../../packages/shared/services/google-drive';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';
// Note: converterService is dynamically imported within the updateMetadata function
// to avoid circular dependencies

// Load multiple environment files
function loadEnvFiles() {
  // Order matters - later files override earlier ones
  const envFiles = [
    '.env',
    '.env.local',
    '.env.development'
  ];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
  
  // Display loaded environment variables
  console.log('Current process.env after loading:', [
    ...Object.keys(process.env).filter(key => 
      key.startsWith('SUPABASE_') || 
      key.startsWith('GOOGLE_') || 
      key.startsWith('CLI_')
    )
  ]);
}

// Load environment variables
loadEnvFiles();

// Process command line arguments
const args = process.argv.slice(2);

// Declare variables that can be modified when called as a module
let isDryRun = args.includes('--dry-run');
let isVerbose = args.includes('--verbose');

// Parse limit
const limitIndex = args.indexOf('--limit');
let limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 1000; // Increased default from 10 to 1000

// Parse max depth
const maxDepthIndex = args.indexOf('--max-depth');
let maxDepth = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
  ? parseInt(args[maxDepthIndex + 1], 10) 
  : 6;

// Folder ID for Dynamic Healing Discussion Group
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client using the singleton pattern
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

interface FileSyncResult {
  filesFound: number;
  filesInserted: number;
  filesUpdated: number;
  filesMarkedDeleted: number;
  filesSkipped: number;
  errors: string[];
  filesByType: Record<string, number>;
}

interface MetadataUpdateResult {
  records: number;
  updated: number;
  skipped: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

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
  depth?: number; // Track the folder depth level
}

// The initDriveClient function has been replaced with the GoogleDriveService singleton

/**
 * Extension method for GoogleDriveService to list files in a folder
 * This combines the functionality we need from the GoogleDriveService class
 */
async function listFilesInFolder(
  driveService: GoogleDriveService,
  folderId: string,
  options: { 
    fields?: string,
    includeSubfolders?: boolean,
    pageSize?: number
  } = {}
): Promise<any[]> {
  // Use the listFiles method instead, which is available in GoogleDriveService
  // Fix the fields parameter format - it needs to be correctly formatted for the API
  // Use a larger page size to ensure we get all files in one request if possible
  const listResult = await driveService.listFiles(folderId, {
    fields: 'nextPageToken, files(id, name, mimeType, webViewLink, parents, modifiedTime, size, thumbnailLink)',
    pageSize: options.pageSize || 1000 // Increase default page size to 1000 to get more files
  });
  
  // Display the file count for debugging
  if (isVerbose) {
    console.log(`Retrieved ${listResult.files.length} files from folder ${folderId} in listFilesInFolder`);
  }
  
  // Check if we have a nextPageToken, which means there are more files
  if (listResult.nextPageToken && isVerbose) {
    console.log(`More files exist beyond the current page size! Consider increasing pageSize or implement pagination.`);
  }

  return listResult.files;
}

/**
 * List files recursively
 */
async function listFilesRecursively(
  driveService: GoogleDriveService, 
  folderId: string, 
  maxDepth: number = 3,
  currentDepth: number = 0,
  parentPath: string = '/'
): Promise<GoogleDriveFile[]> {
  let allFiles: GoogleDriveFile[] = [];
  
  if (currentDepth > maxDepth) {
    if (isVerbose) console.log(`Reached max depth (${maxDepth}) at ${parentPath}`);
    return [];
  }
  
  try {
    // Get files in the folder using our helper method
    // Fix the API request by not passing explicit fields parameter - let the helper use the correct format
    const files = await listFilesInFolder(driveService, folderId);
      
      // Process files
      const enhancedFiles = files.map((file: GoogleDriveFile) => {
        const filePath = `${parentPath}${file.name}`;
        return {
          ...file,
          path: filePath,
          parentPath: parentPath,
          parentFolderId: folderId,
          depth: currentDepth  // Include the current depth level
        };
      });
      
      // Add files to the collection
      allFiles = [...allFiles, ...enhancedFiles];
      
      if (isVerbose && allFiles.length % 100 === 0) {
        console.log(`Found ${allFiles.length} files so far...`);
      }
      
      // Process subfolders recursively
      const folders = files.filter((file: GoogleDriveFile) => file.mimeType === 'application/vnd.google-apps.folder');
      
      for (const folder of folders) {
        if (isVerbose) console.log(`Processing subfolder: ${folder.name} (depth ${currentDepth + 1})`);
        
        const folderPath = `${parentPath}${folder.name}/`;
        const subFiles = await listFilesRecursively(
          driveService, 
          folder.id, 
          maxDepth, 
          currentDepth + 1, 
          folderPath
        );
        
        allFiles = [...allFiles, ...subFiles];
      }
    
    return allFiles;
  } catch (error: any) {
    console.error(`Error listing files in folder ${folderId}: ${error.message || error}`);
    return [];
  }
}

/**
 * Check if file already exists in sources_google
 */
async function checkFileExists(fileId: string): Promise<{ exists: boolean, data?: any, error?: any }> {
  try {
    const { data, error } = await supabase
      .from('google_sources')
      .select('id, drive_id, name')
      .eq('drive_id', fileId)
      .eq('is_deleted', false);
      
    if (error) {
      console.error(`Error checking if file exists: ${error.message}`);
      return { exists: false, error };
    }
    
    return { exists: data && data.length > 0, data: data?.[0] };
  } catch (error: any) {
    console.error(`Unexpected error checking file existence: ${error.message || error}`);
    return { exists: false, error };
  }
}

/**
 * Insert a specific file from Google Drive into sources_google
 */
async function insertSpecificFile(driveService: GoogleDriveService, fileId: string, parentId: string, rootFolderId: string, isDryRun: boolean, isVerbose: boolean): Promise<{ success: boolean, message?: string, data?: any }> {
  console.log(`=== Attempting to insert specific file ${fileId} ===`);
  
  try {
    // First check if file already exists
    const existsCheck = await checkFileExists(fileId);
    if (existsCheck.exists && existsCheck.data) {
      console.log(`File already exists in the database: ${existsCheck.data.name} (ID: ${existsCheck.data.id})`);
      return { success: false, message: 'File already exists' };
    }
    
    // Get file details from Google Drive
    const file = await driveService.getFile(
      fileId,
      'id,name,mimeType,parents,modifiedTime,size,thumbnailLink,webViewLink'
    );
    console.log(`✅ Found file in Google Drive: ${file.name} (${file.mimeType})`);
    
    // Get parent path
    let parentPath = '/';
    try {
      const parentData = await driveService.getFile(
        parentId,
        'id,name,parents'
      );
      
      const folderName = parentData.name;
      parentPath = `/${folderName}/`;
      console.log(`✅ Parent path: ${parentPath}`);
    } catch (error) {
      console.warn(`⚠️ Could not determine parent path: ${error}`);
    }
    
    // Prepare path array
    const filePath = `${parentPath}${file.name}`;
    const pathArray = filePath.split('/').filter(Boolean);
    if (filePath.startsWith('/')) {
      pathArray.unshift('');
    }
    
    // Calculate path_depth - if parent is the root folder, depth should be 1
    // Since this is a direct file lookup, we need to determine the depth based on the parent
    // If parentId is the root folder, depth is 1, otherwise it's unknown so default to 1
    const path_depth = (parentId === rootFolderId) ? 1 : 1;
    
    if (isVerbose) {
      console.log(`Path depth calculation:`);
      console.log(`- Path: ${filePath}`);
      console.log(`- Parent ID: ${parentId}`);
      console.log(`- Root folder ID: ${rootFolderId}`);
      console.log(`- Setting path_depth to ${path_depth}`);
    }
    
    // Create insertion data
    const now = new Date().toISOString();
    const recordId = uuidv4(); // Generate a UUID for the record
    
    // Generate a file signature based on name and modification time
    // Include the modified time in the signature to detect when files are renamed
    const fileSignature = `${file.name.replace(/[^a-zA-Z0-9]/g, '')}${file.modifiedTime ? file.modifiedTime.replace(/[^a-zA-Z0-9]/g, '') : ''}`;
    
    const insertData = {
      id: recordId, // Explicitly set the ID field
      drive_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      path: filePath,
      path_array: pathArray,
      path_depth,
      parent_folder_id: parentId,
      root_drive_id: rootFolderId,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      web_view_link: file.webViewLink,
      thumbnail_link: file.thumbnailLink,
      modified_at: file.modifiedTime,
      size: file.size ? parseInt(file.size, 10) : null,
      file_signature: fileSignature,
      metadata: {
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        thumbnailLink: file.thumbnailLink,
        mimeType: file.mimeType,
        isNewFile: true
      }
    };
    
    // Log the insert data in verbose mode
    if (isVerbose) {
      console.log('\nInsertion data:');
      console.log(JSON.stringify(insertData, null, 2));
    }
    
    if (isDryRun) {
      console.log(`DRY RUN: Would insert file ${file.name} (${file.id})`);
      return { success: true, message: 'Dry run successful' };
    }
    
    // Insert the file and return the inserted record
    const { data, error } = await supabase
      .from('google_sources')
      .insert(insertData)
      .select();
      
    if (error) {
      console.error(`❌ Error inserting file: ${error.message}`);
      console.error('Detailed error:', JSON.stringify(error, null, 2));
      return { success: false, message: error.message };
    }
    
    console.log(`✅ Successfully inserted file ${file.name} (${file.id})`);
    
    // Create a corresponding expert_documents record for this file
    if (data && data.length > 0 && !isDryRun) {
      const insertedFile = data[0];
      const now = new Date().toISOString();
      
      // Determine document processing status based on file type
      let documentProcessingStatus = null;
      let processingSkipReason = null;
      
      // Check mime type to determine how to handle this file
      const mimeType = insertedFile.mime_type || '';
      const fileName = insertedFile.name || '';
      const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
      
      // For folders, media files, etc., set to skip_processing
      if (mimeType === 'application/vnd.google-apps.folder') {
        documentProcessingStatus = 'skip_processing';
        processingSkipReason = 'Google Drive folder, not a document';
      } else if (mimeType.startsWith('image/') || 
                ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt)) {
        documentProcessingStatus = 'skip_processing';
        processingSkipReason = 'Image file, not suitable for text processing';
      } else if (mimeType.startsWith('audio/') || 
                ['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(fileExt)) {
        documentProcessingStatus = 'skip_processing';
        processingSkipReason = 'Audio file, not suitable for text processing';
      } else if (mimeType.startsWith('video/') || 
                ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExt)) {
        documentProcessingStatus = 'skip_processing';
        processingSkipReason = 'Video file, not suitable for text processing';
      } else if (mimeType === 'application/pdf' ||
                 mimeType === 'text/plain' ||
                 mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 mimeType === 'application/msword' ||
                 mimeType === 'application/vnd.google-apps.document' ||
                 ['pdf', 'txt', 'doc', 'docx', 'md', 'markdown'].includes(fileExt)) {
        // For new files, set to needs_reprocessing
        documentProcessingStatus = 'needs_reprocessing';
      }

      // Prepare expert_documents record
      const expertDocData = {
        id: uuidv4(), // Generate unique ID for expert_documents record
        source_id: insertedFile.id, // Link to the sources_google record
        document_processing_status: documentProcessingStatus, // Set status based on file type
        document_processing_status_updated_at: now,
        created_at: now,
        updated_at: now,
        document_type_id: insertedFile.document_type_id, // Copy document_type_id if set
        source_type: 'google_drive', // Set source type
        processing_skip_reason: processingSkipReason,
        metadata: {
          created_from_sync: true,
          file_name: insertedFile.name,
          mime_type: insertedFile.mime_type,
          processing_determined_by: 'file_type_analysis'
        }
      };
      
      if (isVerbose) {
        console.log(`Creating expert_documents record for specific file:`, JSON.stringify(expertDocData, null, 2));
      }
      
      // Insert the expert_documents record
      const { error: expertDocError } = await supabase
        .from('google_expert_documents')
        .insert(expertDocData);
        
      if (expertDocError) {
        console.error(`❌ Error creating expert_documents record: ${expertDocError.message}`);
      } else {
        console.log(`✅ Successfully created expert_documents record for ${file.name}`);
      }
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`❌ Unexpected error inserting file: ${error.message || error}`);
    return { success: false, message: error.message || error };
  }
}

/**
 * Sync files from Google Drive to Supabase sources_google table
 */
async function syncFiles(
  driveService: GoogleDriveService, 
  folderId: string, 
  isDryRun: boolean,
  maxDepth: number = 3
): Promise<FileSyncResult> {
  const result: FileSyncResult = {
    filesFound: 0,
    filesInserted: 0,
    filesUpdated: 0,
    filesMarkedDeleted: 0,
    filesSkipped: 0,
    errors: [],
    filesByType: {}
  };
  
  try {
    // Get folder details using GoogleDriveService
    const folder = await driveService.getFile(
      folderId,
      'id,name,mimeType,webViewLink,modifiedTime'
    );
    
    console.log(`Syncing folder: ${folder.name} (${folderId})`);
    
    // Ensure it's a root folder in Supabase
    if (!isDryRun) {
      console.log('Ensuring folder is registered as a root folder...');
      const { data: existingFolders, error: queryError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, is_root')
        .eq('drive_id', folderId)
        .eq('is_deleted', false);
        
      if (queryError) {
        throw queryError;
      }
      
      // If folder exists, ensure it's marked as a root
      if (existingFolders && existingFolders.length > 0) {
        const folderRecord = existingFolders[0];
        
        // If it's already a root folder, we're done
        if (folderRecord.is_root) {
          console.log('Folder is already registered as a root folder');
        } else {
          // Update it to be a root folder
          const { error } = await supabase
            .from('google_sources')
            .update({
              name: folder.name,
              is_root: true,
              path: `/${folder.name}`,
              path_array: ['', folder.name],
              path_depth: 2,
              parent_folder_id: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', folderRecord.id);
            
          if (error) {
            throw error;
          }
          
          console.log('Updated folder to be a root folder');
        }
      } else {
        // Insert new root folder
        const now = new Date().toISOString();
        const rootFolderId = uuidv4(); // Generate a UUID for the root folder
        
        // Prepare the insert data with explicit UUID
        const insertData = {
          id: rootFolderId, // Explicitly set the ID field
          drive_id: folderId,
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
          root_drive_id: folderId
        };
        
        if (isVerbose) {
          console.log('Insert data for root folder:', JSON.stringify(insertData, null, 2));
        }
        
        const { error } = await supabase
          .from('google_sources')
          .insert(insertData);
          
        if (error) {
          console.error('Detailed error inserting root folder:', JSON.stringify(error, null, 2));
          throw error;
        }
        
        console.log('Registered folder as a new root folder');
      }
    } else {
      console.log('DRY RUN: Would ensure folder is registered as a root folder');
    }
    
    // List files recursively
    console.log(`Listing files recursively (max depth: ${maxDepth})...`);
    const allFiles = await listFilesRecursively(driveService, folderId, maxDepth);
    
    result.filesFound = allFiles.length;
    console.log(`Found ${allFiles.length} files`);
    
    // Debug output for all found files
    if (isVerbose) {
      console.log('DEBUG: First 10 files found:');
      allFiles.slice(0, 10).forEach(file => {
        console.log(`- ${file.name} (${file.id}) - ${file.mimeType}`);
      });
      
      // Check specifically for test file in allFiles
      const testFileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
      const testFile = allFiles.find(file => file.id === testFileId);
      
      console.log("\n=== TEST FILE IN RECURSIVE SEARCH CHECK ===");
      console.log(`Test file found in recursive search: ${testFile ? 'YES' : 'NO'}`);
      if (testFile) {
        console.log(`Test file details: ${testFile.name} (${testFile.id})`);
        console.log(`Path: ${testFile.path}`);
        console.log(`Parent folder ID: ${testFile.parentFolderId}`);
      }
      console.log("=== END TEST FILE RECURSIVE SEARCH CHECK ===\n");
    }
    
    // Organize files by type
    allFiles.forEach(file => {
      const type = file.mimeType || 'unknown';
      result.filesByType[type] = (result.filesByType[type] || 0) + 1;
    });
    
    // Display file types
    console.log('\nFile types:');
    Object.entries(result.filesByType).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} files`);
    });
    
    if (isDryRun) {
      console.log(`DRY RUN: Would process ${allFiles.length} files`);
      return result;
    }
    
    // Create a Set of all found drive IDs for checking deletions later
    // Always include the root folder ID in the foundDriveIds Set to prevent it from being marked as deleted
    const foundDriveIds = new Set([
      ...allFiles.map(file => file.id),
      folderId // Always include the root folder ID to prevent it from being marked as deleted
    ]);
    
    if (isVerbose) {
      console.log(`Root folder ID (${folderId}) added to foundDriveIds to prevent deletion`);
    }
    
    // Get existing files to avoid duplicates
    const { data: existingRecords, error: queryError } = await supabase
      .from('google_sources')
      .select('id, drive_id, root_drive_id, name, metadata')
      .eq('is_deleted', false);
      
    if (queryError) {
      console.error('Error fetching existing records:', queryError);
      result.errors.push(`Error fetching existing records: ${queryError.message}`);
      return result;
    }
    
    // Create a Set of existing drive IDs for faster lookups
    const existingDriveIds = new Set(
      (existingRecords || []).map(record => record.drive_id)
    );
    
    // Track files that need to be marked as deleted
    // Filter for records with root_drive_id = folderId that are missing from foundDriveIds
    const recordsToMarkDeleted = (existingRecords || [])
      .filter(record => 
        record.root_drive_id === folderId && 
        !foundDriveIds.has(record.drive_id)
      );
      
    // Make sure we have the metadata property on all records (TypeScript safety)
    recordsToMarkDeleted.forEach(record => {
      if (!record.metadata) {
        record.metadata = {};
      }
    });
      
    // Double-check to make sure root folder isn't in the deletion list
    const rootFolderInDeletionList = recordsToMarkDeleted.some(record => record.drive_id === folderId);
    if (rootFolderInDeletionList && isVerbose) {
      console.error(`WARNING: Root folder found in deletion list despite safeguards! This shouldn't happen.`);
    }
    
    // Debug check for the root folder
    if (isVerbose) {
      const rootFolderRecord = (existingRecords || []).find(record => record.drive_id === folderId);
      console.log("\n=== ROOT FOLDER CHECK ===");
      console.log(`Root folder found in database: ${rootFolderRecord ? 'YES' : 'NO'}`);
      if (rootFolderRecord) {
        console.log(`Root folder ID: ${rootFolderRecord.id}`);
        console.log(`Root folder would be marked as deleted: ${!foundDriveIds.has(folderId) ? 'YES (but prevented)' : 'NO'}`);
      }
      console.log("=== END ROOT FOLDER CHECK ===\n");
    }
    
    if (recordsToMarkDeleted.length > 0) {
      console.log(`Found ${recordsToMarkDeleted.length} files to mark as deleted`);
      
      // Enhanced verification process: actually check each file before marking as deleted
      console.log("\n=== ENHANCED VERIFICATION PROCESS ===");
      console.log("Performing direct verification of each file's existence in Google Drive before marking as deleted");
      console.log("This helps prevent falsely marking files as deleted due to API failures or sync issues");
      
      // Verified lists will hold the files that have been directly verified to exist or not exist
      const verifiedNotExisting: typeof recordsToMarkDeleted = [];
      const verifiedStillExisting: typeof recordsToMarkDeleted = [];
      const verificationErrors: typeof recordsToMarkDeleted = [];
      
      // Create a progress counter
      let verifiedCount = 0;
      const totalToVerify = Math.min(recordsToMarkDeleted.length, 100); // Limit to 100 for performance
      
      console.log(`Verifying up to ${totalToVerify} files (out of ${recordsToMarkDeleted.length} total)`);
      
      // Use a smaller batch size for verification to avoid overwhelming the API
      const verificationBatchSize = 10;
      const verificationBatches = Math.ceil(Math.min(totalToVerify, recordsToMarkDeleted.length) / verificationBatchSize);
      
      for (let batchIndex = 0; batchIndex < verificationBatches; batchIndex++) {
        const start = batchIndex * verificationBatchSize;
        const end = Math.min(start + verificationBatchSize, totalToVerify);
        const verificationBatch = recordsToMarkDeleted.slice(start, end);
        
        console.log(`Verifying batch ${batchIndex + 1}/${verificationBatches} (${verificationBatch.length} files)`);
        
        // Create an array of promises to verify files in parallel
        const verificationPromises = verificationBatch.map(async (record) => {
          try {
            // Use GoogleDriveService to check if file exists
            try {
              await driveService.getFile(record.drive_id, 'id,name');
              return { record, exists: true };
            } catch (error: any) {
              if (error.code === 404 || error.message?.includes('File not found')) {
                return { record, exists: false };
              }
              return { record, exists: null, error: error.message || 'Unknown error' };
            }
          } catch (error: any) {
            return { record, exists: null, error: error.message || 'Unknown error' };
          }
        });
        
        // Wait for all verification promises to complete
        const verificationResults = await Promise.all(verificationPromises);
        
        // Sort verification results into categories
        for (const result of verificationResults) {
          if (result.exists === true) {
            verifiedStillExisting.push(result.record);
            console.log(`⚠️ File still exists: ${result.record.name || 'Unnamed'} (${result.record.drive_id})`);
          } else if (result.exists === false) {
            verifiedNotExisting.push(result.record);
            console.log(`✓ Verified gone: ${result.record.name || 'Unnamed'} (${result.record.drive_id})`);
          } else {
            verificationErrors.push(result.record);
            console.log(`? Verification error: ${result.record.name || 'Unnamed'} (${result.record.drive_id}) - ${result.error}`);
          }
          verifiedCount++;
        }
        
        // Show progress
        console.log(`Verification progress: ${verifiedCount}/${totalToVerify}`);
      }
      
      console.log("\n=== VERIFICATION RESULTS ===");
      console.log(`Total files marked for deletion: ${recordsToMarkDeleted.length}`);
      console.log(`Files verified as not existing: ${verifiedNotExisting.length}`);
      console.log(`Files that still exist in Google Drive: ${verifiedStillExisting.length}`);
      console.log(`Files with verification errors: ${verificationErrors.length}`);
      
      // Only use the verified list that doesn't exist for deletion
      const actualDeletionCandidates = verifiedNotExisting;
      
      // Safety check: If we have a high percentage of errors or still existing files, abort the deletion
      const verifiedTotal = verifiedNotExisting.length + verifiedStillExisting.length + verificationErrors.length;
      const errorPercentage = verificationErrors.length / (verifiedTotal || 1) * 100;
      const stillExistingPercentage = verifiedStillExisting.length / (verifiedTotal || 1) * 100;
      
      if (errorPercentage > 20 || stillExistingPercentage > 20) {
        console.log("\n⚠️ DELETION SAFETY WARNING ⚠️");
        console.log(`High percentage of verification issues detected:`);
        console.log(`- Error percentage: ${errorPercentage.toFixed(1)}% (threshold: 20%)`);
        console.log(`- Still existing percentage: ${stillExistingPercentage.toFixed(1)}% (threshold: 20%)`);
        console.log("\nAbandoning deletion operation to prevent accidentally marking existing files as deleted.");
        console.log("The Google Drive API may be experiencing issues. Try again later or use the --force-deletion flag to override.");
        console.log("You can also use the reset-deleted-files command to restore improperly deleted files.");
        
        // Skip the deletion and just report what was found
        result.errors.push(`Deletion aborted: High percentage of verification issues detected (${errorPercentage.toFixed(1)}% errors, ${stillExistingPercentage.toFixed(1)}% still existing)`);
        
        // Create an output report of the files that still exist for reference
        if (verifiedStillExisting.length > 0) {
          console.log("\nFiles that still exist but would have been marked as deleted:");
          verifiedStillExisting.slice(0, 20).forEach((record, index) => {
            console.log(`${index + 1}. ${record.name || 'Unnamed'} (${record.drive_id})`);
          });
          if (verifiedStillExisting.length > 20) {
            console.log(`... and ${verifiedStillExisting.length - 20} more files`);
          }
        }
        
        // Since we're abandoning deletion, exit this section
        console.log("\n=== END VERIFICATION PROCESS ===");
      } else {
        // Proceed with deletion if in regular run mode
        if (!isDryRun) {
          console.log(`\nProceeding with deletion of ${actualDeletionCandidates.length} verified non-existent files`);
          
          // Mark files as deleted in batches
          const batchSize = 50;
          const deleteBatches = Math.ceil(actualDeletionCandidates.length / batchSize);
          
          for (let i = 0; i < deleteBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, actualDeletionCandidates.length);
            const batch = actualDeletionCandidates.slice(start, end);
            
            console.log(`Processing deletion batch ${i + 1}/${deleteBatches} (${batch.length} files)`);
            
            const idsToUpdate = batch.map(record => record.id);
            
            const { error } = await supabase
              .from('google_sources')
              .update({
                is_deleted: true,
                updated_at: new Date().toISOString(),
                metadata: {
                  ...(batch[0].metadata || {}),
                  deleted_at: new Date().toISOString(),
                  deletion_verified: true,
                  deletion_reason: 'Verified as not existing in Google Drive'
                }
              })
              .in('id', idsToUpdate);
              
            if (error) {
              console.error(`Error marking batch ${i + 1} as deleted:`, error);
              result.errors.push(`Error marking batch ${i + 1} as deleted: ${error.message}`);
            } else {
              result.filesMarkedDeleted += batch.length;
              console.log(`Successfully marked ${batch.length} files as deleted in batch ${i + 1}`);
            }
          }
          
          console.log(`\nDeletion complete. Marked ${result.filesMarkedDeleted} verified files as deleted.`);
          console.log(`Files that still exist (${verifiedStillExisting.length}) were not marked as deleted.`);
          
          // If there were files that still exist, report them
          if (verifiedStillExisting.length > 0) {
            console.log("\nFiles that still exist and were NOT marked as deleted:");
            verifiedStillExisting.slice(0, 10).forEach((record, index) => {
              console.log(`${index + 1}. ${record.name || 'Unnamed'} (${record.drive_id})`);
            });
            if (verifiedStillExisting.length > 10) {
              console.log(`... and ${verifiedStillExisting.length - 10} more files`);
            }
          }
        } else {
          console.log(`DRY RUN: Would mark ${actualDeletionCandidates.length} verified non-existent files as deleted`);
          if (verifiedStillExisting.length > 0) {
            console.log(`DRY RUN: Would NOT mark ${verifiedStillExisting.length} files that still exist as deleted`);
          }
        }
        console.log("\n=== END VERIFICATION PROCESS ===");
      }
    } else {
      console.log('No files need to be marked as deleted');
    }
    
    // Process files in smaller batches to prevent timeouts
    const batchSize = 50;
    const batches = Math.ceil(allFiles.length / batchSize);
    
    console.log(`Processing ${allFiles.length} files in ${batches} batches of ${batchSize}`);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, allFiles.length);
      const batch = allFiles.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${batches} (${batch.length} files)`);
      
      // Split into new and existing files
      const newFilesInBatch = batch.filter(file => !existingDriveIds.has(file.id));
      const existingFilesInBatch = batch.filter(file => existingDriveIds.has(file.id));
      
      result.filesSkipped += (batch.length - newFilesInBatch.length);
      
      // Check for test file specifically
      const testFileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
      const testFileInBatch = batch.find(file => file.id === testFileId);
      
      if (isVerbose) {
        const testFileIsNew = newFilesInBatch.find(file => file.id === testFileId);
        
        console.log("\n=== TEST FILE IN SYNC BATCH CHECK ===");
        console.log(`Test file found in batch: ${testFileInBatch ? 'YES' : 'NO'}`);
        if (testFileInBatch) {
          console.log(`Test file details: ${testFileInBatch.name} (${testFileInBatch.id})`);
          console.log(`Will be inserted as new: ${testFileIsNew ? 'YES' : 'NO'}`);
          if (!testFileIsNew) {
            console.log(`Reason: File ID ${testFileId} already exists in database`);
          }
        }
        console.log("=== END TEST FILE CHECK ===\n");
      }
      
      // Specifically handle the test file if it's not in the database but was found in Google Drive
      if (testFileInBatch && !existingDriveIds.has(testFileId)) {
        console.log(`\n✨ Special case: Test file found in Google Drive but not in database. Handling explicitly...`);
        const insertResult = await insertSpecificFile(
          driveService, 
          testFileId, 
          testFileInBatch.parentFolderId || folderId, 
          folderId,
          isDryRun,
          isVerbose
        );
        
        if (insertResult.success) {
          console.log(`✅ Successfully inserted test file ${testFileInBatch.name} (${testFileId})`);
          result.filesInserted++;
          // Remove from newFilesInBatch to avoid duplicate insertion
          const testFileIndex = newFilesInBatch.findIndex(file => file.id === testFileId);
          if (testFileIndex !== -1) {
            newFilesInBatch.splice(testFileIndex, 1);
          }
        } else {
          console.error(`❌ Failed to insert test file: ${insertResult.message}`);
          result.errors.push(`Failed to insert test file: ${insertResult.message}`);
        }
      }
      
      if (newFilesInBatch.length === 0) {
        console.log('No new files in this batch, skipping...');
        continue;
      }
      
      // TEMPORARY DEBUG: Show information about new files found (just for debugging)
      if (isVerbose) {
        console.log("\n=== TEMPORARY DEBUGGING: NEW FILES FOUND ===");
        console.log(`Found ${newFilesInBatch.length} new files to insert:`);
        newFilesInBatch.forEach((file, index) => {
          console.log(`${index + 1}. ${file.name} (${file.id}) - Type: ${file.mimeType}`);
          console.log(`   Path: ${file.path}`);
          console.log(`   Parent: ${file.parentFolderId}`);
        });
        
        // Add a prompt to continue - comment out in production
        if (i === 0 && !isDryRun) { // Only for the first batch and not in dry run mode
          console.log("\n=== DEBUGGING PAUSE ===");
          console.log("This is just temporary debug info. The script should now prepare data for insertion.");
          console.log("Check the above output to verify if your test file appears in the list of new files.");
          console.log("=== END DEBUGGING INFO ===\n");
        }
      }
      
      // Prepare the data for insertion
      const filesToInsert = newFilesInBatch.map(file => {
        // Create path array from file path
        const pathArray = file.path ? file.path.split('/').filter(Boolean) : [];
        if (file.path?.startsWith('/')) {
          // Add empty string at the beginning for absolute paths
          pathArray.unshift('');
        }
        
        // Generate a file signature based on name and modification time
        const fileSignature = `${file.name}-${file.modifiedTime || new Date().toISOString()}`.replace(/[^a-zA-Z0-9]/g, '');
        
        // Generate a UUID for each new file
        const recordId = uuidv4();
        
        const insertData = {
          id: recordId, // Explicitly set the ID field with UUID
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          path: file.path || `/${file.name}`,
          path_array: pathArray,
          path_depth: file.depth || 0, // Use the folder depth from recursive search
          parent_folder_id: file.parentFolderId,
          root_drive_id: folderId,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          web_view_link: file.webViewLink,
          thumbnail_link: file.thumbnailLink,
          modified_at: file.modifiedTime,
          size: file.size ? parseInt(file.size, 10) : null,
          file_signature: fileSignature,
          metadata: {
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            thumbnailLink: file.thumbnailLink,
            mimeType: file.mimeType,
            isNewFile: true
          }
        };
        
        // TEMPORARY DEBUG: Show full insert data for first file only
        if (isVerbose && file === newFilesInBatch[0]) {
          console.log("\n=== FIRST FILE INSERT DATA ===");
          console.log(JSON.stringify(insertData, null, 2));
          console.log("=== END FIRST FILE INSERT DATA ===\n");
        }
        
        return insertData;
      });
      
      // Insert the files into the database
      try {
        if (isVerbose) {
          console.log(`Preparing to insert ${filesToInsert.length} files for batch ${i + 1}/${batches}`);
        }
        
        const { data: insertedFiles, error } = await supabase
          .from('google_sources')
          .insert(filesToInsert)
          .select();
        
        if (error) {
          console.error(`Error inserting batch ${i + 1}:`, error);
          console.error(`Detailed error:`, JSON.stringify(error, null, 2));
          
          // If there's a constraint violation, log the first record to help debug
          if (error.code === '23502' || error.code === '23505') {
            console.error(`First record in the problematic batch:`, JSON.stringify(filesToInsert[0], null, 2));
          }
          
          // TEMPORARY DEBUG: Get table structure to verify column names
          if (isVerbose && i === 0) {
            console.log("\n=== DEBUGGING TABLE STRUCTURE ===");
            console.log("Checking sources_google table structure to identify issues...");
            
            // Output the field that's causing problems based on error code
            if (error.code === '23502') { // not-null constraint violation
              const details = error.details || '';
              const match = details.match(/column "(.*?)"/);
              if (match && match[1]) {
                console.error(`The column "${match[1]}" cannot be NULL but we're not providing a value.`);
                console.error(`This suggests we need to add "${match[1]}" to our insert data or set a default in the database.`);
              }
            }
            
            console.log("=== END TABLE STRUCTURE DEBUG ===\n");
          }
          
          result.errors.push(`Error inserting batch ${i + 1}: ${error.message}`);
          result.filesSkipped += newFilesInBatch.length;
        } else {
          result.filesInserted += newFilesInBatch.length;
          console.log(`Successfully inserted ${newFilesInBatch.length} new files in batch ${i + 1}`);
          
          // For each inserted file, create a corresponding expert_documents record
          if (insertedFiles && insertedFiles.length > 0 && !isDryRun) {
            console.log(`Creating expert_documents records for ${insertedFiles.length} newly inserted files...`);
            
            // Create expert_documents records in batches to improve performance
            const expertDocBatchSize = 20;
            const expertDocBatches = Math.ceil(insertedFiles.length / expertDocBatchSize);
            
            for (let j = 0; j < expertDocBatches; j++) {
              const start = j * expertDocBatchSize;
              const end = Math.min(start + expertDocBatchSize, insertedFiles.length);
              const fileBatch = insertedFiles.slice(start, end);
              
              // Prepare expert_documents records
              const expertDocsToInsert = fileBatch.map(file => {
                const now = new Date().toISOString();
                
                // Determine document processing status based on file type
                let documentProcessingStatus = null;
                let processingSkipReason = null;
                
                // Check mime type to determine how to handle this file
                const mimeType = file.mime_type || '';
                const fileName = file.name || '';
                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
                
                // For folders, media files, etc., set to skip_processing
                if (mimeType === 'application/vnd.google-apps.folder') {
                  documentProcessingStatus = 'skip_processing';
                  processingSkipReason = 'Google Drive folder, not a document';
                } else if (mimeType.startsWith('image/') || 
                          ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt)) {
                  documentProcessingStatus = 'skip_processing';
                  processingSkipReason = 'Image file, not suitable for text processing';
                } else if (mimeType.startsWith('audio/') || 
                          ['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(fileExt)) {
                  documentProcessingStatus = 'skip_processing';
                  processingSkipReason = 'Audio file, not suitable for text processing';
                } else if (mimeType.startsWith('video/') || 
                          ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExt)) {
                  documentProcessingStatus = 'skip_processing';
                  processingSkipReason = 'Video file, not suitable for text processing';
                } else if (mimeType === 'application/pdf' ||
                           mimeType === 'text/plain' ||
                           mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                           mimeType === 'application/msword' ||
                           mimeType === 'application/vnd.google-apps.document' ||
                           ['pdf', 'txt', 'doc', 'docx', 'md', 'markdown'].includes(fileExt)) {
                  // For newly inserted files, set to needs_reprocessing
                  documentProcessingStatus = 'needs_reprocessing';
                }
                
                return {
                  id: uuidv4(), // Generate unique ID for expert_documents record
                  source_id: file.id, // Link to the sources_google record
                  document_processing_status: documentProcessingStatus, // Set status based on file type
                  document_processing_status_updated_at: now,
                  created_at: now,
                  updated_at: now,
                  document_type_id: file.document_type_id, // Copy document_type_id if set
                  source_type: 'google_drive', // Set source type
                  processing_skip_reason: processingSkipReason,
                  metadata: {
                    created_from_sync: true,
                    file_name: file.name,
                    mime_type: file.mime_type,
                    processing_determined_by: 'file_type_analysis'
                  }
                };
              });
              
              if (isVerbose && j === 0) {
                console.log(`Example expert_documents record to be created:`, JSON.stringify(expertDocsToInsert[0], null, 2));
              }
              
              // Insert the expert_documents records
              const { error: expertDocError } = await supabase
                .from('google_expert_documents')
                .insert(expertDocsToInsert);
                
              if (expertDocError) {
                console.error(`Error creating expert_documents records for batch ${j + 1}:`, expertDocError);
                result.errors.push(`Error creating expert_documents records: ${expertDocError.message}`);
              } else {
                if (isVerbose) {
                  console.log(`Successfully created ${expertDocsToInsert.length} expert_documents records for batch ${j + 1}/${expertDocBatches}`);
                }
              }
            }
            
            console.log(`✅ Finished creating expert_documents records for newly inserted files`);
          }
        }
      } catch (error: any) {
        console.error(`Error inserting batch ${i + 1}:`, error);
        result.errors.push(`Error inserting batch ${i + 1}: ${error.message || error}`);
        result.filesSkipped += newFilesInBatch.length;
      }
      
      // Update existing files if needed
      if (existingFilesInBatch.length > 0 && isVerbose) {
        console.log(`Skipping ${existingFilesInBatch.length} existing files in batch ${i + 1}`);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('Error syncing files:', error);
    result.errors.push(`Error syncing files: ${error.message || error}`);
    return result;
  }
}

/**
 * Update metadata for Google Drive files
 */
async function updateMetadata(
  driveService: GoogleDriveService,
  folderId: string, 
  limit: number, 
  dryRun: boolean, 
  verbose: boolean
): Promise<MetadataUpdateResult> {
  const startTime = new Date();
  const result: MetadataUpdateResult = {
    records: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    startTime,
    endTime: startTime
  };

  try {
    // Fetch records from Supabase
    if (verbose) console.log(`Fetching records from Supabase (limit: ${limit})...`);
    
    // Fetch all records under this root folder ID
    const { data: records, error } = await supabase
      .from('google_sources')
      .select('*')
      .eq('root_drive_id', folderId)  // Get all files with this root folder 
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    if (!records || records.length === 0) throw new Error('No records returned from Supabase');
    
    result.records = records.length;
    
    // Show fetch completion in non-verbose mode
    if (!verbose) {
      console.log(`✓ Found ${records.length} records to process`);
    } else {
      console.log(`Found ${records.length} records`);
    }
    
    // Process records in batches to improve performance
    const BATCH_SIZE = 20; // Process 20 records at a time
    const batches = Math.ceil(records.length / BATCH_SIZE);
    
    if (verbose) console.log(`Will process in ${batches} batches of ${BATCH_SIZE} records`);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batchRecords = records.slice(start, end);
      
      if (verbose) console.log(`\nProcessing batch ${batchIndex + 1}/${batches} (${batchRecords.length} records)`);
      
      // Array to hold batch promises
      const batchPromises = [];
      const batchResults = [];
      
      // Prepare batch of promises for Google Drive API calls
      for (const record of batchRecords) {
        // Skip records without drive_id
        if (!record.drive_id) {
          if (verbose) console.log(`Skipping record without drive_id: ${record.id}`);
          result.skipped++;
          continue;
        }
        
        // Create promise for each record's Google Drive API call
        const getFilePromise = async () => {
          try {
            if (verbose) console.log(`Fetching data for: ${record.name} (${record.drive_id})`);
            
            // Use GoogleDriveService instead of direct API call
            const fileData = await driveService.getFile(
              record.drive_id,
              'id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink'
            );
            
            return { record, fileData, success: true };
          } catch (error: any) {
            const errorMessage = `Error getting file metadata for ${record.drive_id}: ${error.message || 'Unknown error'}`;
            console.error(errorMessage);
            result.errors.push(errorMessage);
            return { record, error, success: false };
          }
        };
        
        batchPromises.push(getFilePromise());
      }
      
      // Execute all Google Drive API calls in parallel
      if (verbose) console.log(`Executing ${batchPromises.length} Google Drive API calls in parallel...`);
      const fileDataResults = await Promise.all(batchPromises);
      
      // Process results and prepare database updates
      const recordsToUpdate = [];
      
      for (const item of fileDataResults) {
        if (!item.success) {
          result.skipped++;
          continue;
        }
        
        const { record, fileData } = item;
        
        if (!fileData) {
          if (verbose) console.log(`No data found for file: ${record.drive_id}`);
          result.skipped++;
          continue;
        }
        
        // Prepare update data
        const metadata: Record<string, any> = record.metadata ? 
          (typeof record.metadata === 'object' ? { ...record.metadata } : {}) : 
          {};
        
        // Update metadata fields
        ['modifiedTime', 'thumbnailLink', 'webViewLink', 'mimeType'].forEach(field => {
          if (fileData[field] !== undefined) {
            metadata[field] = fileData[field];
          }
        });
        
        // Mark last updated time
        metadata.lastUpdated = new Date().toISOString();
        
        // For MP4 videos, try to extract duration using FFprobe if file is available locally
        if (fileData.mimeType === 'video/mp4' || record.mime_type === 'video/mp4') {
          // Find the file in the local mp4 directory
          const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
          const fileName = record.name || fileData.name;
          const possiblePaths = [
            path.join(mp4Dir, fileName),
            path.join(mp4Dir, `INGESTED_${fileName}`)
          ];
          
          let mp4Path = '';
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              mp4Path = p;
              break;
            }
          }
          
          // If file found locally, extract metadata
          if (mp4Path && isVerbose) {
            console.log(`Found local MP4 file for ${fileName} at ${mp4Path}, extracting metadata...`);
          }
          
          if (mp4Path && !isDryRun) {
            try {
              // Import the converter service (dynamically to avoid circular dependencies)
              const { converterService } = require('../../../packages/shared/services/converter-service');
              
              // Extract metadata
              const result = await converterService.extractVideoMetadata(mp4Path);
              
              if (result.success && result.metadata) {
                if (isVerbose) {
                  console.log(`Successfully extracted video metadata for ${fileName}:`);
                  console.log(JSON.stringify(result.metadata, null, 2));
                }
                
                // Add duration to metadata
                metadata.videoDuration = result.metadata.durationSeconds;
                metadata.videoMetadata = result.metadata;
                
                // Format duration for display
                if (result.metadata.durationSeconds) {
                  const hours = Math.floor(result.metadata.durationSeconds / 3600);
                  const minutes = Math.floor((result.metadata.durationSeconds % 3600) / 60);
                  const seconds = Math.floor(result.metadata.durationSeconds % 60);
                  
                  let formattedDuration = '';
                  if (hours > 0) {
                    formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                  } else {
                    formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                  }
                  
                  metadata.formattedDuration = formattedDuration;
                }
              } else if (isVerbose) {
                console.log(`Could not extract video metadata: ${result.error}`);
              }
            } catch (error: any) {
              if (isVerbose) {
                console.warn(`Error extracting video metadata: ${error.message}`);
              }
            }
          }
        }
        
        // Additional column-specific updates
        const updateData: any = {
          id: record.id, // Include ID for batch updates
          metadata,
          updated_at: new Date().toISOString()
        };
        
        if (fileData.size !== undefined) {
          updateData.size = parseInt(fileData.size, 10) || null;
        }
        
        if (fileData.thumbnailLink !== undefined) {
          updateData.thumbnail_link = fileData.thumbnailLink;
        }
        
        if (fileData.modifiedTime !== undefined) {
          updateData.modified_at = fileData.modifiedTime;
        }
        
        if (fileData.webViewLink !== undefined) {
          updateData.web_view_link = fileData.webViewLink;
        }
        
        // Generate and update file signature based on name and modification time
        if (fileData.name && fileData.modifiedTime) {
          // Create a file signature that captures the name and modified time
          const newFileSignature = `${fileData.name.replace(/[^a-zA-Z0-9]/g, '')}${fileData.modifiedTime.replace(/[^a-zA-Z0-9]/g, '')}`;
          
          // Check if the signature has changed (likely due to a file rename)
          const currentSignature = record.file_signature;
          const hasNameChanged = record.name !== fileData.name;
          const hasModTimeChanged = record.modified_at !== fileData.modifiedTime;
          
          if (hasNameChanged) {
            if (verbose) console.log(`File renamed: "${record.name}" -> "${fileData.name}" (ID: ${record.id})`);
          }
          
          updateData.file_signature = newFileSignature;
          
          // Update name if it has changed
          if (hasNameChanged) {
            updateData.name = fileData.name;
            
            // If name changed, need to update path and path_array as well
            if (record.path) {
              const pathParts = record.path.split('/');
              pathParts[pathParts.length - 1] = fileData.name;
              updateData.path = pathParts.join('/');
              
              // Also update path_array if it exists
              if (record.path_array && Array.isArray(record.path_array)) {
                const newPathArray = [...record.path_array];
                newPathArray[newPathArray.length - 1] = fileData.name;
                updateData.path_array = newPathArray;
              }
            }
          }
        }
        
        recordsToUpdate.push(updateData);
      }
      
      // Perform batch update if there are records to update
      if (recordsToUpdate.length > 0) {
        if (!dryRun) {
          if (verbose) {
            console.log(`Batch updating ${recordsToUpdate.length} records...`);
          } else {
            // Show progress even in non-verbose mode
            process.stdout.write(`Updating batch ${batchIndex + 1}/${batches} (${recordsToUpdate.length} records)... `);
          }
          
          let batchSuccessCount = 0;
          
          // Update each record individually (could be optimized further with UPSERT)
          for (const updateData of recordsToUpdate) {
            const recordId = updateData.id;
            delete updateData.id; // Remove ID from update data
            
            try {
              // Add a retry mechanism for API aborts
              let retryCount = 0;
              const maxRetries = 3;
              let updateError = null;
              
              while (retryCount < maxRetries) {
                try {
                  // Use a timeout to prevent hanging requests
                  const timeout = 15000; // 15 seconds timeout
                  const updatePromise = supabase
                    .from('google_sources')
                    .update(updateData)
                    .eq('id', recordId);
                    
                  const { error: apiError } = await updatePromise;
                  
                  if (!apiError) {
                    // Success! No error
                    updateError = null;
                    break;
                  }
                  
                  updateError = apiError;
                  
                  // If it's not an abort error, no need to retry
                  if (!apiError.message.includes('AbortError') && 
                      !apiError.message.includes('operation was aborted')) {
                    break;
                  }
                  
                  // It was an abort error, retry after a delay
                  retryCount++;
                  if (retryCount < maxRetries) {
                    // Wait longer between each retry
                    const delay = retryCount * 1000;
                    if (verbose) {
                      console.log(`AbortError detected, retrying after ${delay}ms (attempt ${retryCount}/${maxRetries})...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                  }
                } catch (err) {
                  // Handle any unexpected errors
                  updateError = err;
                  retryCount++;
                  
                  if (retryCount < maxRetries) {
                    const delay = retryCount * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                  }
                }
              }
              
              if (updateError) {
                const errorMessage = `Error updating record ${recordId}: ${updateError instanceof Error ? updateError.message : String(updateError)}`;
                console.error(errorMessage);
                result.errors.push(errorMessage);
                result.skipped++;
              } else {
                result.updated++;
                batchSuccessCount++;
                if (verbose) console.log(`Updated record: ${recordId}`);
              }
            } catch (err) {
              // Final fallback for any unexpected errors
              const errorMessage = `Unexpected error updating record ${recordId}: ${err instanceof Error ? err.message : String(err)}`;
              console.error(errorMessage);
              result.errors.push(errorMessage);
              result.skipped++;
            }
          }
          
          // Print batch completion message in non-verbose mode
          if (!verbose) {
            console.log(`✓ (${batchSuccessCount} updates successful)`);
          }
        } else {
          if (verbose) {
            console.log(`DRY RUN: Would update ${recordsToUpdate.length} records`);
          } else {
            // Show progress even in dry run mode
            console.log(`DRY RUN: Batch ${batchIndex + 1}/${batches} - Would update ${recordsToUpdate.length} records`);
          }
          result.updated += recordsToUpdate.length;
        }
      } else {
        // Show progress even when there are no updates to make
        if (!verbose) {
          console.log(`Batch ${batchIndex + 1}/${batches} - No updates needed for ${batchRecords.length} records`);
        }
      }
      
      if (verbose) console.log(`Completed batch ${batchIndex + 1}/${batches}`);
    }
  } catch (error: any) {
    const errorMessage = `Error updating metadata: ${error.message || 'Unknown error'}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
  }
  
  result.endTime = new Date();
  return result;
}

/**
 * Direct lookup for a specific file in Google Drive
 */
async function lookupSpecificFile(driveService: GoogleDriveService, fileId: string, rootFolderId: string, isDryRun: boolean, isVerbose: boolean): Promise<void> {
  console.log(`\n=== Direct Lookup for File ID: ${fileId} ===`);
  
  try {
    // First check if file already exists in database
    const existsCheck = await checkFileExists(fileId);
    if (existsCheck.exists && existsCheck.data) {
      console.log(`✅ File already exists in the database: ${existsCheck.data.name} (ID: ${existsCheck.data.id})`);
      return;
    }
    
    // Look up file in Google Drive using the service
    try {
      // Use GoogleDriveService instead of direct API call
      const fileData = await driveService.getFile(
        fileId,
        'id,name,mimeType,parents,modifiedTime'
      );
      
      console.log(`✅ File found in Google Drive: ${fileData.name} (${fileData.mimeType})`);
      
      // Get parent folder ID
      const parentFolderId = fileData.parents?.[0] || rootFolderId;
      console.log(`Parent folder ID: ${parentFolderId}`);
      
      // Insert the file
      console.log(`Attempting to insert file into database...`);
      const insertResult = await insertSpecificFile(driveService, fileId, parentFolderId, rootFolderId, isDryRun, isVerbose);
      
      if (insertResult.success) {
        console.log(`✅ Successfully performed direct lookup and insertion of file ${fileData.name} (${fileId})`);
      } else {
        console.error(`❌ Failed to insert file: ${insertResult.message}`);
      }
    } catch (error: any) {
      console.error(`❌ File not found in Google Drive: ${error.message || error}`);
    }
  } catch (error: any) {
    console.error(`❌ Error during file lookup: ${error.message || error}`);
  }
  
  console.log('=== End Direct File Lookup ===\n');
}

/**
 * Main function with additional parameters
 */
export async function syncAndUpdateMetadata(
  folderId: string = DYNAMIC_HEALING_FOLDER_ID,
  specificFileId?: string,
  dryRun: boolean = false,
  recordLimit: number = 10,
  folderDepth: number = 3,
  verbose: boolean = false,
  continueFromError: boolean = false,
  continueUpdateOnly: boolean = false
): Promise<void> {
  // Set global variables based on parameters
  isDryRun = dryRun;
  limit = recordLimit;
  maxDepth = folderDepth;
  isVerbose = verbose;
  
  // Check for active filter profile
  const activeFilter = await getActiveFilterProfile();
  let effectiveFolderId = folderId;
  
  if (activeFilter && activeFilter.rootDriveId) {
    console.log(`\n🔍 Active filter profile detected: "${activeFilter.profile.name}"`);
    console.log(`   Using root_drive_id: ${activeFilter.rootDriveId}`);
    effectiveFolderId = activeFilter.rootDriveId;
  } else {
    console.log(`\n📁 No active filter profile - using default folder: ${folderId}`);
  }
  
  // Parse arguments to look for continuation parameters
  const args = process.argv.slice(2);
  
  // Check for error continuation flag (skips sync phase)
  const continueFromErrorArg = args.includes('--continue-from-error') || 
                               args.some(arg => arg.startsWith('--continue-from-error=')) ||
                               continueFromError === true;
  
  // Check for update-only flag (skips sync phase)
  const continueUpdateOnlyArg = args.includes('--continue-update-only') || 
                                args.some(arg => arg.startsWith('--continue-update-only=')) ||
                                continueUpdateOnly === true;
  
  // Allow resuming from a failed operation (skipping the sync part)
  const skipSyncPhase = continueFromErrorArg || continueUpdateOnlyArg;
  
  console.log('=== Dynamic Healing Discussion Group Sync and Update ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Records limit for update: ${limit}`);
  console.log(`Max folder depth: ${maxDepth}`);
  console.log(`Verbose logging: ${isVerbose ? 'ON' : 'OFF'}`);
  if (specificFileId) {
    console.log(`Specific file lookup: ${specificFileId}`);
  }
  console.log('=========================================================');

  try {
    // Initialize Google Drive client using the singleton pattern
    const driveService = getGoogleDriveService(supabase);
    
    // If a specific file ID was provided, do a direct lookup
    if (specificFileId) {
      await lookupSpecificFile(driveService, specificFileId, effectiveFolderId, isDryRun, isVerbose);
    }
    
    // TEMPORARY: Direct test for specific file
    if (isVerbose) {
      console.log('\n=== TESTING DIRECT FILE LOOKUP ===');
      const testFileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
      try {
        // Use GoogleDriveService to get file with proper spacing in the fields parameter
        const fileData = await driveService.getFile(
          testFileId,
          'id, name, mimeType, parents, modifiedTime'
        );
        
        console.log('TEST FILE FOUND:', fileData);
        
        // Check if it's in our target folder
        const parentFolderId = fileData.parents?.[0];
        console.log(`Parent folder ID: ${parentFolderId}`);
        console.log(`Target folder ID: ${effectiveFolderId}`);
        console.log(`Is in target folder: ${parentFolderId === effectiveFolderId}`);
        
        // Also try to list files directly in the root folder
        console.log('\nDirect file listing in root folder:');
        // Use our helper function for listing files
        // Fix direct file listing by using the helper without custom fields
        const files = await listFilesInFolder(
          driveService,
          effectiveFolderId
        );
        
        console.log(`Found ${files.length} files directly in root folder`);
        
        const testFile = files.find((f: any) => f.id === testFileId);
        if (testFile) {
          console.log('TEST FILE found in direct listing:', testFile);
        } else {
          console.log('TEST FILE NOT FOUND in direct listing');
          // Show all files in root
          console.log('All files in root folder:');
          files.forEach((f: any, i: number) => {
            console.log(`${i+1}. ${f.name} (${f.id}) - ${f.mimeType}`);
          });
        }
      } catch (error: any) {
        console.error('Error looking up test file:', error.message || error);
      }
      console.log('=== END TEST FILE LOOKUP ===\n');
    }
    
    // First check if folder exists
    console.log(`Checking folder: ${effectiveFolderId}`);
    
    try {
      // Use GoogleDriveService to get folder
      const folder = await driveService.getFile(
        effectiveFolderId,
        'id, name, mimeType'
      );
      
      console.log(`✅ Folder exists: "${folder.name}"`);
      
      if (folder.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`The provided ID is not a folder: ${folder.mimeType}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to get folder: ${error.message || error}`);
      process.exit(1);
    }

    // Initialize sync result
    let syncResult: FileSyncResult;
    
    // STEP 1: Sync files from Google Drive to Supabase (unless skipping)
    if (skipSyncPhase) {
      console.log('\n=== Step 1: Skipping Sync Phase (continuing from error) ===');
      // Create a dummy sync result
      syncResult = {
        filesFound: 0,
        filesInserted: 0,
        filesUpdated: 0,
        filesMarkedDeleted: 0,
        filesSkipped: 0,
        errors: [],
        filesByType: {}
      };
    } else {
      console.log('\n=== Step 1: Sync Files from Google Drive ===');
      syncResult = await syncFiles(driveService, effectiveFolderId, isDryRun, maxDepth);
    }
    
    console.log('\n=== Sync Summary ===');
    console.log(`Files found: ${syncResult.filesFound}`);
    console.log(`Files inserted: ${syncResult.filesInserted} (all marked as needs_reprocessing)`);
    console.log(`Files updated: ${syncResult.filesUpdated}`);
    console.log(`Files marked deleted: ${syncResult.filesMarkedDeleted}`);
    console.log(`Files skipped: ${syncResult.filesSkipped}`);
    console.log(`Errors: ${syncResult.errors.length}`);
    
    // Add note about reprocessing if new files were inserted
    if (syncResult.filesInserted > 0) {
      console.log('\n📋 NOTE: New files were added and marked as "needs_reprocessing".');
      console.log('   Details of these files will be shown at the end of the sync process.');
    }
    
    // Create a report of sync changes if not in dry run mode
    if (!isDryRun) {
      // Generate a report file with changes
      const reportDate = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const reportFilePath = `${process.cwd()}/docs/script-reports/sync-report-${reportDate}.md`;
      
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure directory exists
        const reportDir = path.dirname(reportFilePath);
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }
        
        // Build the report content
        let reportContent = `# Google Drive Sync Report - ${new Date().toLocaleString()}\n\n`;
        
        // Add summary section
        reportContent += `## Summary\n\n`;
        reportContent += `- Files found: ${syncResult.filesFound}\n`;
        reportContent += `- Files inserted: ${syncResult.filesInserted}\n`;
        reportContent += `- Files updated: ${syncResult.filesUpdated}\n`;
        reportContent += `- Files marked deleted: ${syncResult.filesMarkedDeleted}\n\n`;
        
        // Add new files section if any were inserted
        if (syncResult.filesInserted > 0) {
          reportContent += `## New Files (${syncResult.filesInserted})\n\n`;
          
          // Fetch details of newly inserted files
          const supabase = SupabaseClientService.getInstance().getClient();
          const { data: newFiles } = await supabase
            .from('google_sources')
            .select('id, name, mime_type, path, created_at')
            .eq('root_drive_id', effectiveFolderId)
            .order('created_at', { ascending: false })
            .limit(Math.min(syncResult.filesInserted, 50));
            
          if (newFiles && newFiles.length > 0) {
            reportContent += `| Name | Type | Path | Created |\n`;
            reportContent += `|------|------|------|--------|\n`;
            
            for (const file of newFiles) {
              const fileType = file.mime_type ? file.mime_type.split('/').pop() : 'unknown';
              const createdDate = new Date(file.created_at).toLocaleString();
              reportContent += `| ${file.name} | ${fileType} | ${file.path || 'N/A'} | ${createdDate} |\n`;
            }
            
            if (newFiles.length < syncResult.filesInserted) {
              reportContent += `\n*...and ${syncResult.filesInserted - newFiles.length} more files*\n`;
            }
          } else {
            reportContent += `*Details of new files could not be retrieved*\n\n`;
          }
        } else {
          // Show note that no new files were found, but include search for recent files anyway
          reportContent += `## New Files\n\n`;
          reportContent += `No new files were inserted in this sync run.\n\n`;
          
          // Even if no new files were inserted in this run, fetch the most recent files from the database
          // to show files that might have been added recently
          const supabase = SupabaseClientService.getInstance().getClient();
          const { data: recentFiles } = await supabase
            .from('google_sources')
            .select('id, name, mime_type, path, created_at')
            .eq('root_drive_id', effectiveFolderId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (recentFiles && recentFiles.length > 0) {
            reportContent += `### Most Recently Added Files\n\n`;
            reportContent += `| Name | Type | Path | Created |\n`;
            reportContent += `|------|------|------|--------|\n`;
            
            for (const file of recentFiles) {
              const fileType = file.mime_type ? file.mime_type.split('/').pop() : 'unknown';
              const createdDate = new Date(file.created_at).toLocaleString();
              reportContent += `| ${file.name} | ${fileType} | ${file.path || 'N/A'} | ${createdDate} |\n`;
            }
          }
        }
        
        // Add renamed files section if any were detected
        const { data: possiblyRenamedFiles } = await supabase
          .from('google_sources')
          .select('id, name, path, updated_at')
          .eq('root_drive_id', effectiveFolderId)
          .eq('is_deleted', false)
          .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .order('updated_at', { ascending: false })
          .limit(20);
            
        if (possiblyRenamedFiles && possiblyRenamedFiles.length > 0) {
          reportContent += `## Likely Renamed Files\n\n`;
          reportContent += `These files were updated in the last 24 hours and might have been renamed:\n\n`;
          reportContent += `| Name | Path | Last Updated |\n`;
          reportContent += `|------|------|-------------|\n`;
          
          for (const file of possiblyRenamedFiles) {
            const updatedDate = new Date(file.updated_at).toLocaleString();
            reportContent += `| ${file.name} | ${file.path || 'N/A'} | ${updatedDate} |\n`;
          }
          
          reportContent += `\nChanges to file names are preserved by updating the name while keeping the same ID and document information.\n`;
          reportContent += `Manual verification is recommended for any renamed files.\n\n`;
        } else {
          reportContent += `## Likely Renamed Files\n\n`;
          reportContent += `No files appear to have been renamed in the last 24 hours.\n\n`;
          reportContent += `Changes to file names are preserved by updating the name while keeping the same ID and document information.\n`;
          reportContent += `Manual verification is recommended for any renamed files.\n\n`;
        }
        
        // Add deleted files section if any
        if (syncResult.filesMarkedDeleted > 0) {
          reportContent += `## Deleted Files (${syncResult.filesMarkedDeleted})\n\n`;
          
          // Try to fetch recently deleted files
          const { data: deletedFiles } = await supabase
            .from('google_sources')
            .select('id, name, path, updated_at')
            .eq('root_drive_id', effectiveFolderId)
            .eq('is_deleted', true)
            .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
            .order('updated_at', { ascending: false })
            .limit(20);
            
          if (deletedFiles && deletedFiles.length > 0) {
            reportContent += `Recently deleted files:\n\n`;
            reportContent += `| Name | Path | Deletion Time |\n`;
            reportContent += `|------|------|--------------|\\n`;
            
            for (const file of deletedFiles) {
              const deletedDate = new Date(file.updated_at).toLocaleString();
              reportContent += `| ${file.name} | ${file.path || 'N/A'} | ${deletedDate} |\n`;
            }
            
            reportContent += `\n`;
          }
          
          reportContent += `Files marked as deleted are not removed from the database but flagged with \`is_deleted = true\`.\n`;
          reportContent += `These files can be restored using the \`reset-deleted-files\` command if needed.\n\n`;
        } else {
          reportContent += `## Deleted Files\n\n`;
          reportContent += `No files were marked as deleted in this sync run.\n\n`;
        }
        
        // Write the report to file
        fs.writeFileSync(reportFilePath, reportContent);
        console.log(`\n✅ Sync report written to: ${reportFilePath}`);
      } catch (error) {
        console.error(`Error creating sync report: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (syncResult.errors.length > 0) {
      console.error('\nErrors encountered during sync:');
      syncResult.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error}`);
      });
    }
    
    // SAFETY: Ensure the root folder is never marked as deleted
    if (!isDryRun) {
      console.log('\n=== Ensuring Root Folder Status ===');
      try {
        // Check if the root folder exists and is marked as deleted
        const { data: rootFolderCheck, error: rootCheckError } = await supabase
          .from('google_sources')
          .select('id, is_deleted')
          .eq('drive_id', effectiveFolderId)
          .single();
          
        if (rootCheckError) {
          console.error(`Error checking root folder status: ${rootCheckError.message}`);
        } else if (rootFolderCheck) {
          if (rootFolderCheck.is_deleted) {
            console.log('Root folder was marked as deleted, fixing...');
            
            // Update the root folder to ensure it's not marked as deleted
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({
                is_deleted: false,
                updated_at: new Date().toISOString()
              })
              .eq('drive_id', effectiveFolderId);
              
            if (updateError) {
              console.error(`Error fixing root folder deletion status: ${updateError.message}`);
            } else {
              console.log('✅ Root folder restoration complete');
            }
          } else {
            console.log('✅ Root folder is correctly marked as not deleted');
          }
        } else {
          console.log('Root folder not found in database');
        }
      } catch (error: any) {
        console.error(`Error ensuring root folder status: ${error.message || error}`);
      }
      console.log('=== End Root Folder Check ===\n');
    }
    
    // SUMMARY: Display newly inserted files
    if (syncResult.filesInserted > 0) {
      console.log('\n=== NEWLY ADDED FILES (All marked as needs_reprocessing) ===');
      
      try {
        // Fetch the recently inserted files - 
        // Make sure we get enough records even if there are many, but still limit to a reasonable number
        const maxNewFilesToShow = Math.min(syncResult.filesInserted, 50); // Show up to 50 new files
        
        const { data: newFiles, error: newFilesError } = await supabase
          .from('google_sources')
          .select(`
            id, 
            name, 
            drive_id, 
            mime_type, 
            created_at, 
            parent_folder_id,
            path_array,
            document_type_id
          `)
          .eq('root_drive_id', effectiveFolderId)
          .order('created_at', { ascending: false })
          .limit(maxNewFilesToShow);
          
        if (newFilesError) {
          console.error(`Error fetching newly added files: ${newFilesError.message}`);
        } else if (newFiles && newFiles.length > 0) {
          console.log(`Found ${newFiles.length} recently added files marked for reprocessing:`);
          console.log('----------------------------------------------------------------------------------------------------------------------------------');
          console.log('| Filename                       | Document Type                 | Created At           | Processing Status      | Parent Folder          |');
          console.log('----------------------------------------------------------------------------------------------------------------------------------');
          
          // Get parent folder names for all files
          const parentFolderIds = new Set(newFiles.map(file => file.parent_folder_id).filter(Boolean));
          const parentFolderMap = new Map<string, string>();
          
          if (parentFolderIds.size > 0) {
            const { data: parentFolders, error: parentFoldersError } = await supabase
              .from('google_sources')
              .select('id, drive_id, name')
              .in('drive_id', Array.from(parentFolderIds));
              
            if (!parentFoldersError && parentFolders) {
              parentFolders.forEach(folder => {
                parentFolderMap.set(folder.drive_id, folder.name);
              });
            }
          }
          
          // Get document type names for all files with document_type_id
          const documentTypeIds = new Set(newFiles.map(file => file.document_type_id).filter(Boolean));
          const documentTypeMap = new Map<string, string>();
          
          if (documentTypeIds.size > 0) {
            try {
              const { data: documentTypes, error: documentTypesError } = await supabase
                .from('document_types')
                .select('id, document_type')
                .in('id', Array.from(documentTypeIds));
                
              if (!documentTypesError && documentTypes) {
                documentTypes.forEach(docType => {
                  documentTypeMap.set(docType.id, docType.document_type);
                });
              }
            } catch (error) {
              console.warn('Error fetching document types:', error);
            }
          }
          
          // Display files in a table format
          for (const file of newFiles) {
            const name = (file.name || 'Unknown').substring(0, 30).padEnd(30);
            
            // Get document type - use document type map, or mime_type as fallback
            let documentType = 'Unknown';
            if (file.document_type_id && documentTypeMap.has(file.document_type_id)) {
              documentType = documentTypeMap.get(file.document_type_id) || 'Unknown';
            } else if (file.document_type_id) {
              documentType = `ID: ${file.document_type_id.substring(0, 8)}...`;
            } else if (file.mime_type) {
              documentType = file.mime_type.split('/').pop() || file.mime_type;
            }
            documentType = documentType.substring(0, 30).padEnd(30);
            
            // Format created_at date
            const createdAt = new Date(file.created_at).toISOString().substring(0, 16).replace('T', ' ').padEnd(20);
            
            // Get parent folder name
            let parentFolder = 'Unknown';
            if (file.parent_folder_id) {
              parentFolder = parentFolderMap.get(file.parent_folder_id) || 'Unknown';
            } else if (file.path_array && file.path_array.length > 1) {
              // Try to get folder name from path array
              parentFolder = file.path_array[file.path_array.length - 2] || 'Unknown';
            }
            parentFolder = parentFolder.substring(0, 22).padEnd(22);
            
            // Add processing status
            // Since we no longer have document_processing_status on sources_google,
            // we'll show "needs_reprocessing" for all newly added files
            const processingStatus = "needs_reprocessing".substring(0, 20).padEnd(20);
            
            console.log(`| ${name} | ${documentType} | ${createdAt} | ${processingStatus} | ${parentFolder} |`);
          }
          
          console.log('----------------------------------------------------------------------------------------------------------------------------------');
          console.log('➡️  All newly added files have expert_document records created with "needs_reprocessing" status.');
          console.log('➡️  To process these files, run: ./google-sync-cli.sh reclassify-docs');
          console.log('----------------------------------------------------------------------------------------------------------------------------------');
        } else {
          console.log('No newly added files found in the database.');
        }
      } catch (error: any) {
        console.error(`Error retrieving newly added files: ${error.message || error}`);
      }
    }

    // STEP 2: Update metadata for the files
    console.log('\n=== Step 2: Update Metadata ===');
    console.log(`Starting metadata update for ${limit} records...`);
    console.log(`This may take some time. Progress updates will be shown for each batch.`);
    
    // Start progress timer
    const metadataStartTime = new Date();
    
    // Show initial spinner/progress indicator
    if (!isVerbose) {
      process.stdout.write(`Fetching records from Supabase... `);
    }
    
    const updateResult = await updateMetadata(driveService, effectiveFolderId, limit, isDryRun, isVerbose);
    
    // Show total time taken for metadata update
    const metadataEndTime = new Date();
    const metadataTimeTaken = (metadataEndTime.getTime() - metadataStartTime.getTime()) / 1000;
    console.log(`\nMetadata update completed in ${metadataTimeTaken.toFixed(2)} seconds.`);

    console.log('\n=== Update Summary ===');
    console.log(`Records found: ${updateResult.records}`);
    console.log(`Records updated: ${updateResult.updated}`);
    console.log(`Records skipped: ${updateResult.skipped}`);
    console.log(`Errors: ${updateResult.errors.length}`);
    console.log(`Duration: ${(updateResult.endTime.getTime() - updateResult.startTime.getTime()) / 1000}s`);

    if (updateResult.errors.length > 0) {
      console.error('\nErrors encountered during update:');
      updateResult.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error}`);
      });
    }

    console.log('\n=== Sync and Update Complete ===');
  } catch (error: any) {
    console.error('Unexpected error:', error.message || error);
    process.exit(1);
  }
}

// Only run if this file is executed directly (not imported)
if (require.main === module) {
  // Parse additional parameter for specific file check
  const specificFileIdIndex = args.indexOf('--file-id');
  const specificFileId = specificFileIdIndex !== -1 && args[specificFileIdIndex + 1] 
    ? args[specificFileIdIndex + 1] 
    : undefined;
  
  // Execute the main function with optional specificFileId parameter
  syncAndUpdateMetadata(
    DYNAMIC_HEALING_FOLDER_ID,
    specificFileId,
    isDryRun,
    limit,
    maxDepth,
    isVerbose
  ).catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}