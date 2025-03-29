#!/usr/bin/env ts-node
/**
 * General Folder Dry-Run Script
 * 
 * This script performs a dry-run on any folder in the database,
 * showing what files would be synced without making any changes.
 * 
 * Usage:
 *   npx ts-node tmp/general-folder-dry-run.ts <folder_id_or_drive_id> [--recursive]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { google } from 'googleapis';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Process command line arguments
const args = process.argv.slice(2);
const folderId = args[0]; // Can be either DB ID or Drive ID
const isRecursive = args.includes('--recursive');

if (!folderId) {
  console.error('❌ Folder ID is required');
  console.log('Usage: npx ts-node tmp/general-folder-dry-run.ts <folder_id_or_drive_id> [--recursive]');
  process.exit(1);
}

type FileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  size?: string | number;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  [key: string]: any;
};

async function main() {
  try {
    // Ensure Supabase credentials are available
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase URL or key not found in environment variables');
      process.exit(1);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, check if the ID is a database ID
    const { data: folder, error: folderError } = await supabase
      .from('sources_google')
      .select('id, drive_id, name, path')
      .eq(folderId.length === 36 ? 'id' : 'drive_id', folderId)
      .limit(1)
      .single();
      
    if (folderError) {
      console.error(`❌ Error looking up folder: ${folderError.message}`);
      
      if (folderError.code === 'PGRST116') {
        console.log('Folder not found in database, proceeding as a Google Drive ID');
      } else {
        process.exit(1);
      }
    }
    
    let driveId = folderId;
    if (folder) {
      driveId = folder.drive_id;
      console.log(`Found folder in database: "${folder.name}" (${folder.path})`);
      console.log(`Using Drive ID: ${driveId}`);
    }
    
    // Initialize Drive client with service account
    const drive = await initDriveClient();
    
    if (!drive) {
      console.error('❌ Failed to initialize Drive client');
      process.exit(1);
    }
    
    console.log(`🔍 Starting dry run for folder with ID: ${driveId}`);
    console.log(`Recursive mode: ${isRecursive ? 'enabled' : 'disabled'}`);
    
    // Collect all files and folders
    const allFiles: FileMetadata[] = [];
    
    // Start with the root folder
    try {
      console.log(`Getting folder details...`);
      const folderData = await drive.files.get({
        fileId: driveId,
        fields: 'id,name,mimeType',
      });
      
      if (folderData.data.mimeType !== 'application/vnd.google-apps.folder') {
        console.error(`❌ The provided ID is not a folder: ${folderData.data.mimeType}`);
        process.exit(1);
      }
      
      console.log(`\nFolder name: "${folderData.data.name}"\n`);
      
      // Search for all files in the folder
      console.log('Searching for files...');
      
      const files = await listFilesInFolder(drive, driveId, isRecursive);
      allFiles.push(...files);
      
      console.log(`\n✅ Found ${allFiles.length} total files and folders\n`);
      
      // Show file types breakdown
      const fileTypes: Record<string, number> = {};
      allFiles.forEach(file => {
        const type = file.mimeType || 'unknown';
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      });
      
      console.log('=== File Type Breakdown ===');
      Object.entries(fileTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          // Format to make mime types more readable
          const formattedType = type
            .replace('application/vnd.google-apps.', '')
            .replace('application/', '')
            .replace('video/', 'video: ')
            .replace('audio/', 'audio: ')
            .replace('image/', 'image: ');
            
          console.log(`${formattedType}: ${count} files`);
        });
      
      console.log('\n=== Sample Files ===');
      // Show sample files (non-folders) of each type
      const filesByType: Record<string, FileMetadata[]> = {};
      allFiles.forEach(file => {
        if (file.mimeType !== 'application/vnd.google-apps.folder') {
          const type = file.mimeType || 'unknown';
          if (!filesByType[type]) {
            filesByType[type] = [];
          }
          filesByType[type].push(file);
        }
      });
      
      Object.entries(filesByType).forEach(([type, files]) => {
        const formattedType = type
          .replace('application/vnd.google-apps.', '')
          .replace('application/', '')
          .replace('video/', 'video: ')
          .replace('audio/', 'audio: ')
          .replace('image/', 'image: ');
          
        console.log(`\n${formattedType}:`);
        files.slice(0, 3).forEach((file, i) => {
          console.log(`  ${i+1}. ${file.name}`);
        });
        
        if (files.length > 3) {
          console.log(`  ... and ${files.length - 3} more`);
        }
      });
      
      console.log('\n=== Folder Structure ===');
      // Count the depth levels
      const folders = allFiles.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      const folderDepths: Record<number, number> = {};
      let maxDepth = 0;
      
      // Calculate depth for each folder
      folders.forEach(folder => {
        // Count the number of folders in the path
        const folderChain = getFolderChain(allFiles, folder);
        const depth = folderChain.length;
        folderDepths[depth] = (folderDepths[depth] || 0) + 1;
        if (depth > maxDepth) maxDepth = depth;
      });
      
      console.log('Folder depth distribution:');
      for (let depth = 0; depth <= maxDepth; depth++) {
        console.log(`  Depth ${depth}: ${folderDepths[depth] || 0} folders`);
      }
      
      console.log(`\n🏁 Dry run completed. No changes were made to the database.`);
      console.log(`To perform an actual sync, use the sync command.`);
      
    } catch (error: any) {
      console.error('❌ Error during dry run:', error.message);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Get the chain of parent folders for a file
 */
