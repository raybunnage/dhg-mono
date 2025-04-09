#!/usr/bin/env node

/**
 * Enhanced Recursive Google Drive Sync Script
 * 
 * This script recursively synchronizes the "Dynamic Healing Discussion Group" 
 * Google Drive folder to the database with improved path handling and recursive traversal.
 * 
 * Features:
 * - Recursive folder traversal with configurable depth (default: 4)
 * - Proper path and root folder handling using Google Service Account
 * - Support for large folders with pagination
 * - Detailed progress reporting
 * 
 * Usage:
 *   node enhanced-recursive-sync.js [options]
 * 
 * Options:
 *   --dry-run            Show what would be synced without making changes
 *   --max-depth <n>      Maximum depth to traverse (default: 4)
 *   --folder-id <id>     Folder ID to sync (default: Dynamic Healing Discussion Group)
 *   --verbose            Show detailed logging
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
const SUPABASE_KEY = '***REMOVED***';

// Default folder ID for Dynamic Healing Discussion Group
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Get service account key file path from environment or use default
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                     process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                     path.resolve(__dirname, '../../../.service-account.json');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const maxDepthIndex = args.indexOf('--max-depth');
const folderIdIndex = args.indexOf('--folder-id');

// Get max depth from command line or use default
const MAX_DEPTH = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
  ? parseInt(args[maxDepthIndex + 1], 10) 
  : 4;

// Get folder ID from command line or use default
const TARGET_FOLDER_ID = folderIdIndex !== -1 && args[folderIdIndex + 1]
  ? args[folderIdIndex + 1]
  : DYNAMIC_HEALING_FOLDER_ID;

// Log debug messages if verbose mode is enabled
function logDebug(message) {
  if (isVerbose) {
    console.log(`[DEBUG] ${message}`);
  }
}

// Create progress bar
function createProgressBar(total) {
  const width = 40;
  let current = 0;
  
  return {
    update(progress) {
      current = progress;
      const percent = Math.floor((current / total) * 100);
      const filled = Math.floor((width * current) / total);
      const empty = width - filled;
      
      process.stdout.write(`\r[${filled ? '='.repeat(filled) : ''}${empty ? ' '.repeat(empty) : ''}] ${percent}% (${current}/${total})`);
      
      if (current >= total) {
        process.stdout.write('\n');
      }
    }
  };
}

/**
 * Initialize Google Drive client using service account
 */
async function initDriveClient() {
  try {
    console.log(`🔑 Using service account key file: ${SERVICE_ACCOUNT_KEY_PATH}`);
    
    // Check if file exists
    if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
      throw new Error(`Service account key file not found: ${SERVICE_ACCOUNT_KEY_PATH}`);
    }
    
    // Read and parse the service account key file
    const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
    
    // Create JWT auth client with the service account
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    // Initialize the Drive client
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error(`❌ Error initializing Drive client: ${error.message}`);
    return null;
  }
}

/**
 * Check if a folder exists in Google Drive
 */
async function checkFolder(drive, folderId) {
  try {
    // Get folder details from Drive API
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType'
    });
    
    const file = response.data;
    
    if (file.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error(`The provided ID is not a folder: ${file.mimeType}`);
    }
    
    return {
      valid: true,
      name: file.name,
      id: file.id
    };
  } catch (error) {
    console.error(`Error checking folder: ${error?.message || 'Unknown error'}`);
    return { valid: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * List files in a folder with pagination support
 */
async function listFilesInFolder(drive, folderId, pageToken = null) {
  try {
    // Construct query to get files in the specified folder
    const query = `'${folderId}' in parents and trashed=false`;
    
    // Define fields to retrieve
    const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, webViewLink, thumbnailLink)';
    
    // Make request to Drive API
    const response = await drive.files.list({
      q: query,
      pageToken: pageToken,
      pageSize: 1000,
      fields: fields
    });
    
    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken
    };
  } catch (error) {
    console.error(`Error listing files: ${error?.message || 'Unknown error'}`);
    return { files: [], nextPageToken: null };
  }
}

/**
 * Recursively list all files in a folder and its subfolders up to maxDepth
 */
