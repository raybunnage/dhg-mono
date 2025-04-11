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
import { defaultGoogleAuth } from '../../../packages/shared/services/google-drive';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || '';
const param = args[1];
const options = {
  recursive: args.includes('--recursive'),
  json: args.includes('--json')
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
 * Initialize Google Drive client using the shared auth service
 */
async function initDriveClient() {
  try {
    // First try to get a token from the centralized auth service
    console.log('🔍 Using centralized Google Auth Service...');
    
    // Check if auth service is ready
    const isReady = await defaultGoogleAuth.isReady();
    if (isReady) {
      // Get access token
      const accessToken = await defaultGoogleAuth.getAccessToken();
      
      if (accessToken) {
        console.log('✅ Successfully obtained token from centralized auth service');
        
        // Create auth using the OAuth2 client
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
          access_token: accessToken
        });
        
        // Initialize the Drive client
        return google.drive({ version: 'v3', auth });
      }
    }
    
    // Fallback to direct service account initialization if centralized auth failed
    console.log('⚠️ Centralized auth service failed, falling back to direct service account...');
    
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                        path.resolve(__dirname, '../../../.service-account.json');
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      console.log('\nPlease do one of the following:');
      console.log('1. Create the file at the path above');
      console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable to the correct path');
      console.log('3. Set GOOGLE_SERVICE_ACCOUNT_PATH environment variable to the correct path');
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
    
    // Check if the --json flag is provided
    const jsonOutput = args.includes('--json');
    
    if (jsonOutput) {
      // Calculate total size
      const totalSizeBytes = allFiles.reduce((total, file) => total + (file.size_bytes || 0), 0);
      
      // Create result object with enhanced metadata
      const result = {
        totalFiles: allFiles.length,
        totalSizeBytes: totalSizeBytes,
        totalSizeFormatted: formatFileSize(totalSizeBytes),
        fileTypes,
        queryInfo: {
          folderId: folderId,
          folderName: folderData.data.name,
          timestamp: new Date().toISOString(),
          recursive: recursive
        },
        files: allFiles
      };
      
      // Check if we should output to a specific file
      const outputPath = path.resolve(__dirname, '../../../file_types/json/google-drive.json');
      
      // Make sure directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}`);
      }
      
      // Write to file
      try {
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`✅ JSON output written to: ${outputPath}`);
      } catch (error: any) {
        console.error(`❌ Error writing to file: ${error.message}`);
        // Still output to console as fallback
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      // Display human-readable results
      console.log(`\n✅ Found ${allFiles.length} files`);
      
      console.log('\nFile types:');
      Object.entries(fileTypes).forEach(([type, count]) => {
        console.log(`- ${type}: ${count} files`);
      });
      
      console.log('\nSample of files:');
      allFiles.slice(0, 10).forEach((file: any, i: number) => {
        const sizeInfo = file.size_formatted ? `, ${file.size_formatted}` : '';
        const dateInfo = file.createdTime ? `, Created: ${new Date(file.createdTime).toLocaleString()}` : '';
        const linkInfo = file.view_url ? `\n   Link: ${file.view_url}` : '';
        console.log(`${i+1}. ${file.name} (${file.mimeType}${sizeInfo}${dateInfo})${linkInfo}`);
      });
      
      if (allFiles.length > 10) {
        console.log(`... and ${allFiles.length - 10} more files`);
      }
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
async function listFilesRecursively(drive: any, folderId: string, recursive: boolean = false, parentPath: string = '', depth: number = 0): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken: string | null = null;
  
  // Query to get files in the current folder
  const query = `'${folderId}' in parents and trashed=false`;
  
  do {
    // Get a page of files with additional fields for size, creation date, and web links
    const response: any = await drive.files.list({
      q: query,
      pageSize: 1000,
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, createdTime, size, webViewLink, webContentLink)',
      pageToken: pageToken
    });
    
    const files = response.data.files || [];
    
    // Process files
    const enhancedFiles = files.map((file: any) => {
      const filePath = parentPath ? `${parentPath}/${file.name}` : `/${file.name}`;
      // Create path array by splitting the path and filtering out empty elements
      const pathArray = filePath.split('/').filter((segment: string) => segment.length > 0);
      
      // Convert size to a number if it exists, otherwise set to 0 for folders or unknown
      const fileSize = file.size ? parseInt(file.size, 10) : 0;
      
      // Format size for human readability
      const formattedSize = formatFileSize(fileSize);
      
      // The webViewLink is usually available for all files, but webContentLink might be missing for some
      // Create a normalized view_url that prefers webViewLink but falls back to webContentLink
      const viewUrl = file.webViewLink || file.webContentLink || null;
      
      return {
        ...file,
        path: filePath,
        parentPath: parentPath || '/',
        path_array: pathArray,
        depth: depth,
        size_bytes: fileSize,
        size_formatted: formattedSize,
        view_url: viewUrl,
        web_view_link: file.webViewLink || null,
        web_content_link: file.webContentLink || null
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
        // Increment depth for subfolders
        const subFiles = await listFilesRecursively(drive, folder.id, true, folderPath, depth + 1);
        allFiles = [...allFiles, ...subFiles];
      }
    }
    
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

/**
 * Format file size into a human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  // Round to 2 decimal places
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
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