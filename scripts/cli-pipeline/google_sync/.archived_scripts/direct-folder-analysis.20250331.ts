#!/usr/bin/env ts-node
/**
 * Direct Folder Analysis with Access Token
 * 
 * This script performs a folder analysis using a personal access token
 * 
 * Usage:
 *   npx ts-node tmp/direct-folder-analysis.ts <folder_id_or_drive_id> [--recursive]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Process command line arguments
const args = process.argv.slice(2);
const folderId = args[0]; // Can be either DB ID or Drive ID
const isRecursive = args.includes('--recursive');

if (!folderId) {
  console.error('❌ Folder ID is required');
  console.log('Usage: npx ts-node tmp/direct-folder-analysis.ts <folder_id_or_drive_id> [--recursive]');
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
      .from('google_sources')
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
    
    // Get the access token from environment variables
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('❌ No Google access token found in environment variables');
      console.log('Please make sure VITE_GOOGLE_ACCESS_TOKEN is set in .env.development');
      process.exit(1);
    }
    
    console.log(`🔍 Starting direct analysis for folder with ID: ${driveId}`);
    console.log(`Recursive mode: ${isRecursive ? 'enabled' : 'disabled'}`);
    
    // Collect all files and folders
    const allFiles: FileMetadata[] = [];
    
    // Start with the root folder
    try {
      console.log(`Getting folder details...`);
      const folderResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveId}?fields=id,name,mimeType`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (!folderResponse.ok) {
        throw new Error(`Failed to get folder: ${folderResponse.status} ${folderResponse.statusText}`);
      }
      
      const folderData = await folderResponse.json();
      
      if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
        console.error(`❌ The provided ID is not a folder: ${folderData.mimeType}`);
        process.exit(1);
      }
      
      console.log(`\nFolder name: "${folderData.name}"\n`);
      
      // Search for all files in the folder
      console.log('Searching for files...');
      
      const files = await listFilesInFolder(accessToken, driveId, isRecursive);
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
      
      console.log('\n=== Summary ===');
      const folders = allFiles.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      const regularFiles = allFiles.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
      
      console.log(`Total items: ${allFiles.length}`);
      console.log(`Folders: ${folders.length}`);
      console.log(`Files: ${regularFiles.length}`);
      
      console.log(`\n🏁 Analysis completed.`);
      
    } catch (error: any) {
      console.error('❌ Error during analysis:', error.message);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * List all files in a folder recursively
 */
async function listFilesInFolder(
  accessToken: string, 
  folderId: string, 
  recursive: boolean, 
  pageToken?: string, 
  allFiles: FileMetadata[] = []
): Promise<FileMetadata[]> {
  try {
    // Build the query to find files in the specified folder
    let query = `'${folderId}' in parents and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,webViewLink)`;
    
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    // Get all files in the folder
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const files = data.files || [];
    allFiles.push(...files);
    
    console.log(`Found ${files.length} files/folders in the current batch`);
    
    // If there are more pages, get them
    if (data.nextPageToken) {
      return listFilesInFolder(accessToken, folderId, recursive, data.nextPageToken, allFiles);
    }
    
    // If recursive, get files from subfolders
    if (recursive) {
      const folders = files.filter((file: FileMetadata) => file.mimeType === 'application/vnd.google-apps.folder');
      
      for (const folder of folders) {
        console.log(`Looking in subfolder: ${folder.name}`);
        await listFilesInFolder(accessToken, folder.id, recursive, undefined, allFiles);
      }
    }
    
    return allFiles;
  } catch (error: any) {
    console.error(`Error listing files in folder ${folderId}:`, error.message);
    return allFiles;
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});