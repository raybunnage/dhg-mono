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
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import type { Database } from '../../../supabase/types';

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

/**
 * Initialize Google Drive client using service account
 */
async function initDriveClient() {
  try {
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                       path.resolve(process.cwd(), '.service-account.json');
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      console.log('\nPlease do one of the following:');
      console.log('1. Create the file at the path above');
      console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable to the correct path');
      return null;
    }
    
    // Read and parse the service account key file
    const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    // Create JWT auth client with the service account
    const auth = new google.auth.JWT(
      keyFile.client_email,
      undefined,
      keyFile.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );
    
    // Initialize the Drive client
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('❌ Error initializing Drive client:', error);
    return null;
  }
}

/**
 * List files recursively
 */
async function listFilesRecursively(
  drive: any, 
  folderId: string, 
  maxDepth: number = 3,
  currentDepth: number = 0,
  parentPath: string = '/'
): Promise<GoogleDriveFile[]> {
  let allFiles: GoogleDriveFile[] = [];
  let pageToken: string | null = null;
  
  if (currentDepth > maxDepth) {
    if (isVerbose) console.log(`Reached max depth (${maxDepth}) at ${parentPath}`);
    return [];
  }
  
  try {
    // Query to get files in the current folder
    const query = `'${folderId}' in parents and trashed=false`;
    
    do {
      // Get a page of files
      const response: any = await drive.files.list({
        q: query,
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, size, thumbnailLink, webViewLink)',
        pageToken: pageToken
      });
      
      const files = response.data.files || [];
      
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
          drive, 
          folder.id, 
          maxDepth, 
          currentDepth + 1, 
          folderPath
        );
        
        allFiles = [...allFiles, ...subFiles];
      }
      
      pageToken = response.data.nextPageToken;
    } while (pageToken);
    
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
      .from('sources_google')
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
async function insertSpecificFile(drive: any, fileId: string, parentId: string, isDryRun: boolean, isVerbose: boolean): Promise<{ success: boolean, message?: string, data?: any }> {
  console.log(`=== Attempting to insert specific file ${fileId} ===`);
  
  try {
    // First check if file already exists
    const existsCheck = await checkFileExists(fileId);
    if (existsCheck.exists && existsCheck.data) {
      console.log(`File already exists in the database: ${existsCheck.data.name} (ID: ${existsCheck.data.id})`);
      return { success: false, message: 'File already exists' };
    }
    
    // Get file details from Google Drive
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,parents,modifiedTime,size,thumbnailLink,webViewLink'
    });
    
    const file = response.data;
    console.log(`✅ Found file in Google Drive: ${file.name} (${file.mimeType})`);
    
    // Get parent path
    let parentPath = '/';
    try {
      const parentResponse = await drive.files.get({
        fileId: parentId,
        fields: 'id,name,parents'
      });
      
      const folderName = parentResponse.data.name;
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
    const path_depth = (parentId === DYNAMIC_HEALING_FOLDER_ID) ? 1 : 1;
    
    if (isVerbose) {
      console.log(`Path depth calculation:`);
      console.log(`- Path: ${filePath}`);
      console.log(`- Parent ID: ${parentId}`);
      console.log(`- Root folder ID: ${DYNAMIC_HEALING_FOLDER_ID}`);
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
      root_drive_id: DYNAMIC_HEALING_FOLDER_ID,
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
      .from('sources_google')
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
      let documentProcessingStatus = 'needs_reprocessing';
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
        // These are document types that should be processed
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
        .from('expert_documents')
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
  drive: any, 
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
    // Get folder details
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,webViewLink,modifiedTime'
    });
    
    console.log(`Syncing folder: ${folder.data.name} (${folderId})`);
    
    // Ensure it's a root folder in Supabase
    if (!isDryRun) {
      console.log('Ensuring folder is registered as a root folder...');
      const { data: existingFolders, error: queryError } = await supabase
        .from('sources_google')
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
            .from('sources_google')
            .update({
              name: folder.data.name,
              is_root: true,
              path: `/${folder.data.name}`,
              path_array: ['', folder.data.name],
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
          name: folder.data.name,
          is_root: true,
          mime_type: 'application/vnd.google-apps.folder',
          path: `/${folder.data.name}`,
          path_array: ['', folder.data.name],
          path_depth: 2,
          parent_folder_id: null,
          metadata: { 
            isRootFolder: true,
            webViewLink: folder.data.webViewLink,
            modifiedTime: folder.data.modifiedTime
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
          .from('sources_google')
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
    const allFiles = await listFilesRecursively(drive, folderId, maxDepth);
    
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
      .from('sources_google')
      .select('id, drive_id, root_drive_id, name')
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
    // Filter for records with root_drive_id = DYNAMIC_HEALING_FOLDER_ID that are missing from foundDriveIds
    const recordsToMarkDeleted = (existingRecords || [])
      .filter(record => 
        record.root_drive_id === DYNAMIC_HEALING_FOLDER_ID && 
        !foundDriveIds.has(record.drive_id)
      );
      
    // Double-check to make sure root folder isn't in the deletion list
    const rootFolderInDeletionList = recordsToMarkDeleted.some(record => record.drive_id === folderId);
    if (rootFolderInDeletionList && isVerbose) {
      console.error(`WARNING: Root folder found in deletion list despite safeguards! This shouldn't happen.`);
    }
    
    // Debug check for the root folder
    if (isVerbose) {
      const rootFolderRecord = (existingRecords || []).find(record => record.drive_id === DYNAMIC_HEALING_FOLDER_ID);
      console.log("\n=== ROOT FOLDER CHECK ===");
      console.log(`Root folder found in database: ${rootFolderRecord ? 'YES' : 'NO'}`);
      if (rootFolderRecord) {
        console.log(`Root folder ID: ${rootFolderRecord.id}`);
        console.log(`Root folder would be marked as deleted: ${!foundDriveIds.has(DYNAMIC_HEALING_FOLDER_ID) ? 'YES (but prevented)' : 'NO'}`);
      }
      console.log("=== END ROOT FOLDER CHECK ===\n");
    }
    
    if (recordsToMarkDeleted.length > 0) {
      console.log(`Found ${recordsToMarkDeleted.length} files to mark as deleted`);
      
      // In verbose mode, show the files that will be marked as deleted
      if (isVerbose) {
        console.log("\n=== Files to mark as deleted ===");
        recordsToMarkDeleted.slice(0, 10).forEach((record, index) => {
          console.log(`${index + 1}. ${record.name || 'Unnamed'} (${record.drive_id})`);
          // Try to verify if the file truly doesn't exist in Google Drive
          try {
            const checkFilePromise = async () => {
              try {
                await drive.files.get({
                  fileId: record.drive_id,
                  fields: 'id,name'
                });
                return { exists: true };
              } catch (error: any) {
                return { exists: false, error: error.message };
              }
            };
            checkFilePromise().then(result => {
              if (result.exists) {
                console.log(`   ⚠️ WARNING: File ${record.drive_id} actually EXISTS in Google Drive!`);
              } else {
                console.log(`   ✓ Verified: File doesn't exist in Google Drive`);
              }
            });
          } catch (error) {
            console.log(`   ? Unable to verify file existence: ${error}`);
          }
        });
        if (recordsToMarkDeleted.length > 10) {
          console.log(`... and ${recordsToMarkDeleted.length - 10} more files`);
        }
        console.log("=== End files to mark as deleted ===\n");
      }
      
      if (!isDryRun) {
        // Mark files as deleted in batches
        const batchSize = 50;
        const deleteBatches = Math.ceil(recordsToMarkDeleted.length / batchSize);
        
        for (let i = 0; i < deleteBatches; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, recordsToMarkDeleted.length);
          const batch = recordsToMarkDeleted.slice(start, end);
          
          console.log(`Processing deletion batch ${i + 1}/${deleteBatches} (${batch.length} files)`);
          
          const idsToUpdate = batch.map(record => record.id);
          
          const { error } = await supabase
            .from('sources_google')
            .update({
              is_deleted: true,
              updated_at: new Date().toISOString()
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
      } else {
        console.log(`DRY RUN: Would mark ${recordsToMarkDeleted.length} files as deleted`);
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
          drive, 
          testFileId, 
          testFileInBatch.parentFolderId || DYNAMIC_HEALING_FOLDER_ID, 
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
          root_drive_id: DYNAMIC_HEALING_FOLDER_ID,
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
          .from('sources_google')
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
                let documentProcessingStatus = 'needs_reprocessing';
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
                  // These are document types that should be processed
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
                .from('expert_documents')
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
  drive: any,
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
      .from('sources_google')
      .select('*')
      .eq('root_drive_id', folderId)  // Get all files with this root folder 
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    if (!records || records.length === 0) throw new Error('No records returned from Supabase');
    
    result.records = records.length;
    if (verbose) console.log(`Found ${records.length} records`);
    
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
            
            const response = await drive.files.get({
              fileId: record.drive_id,
              fields: 'id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink'
            });
            
            return { record, fileData: response.data, success: true };
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
          if (verbose) console.log(`Batch updating ${recordsToUpdate.length} records...`);
          
          // Update each record individually (could be optimized further with UPSERT)
          for (const updateData of recordsToUpdate) {
            const recordId = updateData.id;
            delete updateData.id; // Remove ID from update data
            
            const { error: updateError } = await supabase
              .from('sources_google')
              .update(updateData)
              .eq('id', recordId);
              
            if (updateError) {
              const errorMessage = `Error updating record ${recordId}: ${updateError.message}`;
              console.error(errorMessage);
              result.errors.push(errorMessage);
              result.skipped++;
            } else {
              result.updated++;
              if (verbose) console.log(`Updated record: ${recordId}`);
            }
          }
        } else {
          if (verbose) console.log(`DRY RUN: Would update ${recordsToUpdate.length} records`);
          result.updated += recordsToUpdate.length;
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
async function lookupSpecificFile(drive: any, fileId: string, isDryRun: boolean, isVerbose: boolean): Promise<void> {
  console.log(`\n=== Direct Lookup for File ID: ${fileId} ===`);
  
  try {
    // First check if file already exists in database
    const existsCheck = await checkFileExists(fileId);
    if (existsCheck.exists && existsCheck.data) {
      console.log(`✅ File already exists in the database: ${existsCheck.data.name} (ID: ${existsCheck.data.id})`);
      return;
    }
    
    // Look up file in Google Drive
    try {
      const fileResponse = await drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,parents,modifiedTime'
      });
      
      console.log(`✅ File found in Google Drive: ${fileResponse.data.name} (${fileResponse.data.mimeType})`);
      
      // Get parent folder ID
      const parentFolderId = fileResponse.data.parents?.[0] || DYNAMIC_HEALING_FOLDER_ID;
      console.log(`Parent folder ID: ${parentFolderId}`);
      
      // Insert the file
      console.log(`Attempting to insert file into database...`);
      const insertResult = await insertSpecificFile(drive, fileId, parentFolderId, isDryRun, isVerbose);
      
      if (insertResult.success) {
        console.log(`✅ Successfully performed direct lookup and insertion of file ${fileResponse.data.name} (${fileId})`);
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
  verbose: boolean = false
): Promise<void> {
  // Set global variables based on parameters
  isDryRun = dryRun;
  limit = recordLimit;
  maxDepth = folderDepth;
  isVerbose = verbose;
  
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
    // Initialize Google Drive client with service account
    const drive = await initDriveClient();
    if (!drive) {
      console.error('❌ Failed to initialize Google Drive client');
      process.exit(1);
    }
    
    // If a specific file ID was provided, do a direct lookup
    if (specificFileId) {
      await lookupSpecificFile(drive, specificFileId, isDryRun, isVerbose);
    }
    
    // TEMPORARY: Direct test for specific file
    if (isVerbose) {
      console.log('\n=== TESTING DIRECT FILE LOOKUP ===');
      const testFileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
      try {
        const fileResponse = await drive.files.get({
          fileId: testFileId,
          fields: 'id,name,mimeType,parents,modifiedTime'
        });
        
        console.log('TEST FILE FOUND:', fileResponse.data);
        
        // Check if it's in our target folder
        const parentFolderId = fileResponse.data.parents?.[0];
        console.log(`Parent folder ID: ${parentFolderId}`);
        console.log(`Target folder ID: ${DYNAMIC_HEALING_FOLDER_ID}`);
        console.log(`Is in target folder: ${parentFolderId === DYNAMIC_HEALING_FOLDER_ID}`);
        
        // Also try to list files directly in the root folder
        console.log('\nDirect file listing in root folder:');
        const listResponse = await drive.files.list({
          q: `'${DYNAMIC_HEALING_FOLDER_ID}' in parents and trashed=false`,
          pageSize: 1000,
          fields: 'files(id,name,mimeType)'
        });
        
        const files = listResponse.data.files || [];
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
    console.log(`Checking folder: ${DYNAMIC_HEALING_FOLDER_ID}`);
    
    try {
      const folder = await drive.files.get({
        fileId: DYNAMIC_HEALING_FOLDER_ID,
        fields: 'id,name,mimeType'
      });
      
      console.log(`✅ Folder exists: "${folder.data.name}"`);
      
      if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`The provided ID is not a folder: ${folder.data.mimeType}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to get folder: ${error.message || error}`);
      process.exit(1);
    }

    // STEP 1: Sync files from Google Drive to Supabase
    console.log('\n=== Step 1: Sync Files from Google Drive ===');
    const syncResult = await syncFiles(drive, DYNAMIC_HEALING_FOLDER_ID, isDryRun, maxDepth);
    
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
          .from('sources_google')
          .select('id, is_deleted')
          .eq('drive_id', DYNAMIC_HEALING_FOLDER_ID)
          .single();
          
        if (rootCheckError) {
          console.error(`Error checking root folder status: ${rootCheckError.message}`);
        } else if (rootFolderCheck) {
          if (rootFolderCheck.is_deleted) {
            console.log('Root folder was marked as deleted, fixing...');
            
            // Update the root folder to ensure it's not marked as deleted
            const { error: updateError } = await supabase
              .from('sources_google')
              .update({
                is_deleted: false,
                updated_at: new Date().toISOString()
              })
              .eq('drive_id', DYNAMIC_HEALING_FOLDER_ID);
              
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
          .from('sources_google')
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
          .eq('root_drive_id', DYNAMIC_HEALING_FOLDER_ID)
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
              .from('sources_google')
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
    const updateResult = await updateMetadata(drive, DYNAMIC_HEALING_FOLDER_ID, limit, isDryRun, isVerbose);

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