async function listFilesRecursively(drive, folderId, folderName, currentDepth = 0, parentPath = '') {
  // Initialize array to hold all files
  let allFiles = [];
  
  // Construct the path for this folder
  const folderPath = parentPath ? `${parentPath}/${folderName}` : `/${folderName}`;
  
  logDebug(`Traversing folder "${folderName}" at depth ${currentDepth}, path: ${folderPath}`);
  
  // Stop recursion if we've reached max depth
  if (currentDepth > MAX_DEPTH) {
    logDebug(`Reached max depth (${MAX_DEPTH}) at folder "${folderName}"`);
    return [];
  }
  
  let pageToken = null;
  let totalFiles = 0;
  
  // Process all pages of results
  do {
    // Get a page of files from this folder
    const { files, nextPageToken } = await listFilesInFolder(drive, folderId, pageToken);
    pageToken = nextPageToken;
    
    if (files.length === 0) {
      break;
    }
    
    totalFiles += files.length;
    console.log(`Found ${files.length} items in "${folderName}"${pageToken ? ' (more pages available)' : ''}`);
    
    // Process each file in this page
    for (const file of files) {
      // Add path information to the file object
      const enhancedFile = {
        ...file,
        path: `${folderPath}/${file.name}`,
        parentPath: folderPath,
        parentFolderId: folderId,
        rootDriveId: TARGET_FOLDER_ID,
        depth: currentDepth,
        pathArray: `${folderPath}/${file.name}`.split('/').filter(Boolean)
      };
      
      // Add file to our collection
      allFiles.push(enhancedFile);
      
      // If this is a folder and we haven't reached max depth, process it recursively
      if (file.mimeType === 'application/vnd.google-apps.folder' && currentDepth < MAX_DEPTH) {
        const subfolderFiles = await listFilesRecursively(
          drive,
          file.id,
          file.name,
          currentDepth + 1,
          folderPath
        );
        
        // Add subfolder files to our collection
        allFiles = [...allFiles, ...subfolderFiles];
      }
    }
  } while (pageToken);
  
  return allFiles;
}

/**
 * Insert files into the database while preserving existing records
 */
