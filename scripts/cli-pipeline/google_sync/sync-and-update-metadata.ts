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
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Parse limit
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 1000; // Increased default from 10 to 1000

// Parse max depth
const maxDepthIndex = args.indexOf('--max-depth');
const maxDepth = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
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
          parentFolderId: folderId
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
 * Sync files from Google Drive to Supabase sources_google2 table
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
        .from('sources_google2')
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
            .from('sources_google2')
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
        
        // Prepare the insert data - don't include id, it should be generated by the database
        const insertData = {
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
          .from('sources_google2')
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
    const foundDriveIds = new Set(allFiles.map(file => file.id));
    
    // Get existing files to avoid duplicates
    const { data: existingRecords, error: queryError } = await supabase
      .from('sources_google2')
      .select('id, drive_id, root_drive_id')
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
      .filter(record => record.root_drive_id === DYNAMIC_HEALING_FOLDER_ID && !foundDriveIds.has(record.drive_id));
    
    if (recordsToMarkDeleted.length > 0) {
      console.log(`Found ${recordsToMarkDeleted.length} files to mark as deleted`);
      
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
            .from('sources_google2')
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
      
      if (newFilesInBatch.length === 0) {
        console.log('No new files in this batch, skipping...');
        continue;
      }
      
      // Prepare the data for insertion
      const filesToInsert = newFilesInBatch.map(file => {
        // Create path array from file path
        const pathArray = file.path ? file.path.split('/').filter(Boolean) : [];
        if (file.path?.startsWith('/')) {
          // Add empty string at the beginning for absolute paths
          pathArray.unshift('');
        }
        
        return {
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          path: file.path || `/${file.name}`,
          path_array: pathArray,
          path_depth: pathArray.length,
          parent_folder_id: file.parentFolderId,
          root_drive_id: DYNAMIC_HEALING_FOLDER_ID,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          web_view_link: file.webViewLink,
          thumbnail_link: file.thumbnailLink,
          modified_at: file.modifiedTime,
          size: file.size ? parseInt(file.size, 10) : null,
          metadata: {
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            thumbnailLink: file.thumbnailLink,
            mimeType: file.mimeType
          }
        };
      });
      
      // Insert the files into the database
      try {
        if (isVerbose) {
          console.log(`Preparing to insert ${filesToInsert.length} files for batch ${i + 1}/${batches}`);
        }
        
        const { error } = await supabase
          .from('sources_google2')
          .insert(filesToInsert);
        
        if (error) {
          console.error(`Error inserting batch ${i + 1}:`, error);
          console.error(`Detailed error:`, JSON.stringify(error, null, 2));
          
          // If there's a constraint violation, log the first record to help debug
          if (error.code === '23502' || error.code === '23505') {
            console.error(`First record in the problematic batch:`, JSON.stringify(filesToInsert[0], null, 2));
          }
          
          result.errors.push(`Error inserting batch ${i + 1}: ${error.message}`);
          result.filesSkipped += newFilesInBatch.length;
        } else {
          result.filesInserted += newFilesInBatch.length;
          console.log(`Successfully inserted ${newFilesInBatch.length} new files in batch ${i + 1}`);
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
      .from('sources_google2')
      .select('*')
      .eq('root_drive_id', folderId)  // Get all files with this root folder 
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    if (!records || records.length === 0) throw new Error('No records returned from Supabase');
    
    result.records = records.length;
    if (verbose) console.log(`Found ${records.length} records`);
    
    // Process each record
    for (const record of records) {
      try {
        if (verbose) console.log(`Processing record: ${record.name} (${record.drive_id})`);
        
        // Skip records without drive_id
        if (!record.drive_id) {
          if (verbose) console.log(`Skipping record without drive_id: ${record.id}`);
          result.skipped++;
          continue;
        }
        
        // Get current file metadata from Google Drive using service account
        try {
          const response = await drive.files.get({
            fileId: record.drive_id,
            fields: 'id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink'
          });
          
          const fileData = response.data;
          
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
          
          // Update record in Supabase
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('sources_google2')
              .update(updateData)
              .eq('id', record.id);
              
            if (updateError) throw updateError;
            
            if (verbose) console.log(`Updated record: ${record.name}`);
          } else if (verbose) {
            console.log(`DRY RUN: Would update record: ${record.name}`);
            console.log('Update data:', updateData);
          }
          
          result.updated++;
        } catch (error: any) {
          const errorMessage = `Error getting file metadata: ${error.message || 'Unknown error'}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
          result.skipped++;
        }
      } catch (error: any) {
        const errorMessage = `Error updating record ${record.id}: ${error.message || 'Unknown error'}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);
        result.skipped++;
      }
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
 * Main function
 */
async function syncAndUpdateMetadata(): Promise<void> {
  console.log('=== Dynamic Healing Discussion Group Sync and Update ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Records limit for update: ${limit}`);
  console.log(`Max folder depth: ${maxDepth}`);
  console.log(`Verbose logging: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log('=========================================================');

  try {
    // Initialize Google Drive client with service account
    const drive = await initDriveClient();
    if (!drive) {
      console.error('❌ Failed to initialize Google Drive client');
      process.exit(1);
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
    console.log(`Files inserted: ${syncResult.filesInserted}`);
    console.log(`Files updated: ${syncResult.filesUpdated}`);
    console.log(`Files marked deleted: ${syncResult.filesMarkedDeleted}`);
    console.log(`Files skipped: ${syncResult.filesSkipped}`);
    console.log(`Errors: ${syncResult.errors.length}`);
    
    if (syncResult.errors.length > 0) {
      console.error('\nErrors encountered during sync:');
      syncResult.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error}`);
      });
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

// Execute the main function
syncAndUpdateMetadata().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});