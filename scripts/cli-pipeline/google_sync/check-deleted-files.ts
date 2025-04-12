#!/usr/bin/env ts-node
/**
 * Check files marked as deleted in sources_google2
 * 
 * This script examines records marked as deleted in the sources_google2 table
 * and helps to verify if they actually exist in Google Drive.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { google } from 'googleapis';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

// Constants
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

// Initialize Google Drive client
async function initDriveClient() {
  try {
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                      path.resolve(process.cwd(), '.service-account.json');
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      return null;
    }
    
    // Read and parse the service account key file
    const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    // Create JWT auth client with the service account
    const auth = new google.auth.JWT(
      keyFile.client_email,
      undefined,
      keyFile.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );
    
    // Initialize the Drive client
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('❌ Error initializing Drive client:', error);
    return null;
  }
}

// Check if a file exists in Google Drive
async function checkFileExists(drive: any, fileId: string) {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,parents'
    });
    return { exists: true, data: response.data };
  } catch (error: any) {
    if (error.code === 404) {
      return { exists: false, error: 'File not found' };
    }
    return { exists: false, error: error.message || 'Unknown error' };
  }
}

// Main function
async function checkDeletedFiles() {
  try {
    console.log('=== Checking Files Marked as Deleted ===');
    
    // Initialize Google Drive client
    const drive = await initDriveClient();
    if (!drive) {
      console.error('❌ Failed to initialize Google Drive client');
      process.exit(1);
    }
    
    // Fetch deleted files
    console.log('Fetching files marked as deleted...');
    const { data: deletedFiles, error } = await supabase
      .from('sources_google2')
      .select('id, drive_id, name, path_array, root_drive_id, updated_at')
      .eq('is_deleted', true)
      .eq('root_drive_id', DYNAMIC_HEALING_FOLDER_ID)
      .order('updated_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('Error fetching deleted files:', error);
      process.exit(1);
    }
    
    console.log(`Found ${deletedFiles.length} files marked as deleted`);
    
    // Check each file
    console.log('\n=== Checking Files in Google Drive ===');
    for (const file of deletedFiles) {
      console.log(`\nChecking file: ${file.name} (${file.drive_id})`);
      console.log(`Path: ${JSON.stringify(file.path_array)}`);
      
      const result = await checkFileExists(drive, file.drive_id);
      
      if (result.exists) {
        console.log(`✅ File EXISTS in Google Drive!`);
        console.log(`Type: ${result.data.mimeType}`);
        console.log(`Parent folder: ${result.data.parents?.[0] || 'Unknown'}`);
      } else {
        console.log(`❌ File DOES NOT EXIST in Google Drive (${result.error})`);
      }
    }
    
    console.log('\n=== Check Complete ===');
  } catch (error: any) {
    console.error('Unexpected error:', error.message || error);
    process.exit(1);
  }
}

// Run the script
checkDeletedFiles();