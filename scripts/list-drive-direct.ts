#!/usr/bin/env ts-node
/**
 * List Drive Folders Directly
 * 
 * This script uses the access token from .env.development to list top-level
 * folders directly without using the service account.
 * 
 * Usage:
 *   npx ts-node list-drive-direct.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

async function main() {
  try {
    // Get the access token from environment variables
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('❌ No Google access token found in environment variables');
      console.log('Please make sure VITE_GOOGLE_ACCESS_TOKEN is set in .env.development');
      process.exit(1);
    }
    
    console.log('🔍 Using access token to list Google Drive folders...');
    
    // Query for top-level folders
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false");
    const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,owners),nextPageToken");
    
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=50`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const folders = data.files || [];
    
    console.log(`\nFound ${folders.length} potential root folders in Google Drive:`);
    console.log('\n--------------------------------------------');
    console.log('ID\t\t\t\tName\t\t\tModified');
    console.log('--------------------------------------------');
    
    if (folders.length === 0) {
      console.log('No folders found.');
    } else {
      folders.forEach((folder: any) => {
        const modified = new Date(folder.modifiedTime).toLocaleDateString();
        const owner = folder.owners?.[0]?.displayName || 'Unknown';
        console.log(`${folder.id}\t${folder.name}\t\t${modified} (${owner})`);
      });
      
      // Add usage instructions
      console.log('\nTo add a root folder, you would use:');
      console.log(`ts-node google-drive-manager.ts add-root <folderId> --name "Folder Name"`);
      
      console.log('\nKnown folder IDs:');
      console.log('- Dynamic Healing: 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
      console.log('- Polyvagal Steering: 1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});