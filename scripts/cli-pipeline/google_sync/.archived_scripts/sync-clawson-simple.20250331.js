/**
 * Simple Clawson Folder Sync
 * 
 * This script syncs the DR Clawson papers folder to the database
 * using a simpler approach with fewer dependencies
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Folder information
const FOLDER_ID = '1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2';
const FOLDER_NAME = 'DR Clawson papers';
const FOLDER_DB_ID = '7877d780-6ae3-4b59-a21d-c5a202b2dd8e';
const ROOT_PATH = '/DR Clawson papers';

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Google OAuth token
const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;

/**
 * Initialize Google Drive client
 */
function initDriveClient() {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: accessToken
  });
  
  return google.drive({ version: 'v3', auth });
}

/**
 * List files in a folder and its subfolders
 */
async function listFilesRecursively(drive, folderId, parentPath = ROOT_PATH, results = []) {
  try {
    if (isVerbose) console.log(`Listing files in folder: ${folderId}, path: ${parentPath}`);
    
    let pageToken = null;
    
    do {
      // Get all files in the current folder
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, size, thumbnailLink, webViewLink)',
        pageToken: pageToken
      });
      
      const files = response.data.files || [];
      pageToken = response.data.nextPageToken;
      
      if (isVerbose) console.log(`Found ${files.length} files/folders in folder: ${folderId}`);
      
      // Process each file
      for (const file of files) {
        const filePath = `${parentPath}/${file.name}`;
        
        // Add to results
        results.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          path: filePath,
          parentPath: parentPath,
          parentFolderId: folderId,
          modifiedTime: file.modifiedTime,
          size: file.size,
          thumbnailLink: file.thumbnailLink,
          webViewLink: file.webViewLink
        });
        
        // If this is a folder, list its files recursively
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          await listFilesRecursively(drive, file.id, filePath, results);
        }
      }
    } while (pageToken);
    
    return results;
  } catch (error) {
    console.error(`Error listing files in folder ${folderId}:`, error.message || error);
    return results;
  }
}

/**
 * Sync files to database
 */
async function syncFiles(files, isDryRun) {
  if (isDryRun) {
    console.log(`DRY RUN: Would sync ${files.length} files to database`);
    return { inserted: 0, updated: 0, skipped: 0, errors: [] };
  }
  
  const result = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };
  
  try {
    // For debugging, print the exact SQL that would be executed
    console.log('Checking for existing records in sources_google...');
    
    // Get existing files to avoid duplicates
    const { data: existingRecords, error: queryError } = await supabase
      .from('google_sources')
      .select('drive_id, name')
      .eq('deleted', false);
      
    if (queryError) {
      throw queryError;
    }
    
    console.log(`Found ${existingRecords ? existingRecords.length : 0} existing records in sources_google`);
    
    // Create a Set of existing drive IDs for faster lookups
    const existingDriveIds = new Set();
    if (existingRecords) {
      existingRecords.forEach(record => {
        existingDriveIds.add(record.drive_id);
        if (isVerbose) console.log(`  - ${record.drive_id} (${record.name})`);
      });
    }
    
    console.log(`Existing drive IDs set has ${existingDriveIds.size} items`);
    
    // Process files in batches
    const batchSize = 25;
    const batches = Math.ceil(files.length / batchSize);
    
    console.log(`Processing ${files.length} files in ${batches} batches of ${batchSize}`);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, files.length);
      const batch = files.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${batches} (${batch.length} files)`);
      
      // Split into new and existing files
      const newFilesInBatch = batch.filter(file => !existingDriveIds.has(file.id));
      const existingFilesInBatch = batch.filter(file => existingDriveIds.has(file.id));
      
      console.log(`Batch ${i + 1}: Found ${newFilesInBatch.length} new files, ${existingFilesInBatch.length} existing files`);
      
      // Print the first few new files for debugging
      if (newFilesInBatch.length > 0) {
        console.log('Sample of new files:');
        newFilesInBatch.slice(0, 3).forEach((file, idx) => {
          console.log(`  ${idx + 1}. ${file.name} (${file.id})`);
        });
        if (newFilesInBatch.length > 3) {
          console.log(`  ... and ${newFilesInBatch.length - 3} more`);
        }
      }
      
      result.skipped += existingFilesInBatch.length;
      
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
        is_root: false,
        content_extracted: false,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        web_view_link: file.webViewLink,
        modified_time: file.modifiedTime,
        size: file.size ? parseInt(file.size, 10) : null,
        thumbnail_link: file.thumbnailLink,
        metadata: {
          size: file.size,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          thumbnailLink: file.thumbnailLink,
          mimeType: file.mimeType
        }
      }));
      
      try {
        const { error } = await supabase
          .from('google_sources')
          .insert(filesToInsert);
        
        if (error) {
          console.error(`Error inserting batch ${i + 1}:`, error);
          result.errors.push(`Error inserting batch ${i + 1}: ${error.message}`);
          result.skipped += newFilesInBatch.length;
        } else {
          result.inserted += newFilesInBatch.length;
          console.log(`Successfully inserted ${newFilesInBatch.length} new files in batch ${i + 1}`);
        }
      } catch (error) {
        console.error(`Error inserting batch ${i + 1}:`, error);
        result.errors.push(`Error inserting batch ${i + 1}: ${error.message || error}`);
        result.skipped += newFilesInBatch.length;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error syncing files:', error);
    result.errors.push(`Error syncing files: ${error.message || error}`);
    return result;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== DR Clawson Papers Simple Sync ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log('======================================');
  
  try {
    // Initialize Drive client
    const drive = initDriveClient();
    console.log('Drive client initialized');
    
    // Get folder details
    try {
      const folder = await drive.files.get({
        fileId: FOLDER_ID,
        fields: 'id,name,mimeType'
      });
      
      console.log(`Folder exists: "${folder.data.name}"`);
      
      if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`The provided ID is not a folder: ${folder.data.mimeType}`);
      }
    } catch (error) {
      console.error(`Error getting folder details: ${error.message || error}`);
      return;
    }
    
    // List all files recursively
    console.log('Listing files recursively...');
    const allFiles = await listFilesRecursively(drive, FOLDER_ID);
    
    console.log(`Found ${allFiles.length} total files and folders`);
    
    // Organize files by type
    const fileTypes = {};
    allFiles.forEach(file => {
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    
    console.log('\nFile types:');
    Object.entries(fileTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`- ${type}: ${count} files`);
      });
    
    // Sync files to database
    console.log('\nSyncing files to database...');
    const syncResult = await syncFiles(allFiles, isDryRun);
    
    console.log('\n=== Sync Summary ===');
    console.log(`Files found: ${allFiles.length}`);
    console.log(`Files inserted: ${syncResult.inserted}`);
    console.log(`Files updated: ${syncResult.updated}`);
    console.log(`Files skipped: ${syncResult.skipped}`);
    console.log(`Errors: ${syncResult.errors.length}`);
    
    console.log('\nSync complete!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the main function
main()
  .catch(error => console.error('Script error:', error))
  .finally(() => setTimeout(() => process.exit(0), 2000)); // Exit after 2 seconds