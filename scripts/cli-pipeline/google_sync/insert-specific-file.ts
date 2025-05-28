#!/usr/bin/env ts-node
/**
 * Insert a specific file from Google Drive into sources_google
 * 
 * This script inserts a specific file from Google Drive into the sources_google table.
 * It's useful for testing or inserting specific files that other sync tools might miss.
 * 
 * Usage:
 *   ts-node insert-specific-file.ts [options]
 * 
 * Options:
 *   --file-id <id>        The Google Drive file ID to insert (required)
 *   --parent-id <id>      The parent folder ID (defaults to DYNAMIC_HEALING_FOLDER_ID)
 *   --dry-run             Show what would be inserted without making changes
 *   --verbose             Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Parse file ID
const fileIdIndex = args.indexOf('--file-id');
const fileId = fileIdIndex !== -1 && args[fileIdIndex + 1] 
  ? args[fileIdIndex + 1] 
  : null;

// Parse parent ID
const parentIdIndex = args.indexOf('--parent-id');
const parentId = parentIdIndex !== -1 && args[parentIdIndex + 1] 
  ? args[parentIdIndex + 1] 
  : '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'; // Default to Dynamic Healing Discussion Group

// Constants
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

/**
 * Get file details from Google Drive
 */
async function getFileDetails(driveService: any, fileId: string) {
  try {
    const fileData = await driveService.getFile(
      fileId,
      'id,name,mimeType,parents,modifiedTime,size,thumbnailLink,webViewLink'
    );
    
    return { success: true, data: fileData };
  } catch (error: any) {
    console.error(`Error getting file details: ${error.message || error}`);
    return { success: false, error: error.message || error };
  }
}

/**
 * Get parent folder path
 */
async function getParentPath(driveService: any, folderId: string): Promise<string> {
  try {
    // Get folder details
    const folderData = await driveService.getFile(
      folderId,
      'id,name,parents'
    );
    
    const folderName = folderData.name;
    
    // If this is the root folder, return its name with a slash
    if (folderId === DYNAMIC_HEALING_FOLDER_ID) {
      return `/${folderName}/`;
    }
    
    // Otherwise, get the parent path and append this folder's name
    const parentId = folderData.parents?.[0];
    if (!parentId) {
      return `/${folderName}/`;
    }
    
    const parentPath = await getParentPath(driveService, parentId);
    return `${parentPath}${folderName}/`;
  } catch (error) {
    console.error(`Error getting parent path: ${error}`);
    return '/';
  }
}

/**
 * Check if file already exists in sources_google
 */
async function checkFileExists(fileId: string) {
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
}

/**
 * Insert file into sources_google
 */
async function insertFile(driveService: any, fileId: string, parentId: string) {
  console.log(`=== Inserting file ${fileId} ===`);
  
  try {
    // First check if file already exists
    const existsCheck = await checkFileExists(fileId);
    if (existsCheck.exists && existsCheck.data) {
      console.log(`❌ File already exists in the database: ${existsCheck.data.name} (ID: ${existsCheck.data.id})`);
      return { success: false, message: 'File already exists' };
    } else if (existsCheck.exists) {
      console.log(`❌ File already exists in the database, but details are not available`);
      return { success: false, message: 'File already exists' };
    }
    
    // Get file details from Google Drive
    const fileDetails = await getFileDetails(driveService, fileId);
    if (!fileDetails.success) {
      console.error(`❌ Failed to get file details: ${fileDetails.error}`);
      return { success: false, message: fileDetails.error };
    }
    
    const file = fileDetails.data;
    console.log(`✅ Found file in Google Drive: ${file.name} (${file.mimeType})`);
    
    // Verify parent folder exists
    let parentPath = '/';
    try {
      parentPath = await getParentPath(driveService, parentId);
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
    
    // Calculate correct path_depth based on file location
    // A file at the root folder level has path_depth = 0
    const isInRootFolder = parentId === DYNAMIC_HEALING_FOLDER_ID;
    // For files in the root folder, depth should be 0
    const path_depth = 0;
    
    if (isVerbose) {
      console.log(`Path depth calculation:`);
      console.log(`- Is in root folder: ${isInRootFolder}`);
      console.log(`- Path: ${filePath}`);
      console.log(`- Setting path_depth to 0 as per requirements`);
    }
    
    // Create insertion data
    const now = new Date().toISOString();
    const recordId = uuidv4(); // Generate a UUID for the record
    
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
      metadata: {
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        thumbnailLink: file.thumbnailLink,
        mimeType: file.mimeType
      }
    };
    
    // Log the insert data in verbose mode
    if (isVerbose) {
      console.log('\nInsertion data:');
      console.log(JSON.stringify(insertData, null, 2));
    }
    
    if (isDryRun) {
      console.log(`DRY RUN: Would insert file ${file.name} (${file.id})`);
      return { success: true, dryRun: true };
    }
    
    // Insert the file
    const { data, error } = await supabase
      .from('google_sources')
      .insert(insertData);
      
    if (error) {
      console.error(`❌ Error inserting file: ${error.message}`);
      console.error('Detailed error:', JSON.stringify(error, null, 2));
      return { success: false, message: error.message };
    }
    
    console.log(`✅ Successfully inserted file ${file.name} (${file.id})`);
    return { success: true, data };
  } catch (error: any) {
    console.error(`❌ Unexpected error: ${error.message || error}`);
    return { success: false, message: error.message || error };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Insert Specific File Tool ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL INSERT'}`);
  console.log(`Verbose logging: ${isVerbose ? 'ON' : 'OFF'}`);
  
  // Check required parameters
  if (!fileId) {
    console.error('❌ Missing required parameter: --file-id');
    console.log('Usage: insert-specific-file.ts --file-id <id> [--parent-id <id>] [--dry-run] [--verbose]');
    process.exit(1);
  }
  
  console.log(`File ID to insert: ${fileId}`);
  console.log(`Parent folder ID: ${parentId}`);
  console.log('=========================================================');
  
  try {
    // Initialize Google Drive service using the singleton pattern
    const driveService = getGoogleDriveService(supabase);
    
    // Insert the file
    const result = await insertFile(driveService, fileId, parentId);
    
    console.log('\n=== Insert Results ===');
    console.log(`Success: ${result.success}`);
    if (result.dryRun) {
      console.log('This was a dry run. No changes were made.');
    }
    console.log('=============================');
  } catch (error: any) {
    console.error('Unexpected error:', error.message || error);
    process.exit(1);
  }
}

// Run the main function
main();