#!/usr/bin/env ts-node
/**
 * Sync Google Drive Folder Using Service Account
 * 
 * This script syncs files from a Google Drive folder to the database
 * using the Google service account for authentication.
 * 
 * Usage:
 *   npx ts-node sync-drive-service.ts [folderId] [options]
 * 
 * Options:
 *   --dry-run                 Show what would be synced without making changes
 *   --recursive               Recursively sync subfolders
 *   --limit <number>          Limit the number of files to process (default: 50)
 * 
 * Examples:
 *   npx ts-node sync-drive-service.ts 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run
 *   npx ts-node sync-drive-service.ts dynamic-healing --dry-run --recursive
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Known folder IDs
const KNOWN_FOLDERS: Record<string, string> = {
  'dynamic-healing': '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
  'polyvagal-steering': '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc',
  'dhg-repository': '1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1',
};

// Process command line arguments
const args = process.argv.slice(2);
const folderId = args[0];
const options = {
  dryRun: args.includes('--dry-run'),
  recursive: args.includes('--recursive'),
  limit: 50
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

if (!folderId) {
  console.error('❌ Folder ID is required');
  console.log('Usage: npx ts-node sync-drive-service.ts <folderId> [options]');
  process.exit(1);
}

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
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // Initialize Drive client with service account
    const drive = await initDriveClient();
    
    if (!drive) {
      console.error('❌ Failed to initialize Drive client');
      process.exit(1);
    }

    // Get the resolved folder ID if it's an alias
    let resolvedFolderId = folderId;
    if (KNOWN_FOLDERS[folderId]) {
      resolvedFolderId = KNOWN_FOLDERS[folderId];
      console.log(`Using known folder ID for "${folderId}": ${resolvedFolderId}`);
    }

    console.log(`🔍 Checking folder with ID: ${resolvedFolderId}`);
    
    // Verify the folder exists in Google Drive
    try {
      const folderData = await drive.files.get({
        fileId: resolvedFolderId,
        fields: 'id,name,mimeType'
      });
      
      const isFolder = folderData.data.mimeType === 'application/vnd.google-apps.folder';
      
      if (!isFolder) {
        console.error(`❌ The provided ID is not a folder: ${folderData.data.mimeType}`);
        process.exit(1);
      }
      
      const folderName = folderData.data.name;
      console.log(`Syncing folder: "${folderName}" (${resolvedFolderId})`);
      console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
      console.log(`Recursive: ${options.recursive ? 'Yes' : 'No'}`);
      console.log(`Limit: ${options.limit} files per folder`);
      
      // Get folder details from the database
      const { data: dbFolder, error: dbError } = await supabase
        .from('sources_google')
        .select('id, drive_id, name, is_root, path')
        .eq('drive_id', resolvedFolderId)
        .eq('deleted', false)
        .single();
        
      if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
        throw dbError;
      }
      
      // Starting the sync process
      console.log('Starting sync process...');
      
      // Get files in the folder
      const files = await listFiles(drive, resolvedFolderId, options.recursive);
      
      console.log(`Found ${files.length} files in the folder`);
      
      // If dry run, just show what would be synced
      if (options.dryRun) {
        console.log('\n=== DRY RUN - No changes will be made ===\n');
        
        // Group files by mime type
        const filesByType: Record<string, any[]> = {};
        files.forEach(file => {
          const type = file.mimeType || 'unknown';
          if (!filesByType[type]) {
            filesByType[type] = [];
          }
          filesByType[type].push(file);
        });
        
        // Display summary by mime type
        console.log('Files by type:');
        Object.entries(filesByType).forEach(([type, typeFiles]) => {
          console.log(`- ${type}: ${typeFiles.length} files`);
        });
        
        // Show sample of each type
        console.log('\nSample files by type:');
        Object.entries(filesByType).forEach(([type, typeFiles]) => {
          console.log(`\n${type}:`);
          typeFiles.slice(0, 5).forEach(file => {
            console.log(`- ${file.name} (${file.id})`);
            if (file.path) {
              console.log(`  Path: ${file.path}`);
            }
          });
          if (typeFiles.length > 5) {
            console.log(`  ... and ${typeFiles.length - 5} more`);
          }
        });
        
        // Show folder structure if recursive
        if (options.recursive) {
          console.log('\nFolder structure:');
          const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
          folders.forEach(folder => {
            console.log(`- ${folder.path || '/'}`);
          });
        }
        
        console.log('\n=== END DRY RUN ===');
      } else {
        console.log('\n=== ACTUAL SYNC - Changes will be made to the database ===\n');
        console.log('Synchronization not implemented yet. Use --dry-run to preview changes.');
      }
      
    } catch (error: any) {
      console.error(`❌ Error accessing folder: ${error.message}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
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
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
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

/**
 * List files in a Google Drive folder
 */
async function listFiles(drive: any, folderId: string, recursive: boolean = false): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken = null;
  const parentFolder = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType'
  });
  
  const parentPath = `/${parentFolder.data.name}`;
  
  // Query to get files in the current folder
  const query = `'${folderId}' in parents and trashed=false`;
  
  do {
    console.log(`Fetching files from folder ${folderId}...`);
    
    // Get a page of files
    const response: any = await drive.files.list({
      q: query,
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, size)',
      pageToken: pageToken
    });
    
    const files = response.data.files || [];
    
    // Process files
    const enhancedFiles = files.map((file: any) => {
      return {
        ...file,
        path: `${parentPath}/${file.name}`,
        parentPath: parentPath,
        parentFolderId: folderId
      };
    });
    
    // Add files to the collection
    allFiles = [...allFiles, ...enhancedFiles];
    
    if (recursive) {
      // Process subfolders
      const folders = files.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder');
      
      for (const folder of folders) {
        console.log(`Processing subfolder: ${folder.name} (${folder.id})...`);
        const subFiles = await listFiles(drive, folder.id, true);
        allFiles = [...allFiles, ...subFiles];
      }
    }
    
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});