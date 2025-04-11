# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * List Drive Folders Using Service Account
 * 
 * This script uses the Google service account to list top-level
 * folders in Google Drive.
 * 
 * Usage:
 *   npx ts-node list-drive-service-account.ts
 */

import { defaultGoogleAuth, getGoogleDriveService } from '../../../packages/shared/services/google-drive';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils';
import { google } from 'googleapis';

// Initialize logger
Logger.setLevel(Logger.LogLevel.INFO);

async function main() {
  try {
    // Check if auth service is ready
    if (!await defaultGoogleAuth.isReady()) {
      Logger.error('Google authentication is not ready');
      process.exit(1);
    }
    
    // Get access token
    const accessToken = await defaultGoogleAuth.getAccessToken();
    if (!accessToken) {
      Logger.error('Failed to get access token');
      process.exit(1);
    }
    
    // Create auth from the access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    // Initialize the Drive client
    const drive = google.drive({ version: 'v3', auth });
    
    if (!drive) {
      Logger.error('❌ Failed to initialize Drive client');
      process.exit(1);
    }
    
    await listRootFolders(drive);
  } catch (error: any) {
    Logger.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * List root folders from Google Drive
 */
async function listRootFolders(drive: any) {
  try {
    Logger.info('=== Potential Root Folders ===');
    
    // Query for top-level folders (those that are direct children of My Drive)
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: "files(id,name,mimeType,modifiedTime,owners),nextPageToken",
      pageSize: 50
    });
    
    const folders = response.data.files || [];
    
    Logger.info(`\nFound ${folders.length} potential root folders in Google Drive:`);
    Logger.info('\n--------------------------------------------');
    Logger.info('ID\t\t\t\t\tName\t\t\tModified');
    Logger.info('--------------------------------------------');
    
    if (folders.length === 0) {
      Logger.info('No folders found.');
    } else {
      folders.forEach((folder: any) => {
        const modified = new Date(folder.modifiedTime).toLocaleDateString();
        const owner = folder.owners?.[0]?.displayName || 'Unknown';
        Logger.info(`${folder.id}\t${folder.name}\t\t${modified} (${owner})`);
      });
      
      // Add usage instructions
      Logger.info('\nTo add a root folder, you would use:');
      Logger.info(`npx ts-node add-drive-root.ts <folderId> --name "Folder Name"`);
      
      Logger.info('\nKnown folder IDs:');
      Logger.info('- Dynamic Healing: 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
      Logger.info('- Polyvagal Steering: 1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc');
      Logger.info('- DHG Repository: 1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1');
    }
  } catch (error: any) {
    Logger.error('Error listing potential root folders:', error.message);
  }
}

// Execute the main function
main().catch(error => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});