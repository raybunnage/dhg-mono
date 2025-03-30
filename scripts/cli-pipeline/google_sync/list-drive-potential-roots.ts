#!/usr/bin/env ts-node
/**
 * List Potential Drive Root Folders
 * 
 * This script lists potential root folders from Google Drive that aren't registered yet.
 * 
 * Usage:
 *   npx ts-node list-drive-potential-roots.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

async function main() {
  try {
    // Initialize Drive client with service account
    const drive = await initDriveClient();
    
    if (!drive) {
      console.error('❌ Failed to initialize Drive client');
      process.exit(1);
    }
    
    await listPotentialRoots(drive);
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
 * List potential root folders from Google Drive
 */
async function listPotentialRoots(drive: any) {
  try {
    console.log('=== Potential Root Folders ===');
    
    // Query for top-level folders (those that are direct children of My Drive)
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: "files(id,name,mimeType,modifiedTime,owners)",
      pageSize: 50
    });
    
    const folders = response.data.files || [];
    
    console.log(`\nFound ${folders.length} potential root folders in Google Drive:`);
    console.log('\n--------------------------------------------');
    console.log('ID\t\t\t\t\tName\t\t\tModified');
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
    console.error('❌ Error listing potential root folders:', error.message);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});