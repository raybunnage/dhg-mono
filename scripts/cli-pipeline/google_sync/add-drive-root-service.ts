#!/usr/bin/env ts-node
/**
 * Add Google Drive Root Folder Using Service Account
 * 
 * This script adds a new Google Drive folder as a root folder in the database
 * using the Google service account for authentication.
 * 
 * Usage:
 *   npx ts-node add-drive-root-service.ts <folderId> --name "Folder Name" [--description "Optional description"]
 * 
 * Example:
 *   npx ts-node add-drive-root-service.ts 1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1 --name "DHG Repository"
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../../supabase/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../../../.env.development') });

// Known folder IDs
const KNOWN_FOLDERS: Record<string, string> = {
  'dynamic-healing': '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
  'polyvagal-steering': '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc',
  'dhg-repository': '1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1',
};

// Process command line arguments
const args = process.argv.slice(2);
const folderId = args[0];
const nameIndex = args.indexOf('--name');
const name = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;
const descIndex = args.indexOf('--description');
const description = descIndex !== -1 && args[descIndex + 1] ? args[descIndex + 1] : undefined;

if (!folderId) {
  console.error('❌ Folder ID is required');
  console.log('Usage: npx ts-node add-drive-root-service.ts <folderId> --name "Folder Name" [--description "Description"]');
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
      
      // Use the folder name if no custom name is provided
      const folderName = name || folderData.data.name;
      console.log(`Using folder name: "${folderName}"`);
      
      // Check if folder already exists in the database
      const { data: existingFolders, error: queryError } = await supabase
        .from('sources_google')
        .select('id, drive_id, name')
        .eq('drive_id', resolvedFolderId)
        .eq('deleted', false);
        
      if (queryError) {
        throw queryError;
      }
      
      // If folder exists, update it
      if (existingFolders && existingFolders.length > 0) {
        console.log(`Folder already exists with name "${existingFolders[0].name}", updating...`);
        
        const { data, error } = await supabase
          .from('sources_google')
          .update({
            name: folderName,
            is_root: true,
            path: `/${folderName}`,
            parent_path: null,
            parent_folder_id: null,
            metadata: { 
              description: description || null,
              isRootFolder: true,
              lastUpdated: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('drive_id', resolvedFolderId)
          .select();
          
        if (error) {
          throw error;
        }
        
        console.log(`✅ Updated root folder: ${folderName}`);
        return;
      }
      
      // Insert new root folder
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sources_google')
        .insert({
          drive_id: resolvedFolderId,
          name: folderName,
          is_root: true,
          mime_type: 'application/vnd.google-apps.folder',
          path: `/${folderName}`,
          parent_path: null,
          parent_folder_id: null,
          metadata: { 
            description: description || null,
            isRootFolder: true,
            createdAt: now
          },
          created_at: now,
          updated_at: now,
          deleted: false
        })
        .select();
        
      if (error) {
        throw error;
      }
      
      console.log(`✅ Added new root folder: ${folderName} with database ID: ${data[0].id}`);
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
                      path.resolve(__dirname, '../../../../../../.service-account.json');
    
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

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});