#!/usr/bin/env ts-node
/**
 * Sync DR Clawson Papers Folder to Database
 * 
 * This script synchronizes files from the DR Clawson papers folder
 * in Google Drive to the local database, and updates metadata for the files.
 * 
 * Usage:
 *   ts-node tmp/sync-clawson-folder.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be synced/updated without making changes
 *   --limit <n>        Limit to updating n records (default: 100)
 *   --max-depth <n>    Maximum folder depth to traverse (default: 5)
 *   --verbose          Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

// Load multiple environment files
function loadEnvFiles() {
  // Order matters - later files override earlier ones
  const envFiles = [
    '.env',
    '.env.development',
    '.env.local'
  ];
  
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

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const updatePathsOnly = args.includes('--update-paths-only');

// Parse limit
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 100;

// Parse max depth
const maxDepthIndex = args.indexOf('--max-depth');
const maxDepth = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
  ? parseInt(args[maxDepthIndex + 1], 10) 
  : 5;

// Folder ID for DR Clawson papers
const CLAWSON_FOLDER_ID = '1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2';
const CLAWSON_FOLDER_DB_ID = '7877d780-6ae3-4b59-a21d-c5a202b2dd8e';

// Ensure Supabase credentials are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Access token is required for this script
const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;

// Debug loaded environment variables
console.log('Loaded environment variables:');
console.log('- SUPABASE_URL:', supabaseUrl);
console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Found' : 'Not found');
console.log('- GOOGLE_ACCESS_TOKEN:', accessToken ? 'Found' : 'Not found');

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

/**
 * Initialize Google Drive client using OAuth token
 */
async function initDriveClient() {
  try {
    console.log('🔑 Using OAuth access token');
    
    // Create OAuth client with the access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken
    });
    
    // Initialize the Drive client
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('❌ Error initializing Drive client with access token:', error);
    return null;
  }
}

/**
 * List files recursively
 */
async function listFilesRecursively(
  drive: any, 
  folderId: string, 
  maxDepth: number = 5,
  currentDepth: number = 0,
  parentPath: string = '/'
): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken = null;
  
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
      const enhancedFiles = files.map((file: any) => {
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
      const folders = files.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder');
      
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
 * Sync files from Google Drive to Supabase
 */
async function syncFiles(
  drive: any, 
  folderId: string, 
  folderDbId: string,
  isDryRun: boolean,
  maxDepth: number = 5
): Promise<{
  filesFound: number;
  filesInserted: number;
  filesUpdated: number;
  filesSkipped: number;
  errors: string[];
  filesByType: Record<string, number>;
}> {
  const result = {
    filesFound: 0,
    filesInserted: 0,
    filesUpdated: 0,
    filesSkipped: 0,
    errors: [] as string[],
    filesByType: {} as Record<string, number>
  };
  
  try {
    // Get folder details
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,webViewLink,modifiedTime'
    });
    
    console.log(`Syncing folder: ${folder.data.name} (${folderId})`);
    
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
    
    // Get existing files to avoid duplicates
    const { data: existingRecords, error: queryError } = await supabase
      .from('sources_google')
      .select('drive_id')
      .eq('deleted', false);
      
    if (queryError) {
      console.error('Error fetching existing records:', queryError);
      result.errors.push(`Error fetching existing records: ${queryError.message}`);
      return result;
    }
    
    // Create a Set of existing drive IDs for faster lookups
    const existingDriveIds = new Set(
      (existingRecords || []).map(record => record.drive_id)
    );
    
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
      const filesToInsert = newFilesInBatch.map(file => ({
        drive_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        path: file.path,
        parent_path: file.parentPath,
        parent_folder_id: file.parentFolderId,
        content_extracted: false,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        web_view_link: file.webViewLink,
        modified_time: file.modifiedTime,
        size: file.size ? parseInt(file.size, 10) : null,
        thumbnail_link: file.thumbnailLink,
        // Add metadata
        metadata: {
          size: file.size,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          thumbnailLink: file.thumbnailLink,
          mimeType: file.mimeType
        }
      }));
      
      // Insert the files into the database
      try {
        const { error } = await supabase
          .from('sources_google')
          .insert(filesToInsert);
        
        if (error) {
          console.error(`Error inserting batch ${i + 1}:`, error);
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
): Promise<{
  records: number;
  updated: number;
  skipped: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}> {
  const startTime = new Date();
  const result = {
    records: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    startTime,
    endTime: startTime
  };

  try {
    // Fetch records from Supabase
    if (verbose) console.log(`Fetching records from Supabase (limit: ${limit})...`);
    
    const { data: records, error } = await supabase
      .from('sources_google')
      .select('*')
      .or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`)
      .eq('deleted', false)
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
          ['modifiedTime', 'size', 'thumbnailLink', 'webViewLink', 'mimeType'].forEach(field => {
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
            updateData.modified_time = fileData.modifiedTime;
          }
          
          if (fileData.webViewLink !== undefined) {
            updateData.web_view_link = fileData.webViewLink;
          }
          
          // Update record in Supabase
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('sources_google')
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
async function syncClawsonFolder(): Promise<void> {
  console.log('=== DR Clawson Papers Folder Sync and Update ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Records limit for update: ${limit}`);
  console.log(`Max folder depth: ${maxDepth}`);
  console.log(`Verbose logging: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log('=========================================================');

  try {
    // Initialize Google Drive client
    const drive = await initDriveClient();
    if (!drive) {
      console.error('❌ Failed to initialize Google Drive client');
      process.exit(1);
    }
    
    // First check if folder exists
    console.log(`Checking folder: ${CLAWSON_FOLDER_ID}`);
    
    try {
      const folder = await drive.files.get({
        fileId: CLAWSON_FOLDER_ID,
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
    const syncResult = await syncFiles(drive, CLAWSON_FOLDER_ID, CLAWSON_FOLDER_DB_ID, isDryRun, maxDepth);
    
    console.log('\n=== Sync Summary ===');
    console.log(`Files found: ${syncResult.filesFound}`);
    console.log(`Files inserted: ${syncResult.filesInserted}`);
    console.log(`Files updated: ${syncResult.filesUpdated}`);
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
    const updateResult = await updateMetadata(drive, CLAWSON_FOLDER_ID, limit, isDryRun, isVerbose);

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
syncClawsonFolder().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});