async function insertFiles(files, folderInfo, dryRun = false) {
  if (dryRun) {
    console.log(`DRY RUN: Would insert ${files.length} files into the database`);
    return { success: files.length, errors: 0 };
  }
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Get existing files including their IDs to preserve relationships
  console.log('Checking for existing files in database...');
  const { data: existingFiles, error: queryError } = await supabase
    .from('sources_google')
    .select('id, drive_id, name, path, parent_folder_id, root_drive_id');
  
  if (queryError) {
    console.error(`Error fetching existing files: ${queryError.message}`);
    return { success: 0, errors: files.length };
  }
  
  // Create a map of drive_id to existing record for easy lookup
  const existingFileMap = {};
  for (const file of existingFiles || []) {
    existingFileMap[file.drive_id] = file;
  }
  
  console.log(`Found ${Object.keys(existingFileMap).length} existing files in database`);
  
  // Separate files into new ones and ones to update
  const newFiles = [];
  const filesToUpdate = [];
  
  for (const file of files) {
    if (existingFileMap[file.id]) {
      // This file exists, might need an update
      const existingFile = existingFileMap[file.id];
      
      // Check if paths, parent_folder_id, or root_drive_id need updating
      const needsUpdate = 
        existingFile.path !== file.path ||
        existingFile.parent_folder_id !== file.parentFolderId ||
        existingFile.root_drive_id !== TARGET_FOLDER_ID;
      
      if (needsUpdate) {
        filesToUpdate.push({
          file,
          existingId: existingFile.id
        });
      }
    } else {
      // This is a new file
      newFiles.push(file);
    }
  }
  
  console.log(`Will insert ${newFiles.length} new files and update ${filesToUpdate.length} existing files`);
  console.log(`${files.length - newFiles.length - filesToUpdate.length} files already up-to-date`);
  
  // Process updates first to preserve existing IDs
  let updatedCount = 0;
  let updateErrors = 0;
  
  if (filesToUpdate.length > 0) {
    console.log('\nUpdating existing files...');
    const updateBatchSize = 50;
    const updateBatches = Math.ceil(filesToUpdate.length / updateBatchSize);
    
    const updateProgressBar = createProgressBar(filesToUpdate.length);
    let updateProcessed = 0;
    
    for (let i = 0; i < updateBatches; i++) {
      const start = i * updateBatchSize;
      const end = Math.min(start + updateBatchSize, filesToUpdate.length);
      const batch = filesToUpdate.slice(start, end);
      
      console.log(`\nProcessing update batch ${i + 1}/${updateBatches} (${batch.length} files)`);
      
      // Process each update separately to preserve IDs
      for (const item of batch) {
        const { file, existingId } = item;
        
        const { error } = await supabase
          .from('sources_google')
          .update({
            name: file.name,
            mime_type: file.mimeType,
            path: file.path,
            parent_path: file.parentPath,
            parent_folder_id: file.parentFolderId,
            root_drive_id: TARGET_FOLDER_ID,
            is_root: file.id === TARGET_FOLDER_ID,
            size: file.size,
            modified_time: file.modifiedTime,
            web_view_link: file.webViewLink,
            thumbnail_link: file.thumbnailLink,
            updated_at: new Date().toISOString(),
            path_depth: file.pathArray.length,
            metadata: {
              depth: file.depth,
              sync_timestamp: new Date().toISOString()
            }
          })
          .eq('id', existingId);
        
        if (error) {
          console.error(`Error updating file ID ${existingId}: ${error.message}`);
          updateErrors++;
        } else {
          updatedCount++;
        }
      }
      
      updateProcessed += batch.length;
      updateProgressBar.update(updateProcessed);
    }
    
    console.log(`\nCompleted updates: ${updatedCount} successful, ${updateErrors} errors`);
  }
  
  // Now process insertions for new files
  let insertedCount = 0;
  let insertErrors = 0;
  
  if (newFiles.length > 0) {
    console.log('\nInserting new files...');
    const insertBatchSize = 50;
    const insertBatches = Math.ceil(newFiles.length / insertBatchSize);
    
    const insertProgressBar = createProgressBar(newFiles.length);
    let insertProcessed = 0;
    
    for (let i = 0; i < insertBatches; i++) {
      const start = i * insertBatchSize;
      const end = Math.min(start + insertBatchSize, newFiles.length);
      const batch = newFiles.slice(start, end);
      
      console.log(`\nProcessing insert batch ${i + 1}/${insertBatches} (${batch.length} files)`);
      
      // Prepare records for insertion
      const records = batch.map(file => ({
        drive_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        path: file.path,
        parent_path: file.parentPath,
        parent_folder_id: file.parentFolderId,
        root_drive_id: TARGET_FOLDER_ID,
        is_root: file.id === TARGET_FOLDER_ID,
        content_extracted: false,
        deleted: false,
        size: file.size,
        modified_time: file.modifiedTime,
        web_view_link: file.webViewLink,
        thumbnail_link: file.thumbnailLink,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        path_depth: file.pathArray.length,
        metadata: {
          depth: file.depth,
          sync_timestamp: new Date().toISOString()
        }
      }));
      
      // Insert the batch
      const { data, error } = await supabase
        .from('sources_google')
        .insert(records);
      
      if (error) {
        console.error(`Error inserting batch ${i + 1}: ${error.message}`);
        insertErrors += batch.length;
      } else {
        console.log(`Successfully inserted batch ${i + 1}`);
        insertedCount += batch.length;
      }
      
      insertProcessed += batch.length;
      insertProgressBar.update(insertProcessed);
    }
  }
  
  return { 
    success: insertedCount + updatedCount, 
    errors: insertErrors + updateErrors, 
    inserted: insertedCount,
    updated: updatedCount,
    skipped: files.length - newFiles.length - filesToUpdate.length
  };
}

/**
 * Ensure the target folder exists in the database as a root folder
 */