function getFolderChain(allFiles: FileMetadata[], file: FileMetadata): FileMetadata[] {
  const chain: FileMetadata[] = [file];
  let currentFile = file;
  
  // Maximum depth to prevent infinite loops
  const MAX_DEPTH = 20;
  let depth = 0;
  
  while (currentFile.parents && currentFile.parents.length > 0 && depth < MAX_DEPTH) {
    const parentId = currentFile.parents[0];
    const parent = allFiles.find(f => f.id === parentId);
    
    if (!parent) break;
    
    chain.push(parent);
    currentFile = parent;
    depth++;
  }
  
  return chain.reverse();
}

/**
 * List all files in a folder recursively
 */
async function listFilesInFolder(drive: any, folderId: string, recursive: boolean, pageToken?: string, allFiles: FileMetadata[] = []): Promise<FileMetadata[]> {
  try {
    // Build the query to find files in the specified folder
    let query = `'${folderId}' in parents and trashed = false`;
    
    // Get all files in the folder
    const response = await drive.files.list({
      q: query,
      pageSize: 1000,
      pageToken: pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, webViewLink)',
    });
    
    const files = response.data.files || [];
    allFiles.push(...files);
    
    console.log(`Found ${files.length} files/folders in the current batch`);
    
    // If there are more pages, get them
    if (response.data.nextPageToken) {
      return listFilesInFolder(drive, folderId, recursive, response.data.nextPageToken, allFiles);
    }
    
    // If recursive, get files from subfolders
    if (recursive) {
      const folders = files.filter((file: FileMetadata) => file.mimeType === 'application/vnd.google-apps.folder');
      
      for (const folder of folders) {
        console.log(`Looking in subfolder: ${folder.name}`);
        await listFilesInFolder(drive, folder.id, recursive, undefined, allFiles);
      }
    }
    
    return allFiles;
  } catch (error: any) {
    console.error(`Error listing files in folder ${folderId}:`, error.message);
    return allFiles;
  }
}

/**
 * Initialize Google Drive client using service account
 */
async function initDriveClient() {
  try {
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                      path.resolve(__dirname, '../.service-account.json');
    
    // Check if file exists
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      console.log('\nPlease make sure the GOOGLE_APPLICATION_CREDENTIALS environment variable is set correctly');
      return null;
    }
    
    // Read and parse the service account key file
    const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    // Create JWT auth client with the service account
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    // Initialize the Drive client
    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    console.error('❌ Error initializing Drive client:', error.message);
    return null;
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});