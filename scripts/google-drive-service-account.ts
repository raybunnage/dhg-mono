#!/usr/bin/env ts-node
/**
 * Google Drive Service Account Helper
 * 
 * This script demonstrates how to use a Google Service Account to authenticate 
 * with Google Drive API, providing more stable authentication than short-lived tokens.
 * 
 * Usage:
 *   ts-node google-drive-service-account.ts [command] [options]
 * 
 * Commands:
 *   list-folder <folderId>    List files in a folder
 *   verify                    Verify service account authentication
 * 
 * Options:
 *   --recursive               Recursively list files in subfolders
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || '';
const param = args[1];
const options = {
  recursive: args.includes('--recursive')
};

// Map commands
if (command === 'auth-status' || command === 'token-status') {
  args[0] = 'verify';
}

// Process commands
async function main() {
  try {
    // Initialize Drive client with service account
    const drive = await initDriveClient();
    
    if (!drive) {
      console.error('❌ Failed to initialize Drive client');
      process.exit(1);
    }
    
    switch (command) {
      case 'list-folder':
        if (!param) {
          console.error('❌ Folder ID is required');
          console.log('Usage: ts-node google-drive-service-account.ts list-folder <folderId> [--recursive]');
          process.exit(1);
        }
        await listFolder(drive, param, options.recursive);
        break;
        
      case 'verify':
        await verifyAuth(drive);
        break;
        
      default:
        console.log('📋 Available commands:');
        console.log('  list-folder <folderId>  - List files in a Google Drive folder');
        console.log('  verify                  - Verify service account authentication');
        console.log('\nOptions:');
        console.log('  --recursive             - Recursively list files in subfolders');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

/**
 * Initialize Google Drive client using service account
 */
async function initDriveClient() {
  try {
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                        path.resolve(__dirname, '../.service-account.json');
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      console.log('\nPlease do one of the following:');
      console.log('1. Create the file at the path above');
      console.log('2. Set GOOGLE_SERVICE_ACCOUNT_PATH environment variable to the correct path');
      console.log('\nTo get a key file, follow the instructions in:');
      console.log('docs/solution-guides/GOOGLE_SERVICE_ACCOUNT_GUIDE.md');
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
  } catch (error) {
    console.error('❌ Error initializing Drive client:', error);
    return null;
  }
}

/**
 * List files in a folder
 */
async function listFolder(drive: any, folderId: string, recursive: boolean = false) {
  console.log(`📂 Listing files in folder: ${folderId} ${recursive ? '(recursive)' : ''}`);
  
  // First, verify the folder exists
  try {
    const folderData = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType'
    });
    
    console.log(`✅ Folder exists: "${folderData.data.name}"`);
    
    // Get files in the folder
    const allFiles = await listFilesRecursively(drive, folderId, recursive);
    
    // Calculate stats
    const fileTypes: Record<string, number> = {};
    allFiles.forEach((file: any) => {
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    
    // Display results
    console.log(`\n✅ Found ${allFiles.length} files`);
    
    console.log('\nFile types:');
    Object.entries(fileTypes).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} files`);
    });
    
    console.log('\nSample of files:');
    allFiles.slice(0, 10).forEach((file: any, i: number) => {
      console.log(`${i+1}. ${file.name} (${file.mimeType})`);
    });
    
    if (allFiles.length > 10) {
      console.log(`... and ${allFiles.length - 10} more files`);
    }
    
    return allFiles;
  } catch (error: any) {
    console.error(`❌ Error accessing folder: ${error.message}`);
    return [];
  }
}

/**
 * List files recursively
 */
async function listFilesRecursively(drive: any, folderId: string, recursive: boolean = false, parentPath: string = ''): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken: string | null = null;
  
  // Query to get files in the current folder
  const query = `'${folderId}' in parents and trashed=false`;
  
  do {
    // Get a page of files
    const response: any = await drive.files.list({
      q: query,
      pageSize: 1000,
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime)',
      pageToken: pageToken
    });
    
    const files = response.data.files || [];
    
    // Process files
    const enhancedFiles = files.map((file: any) => {
      const filePath = parentPath ? `${parentPath}/${file.name}` : `/${file.name}`;
      return {
        ...file,
        path: filePath,
        parentPath: parentPath || '/'
      };
    });
    
    // Add files to the collection
    allFiles = [...allFiles, ...enhancedFiles];
    
    if (allFiles.length % 100 === 0) {
      console.log(`Found ${allFiles.length} files so far...`);
    }
    
    // If recursive, process subfolders
    if (recursive) {
      const folders = files.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder');
      
      for (const folder of folders) {
        const folderPath = parentPath ? `${parentPath}/${folder.name}` : `/${folder.name}`;
        const subFiles = await listFilesRecursively(drive, folder.id, true, folderPath);
        allFiles = [...allFiles, ...subFiles];
      }
    }
    
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

/**
 * Verify authentication works
 */
async function verifyAuth(drive: any) {
  try {
    console.log('🔍 Verifying authentication...');
    
    // Try to list at most 5 files from root
    const response = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)'
    });
    
    const files = response.data.files || [];
    
    console.log(`✅ Authentication successful! Found ${files.length} files in root.`);
    console.log('Service account is working correctly.');
    
    return true;
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    console.log('\nPlease check:');
    console.log('1. Your service account key file is valid');
    console.log('2. The service account has the necessary permissions');
    console.log('3. Google Drive API is enabled for your project');
    
    return false;
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});