async function ensureRootFolder(folderId, folderName, dryRun = false) {
  if (dryRun) {
    console.log(`DRY RUN: Would ensure ${folderName} (${folderId}) is a root folder`);
    return { success: true };
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check if folder already exists
    const { data: existingFolder, error: queryError } = await supabase
      .from('sources_google')
      .select('id, is_root')
      .eq('drive_id', folderId)
      .eq('deleted', false)
      .maybeSingle();
    
    if (queryError) {
      throw new Error(`Error checking for existing folder: ${queryError.message}`);
    }
    
    // If folder exists, make sure it's a root folder
    if (existingFolder) {
      if (existingFolder.is_root) {
        console.log(`Folder ${folderName} is already a root folder`);
        return { success: true, id: existingFolder.id };
      }
      
      // Update to make it a root folder
      const { data, error } = await supabase
        .from('sources_google')
        .update({
          is_root: true,
          path: `/${folderName}`,
          parent_path: null,
          parent_folder_id: null,
          root_drive_id: folderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingFolder.id);
      
      if (error) {
        throw new Error(`Error updating root folder: ${error.message}`);
      }
      
      console.log(`Updated ${folderName} to be a root folder`);
      return { success: true, id: existingFolder.id };
    }
    
    // Insert new root folder
    const { data, error } = await supabase
      .from('sources_google')
      .insert({
        drive_id: folderId,
        name: folderName,
        mime_type: 'application/vnd.google-apps.folder',
        path: `/${folderName}`,
        parent_path: null,
        parent_folder_id: null,
        root_drive_id: folderId,
        is_root: true,
        deleted: false,
        content_extracted: false,
        path_depth: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          depth: 0,
          sync_timestamp: new Date().toISOString()
        }
      });
    
    if (error) {
      throw new Error(`Error inserting root folder: ${error.message}`);
    }
    
    console.log(`Created new root folder: ${folderName}`);
    return { success: true, id: data[0].id };
  } catch (error) {
    console.error(`Error ensuring root folder: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Enhanced Recursive Google Drive Sync ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Target Folder ID: ${TARGET_FOLDER_ID}`);
  console.log(`Max Depth: ${MAX_DEPTH}`);
  console.log(`Verbose Logging: ${isVerbose ? 'YES' : 'NO'}`);
  console.log('===========================================');
  
  try {
    // Step 1: Initialize the Google Drive client with service account
    console.log('\nStep 1: Initializing Google Drive client...');
    const drive = await initDriveClient();
    
    if (!drive) {
      console.error('Failed to initialize Google Drive client');
      process.exit(1);
    }
    
    console.log('✅ Google Drive client initialized successfully using service account');
    
    // Step 2: Check if the folder exists
    console.log('\nStep 2: Checking target folder...');
    const folderInfo = await checkFolder(drive, TARGET_FOLDER_ID);
    
    if (!folderInfo.valid) {
      console.error(`Error: Folder not found or not accessible`);
      process.exit(1);
    }
    
    console.log(`✅ Target folder found: "${folderInfo.name}" (${folderInfo.id})`);
    
    // Step 3: Ensure it's a root folder in our database
    console.log('\nStep 3: Ensuring folder is registered as root...');
    const rootResult = await ensureRootFolder(folderInfo.id, folderInfo.name, isDryRun);
    
    if (!rootResult.success) {
      console.error(`Error ensuring root folder: ${rootResult.error}`);
      process.exit(1);
    }
    
    console.log('✅ Folder is registered as a root folder in the database');
    
    // Step 4: Recursively list files in the folder
    console.log(`\nStep 4: Recursively listing files (max depth: ${MAX_DEPTH})...`);
    console.time('Recursive file listing');
    
    const startTime = Date.now();
    const files = await listFilesRecursively(drive, folderInfo.id, folderInfo.name);
    const endTime = Date.now();
    
    console.timeEnd('Recursive file listing');
    
    console.log(`\n✅ Found ${files.length} files in ${(endTime - startTime) / 1000} seconds`);
    
    // Group files by type and depth
    const fileTypes = {};
    const depthCounts = {};
    
    for (const file of files) {
      // Count by file type
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
      
      // Count by depth
      const depth = file.depth || 0;
      depthCounts[depth] = (depthCounts[depth] || 0) + 1;
    }
    
    // Display file type breakdown
    console.log('\nFile types:');
    Object.entries(fileTypes).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} files`);
    });
    
    // Display depth breakdown
    console.log('\nFiles by depth:');
    for (let i = 0; i <= MAX_DEPTH; i++) {
      console.log(`  - Depth ${i}: ${depthCounts[i] || 0} files`);
    }
    
    // Step 5: Insert files into the database
    console.log('\nStep 5: Inserting files into database...');
    console.time('Database insertion');
    
    const insertResult = await insertFiles(files, folderInfo, isDryRun);
    
    console.timeEnd('Database insertion');
    
    if (isDryRun) {
      console.log(`\n✅ Would insert ${files.length} files into the database (dry run)`);
    } else {
      console.log('\n✅ Database insertion complete:');
      console.log(`  - Successfully inserted: ${insertResult.inserted || 0}`);
      console.log(`  - Successfully updated: ${insertResult.updated || 0}`);
      console.log(`  - Errors: ${insertResult.errors}`);
      console.log(`  - Already up-to-date: ${insertResult.skipped}`);
      console.log(`  - Total processed: ${files.length}`);
    }
    
    console.log('\n=== Sync complete ===');
    
  } catch (error) {
    console.error(`Error during sync: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error(`Unhandled error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});