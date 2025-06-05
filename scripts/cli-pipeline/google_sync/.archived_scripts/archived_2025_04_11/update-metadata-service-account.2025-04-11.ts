# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Update Google Drive Metadata using Service Account
 * 
 * This script updates metadata for files in the Dynamic Healing Discussion Group
 * folder using a Google Service Account for authentication. This approach is more
 * stable than using short-lived OAuth tokens.
 * 
 * Usage:
 *   ts-node update-metadata-service-account.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --limit <n>        Limit to updating n records (default: 10)
 *   --verbose          Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../../supabase/types';

// Load multiple environment files
function loadEnvFiles() {
  // Order matters - later files override earlier ones
  const envFiles = [
    '.env',
    '.env.development',
    '.env.local'
  ];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

// Load environment variables
loadEnvFiles();

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Parse limit
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 10;

// Folder ID for Dynamic Healing Discussion Group
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Ensure Supabase credentials are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Debug loaded environment variables
console.log('Loaded environment variables:');
console.log('- SUPABASE_URL:', supabaseUrl);
console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Found' : 'Not found');
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not found');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Initialize Google Drive client using service account
 */
async function initDriveClient() {
  try {
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                      path.resolve(process.cwd(), '.service-account.json');
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      console.log('\nPlease do one of the following:');
      console.log('1. Create the file at the path above');
      console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable to the correct path');
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

/**
 * Update metadata for existing Google Drive files
 */
async function updateMetadata(
  drive: any,
  folderId: string, 
  limit: number, 
  dryRun: boolean, 
  verbose: boolean
): Promise<{
  records: number;
  updated: number;
  skipped: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}> {
  const startTime = new Date();
  const result = {
    records: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    startTime,
    endTime: startTime
  };

  try {
    // Fetch records from Supabase
    if (verbose) console.log(`Fetching records from Supabase (limit: ${limit})...`);
    
    const { data: records, error } = await supabase
      .from('google_sources')
      .select('*')
      .or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    if (!records || records.length === 0) throw new Error('No records returned from Supabase');
    
    result.records = records.length;
    if (verbose) console.log(`Found ${records.length} records`);
    
    // Process each record
    for (const record of records) {
      try {
        if (verbose) console.log(`Processing record: ${record.name} (${record.drive_id})`);
        
        // Skip records without drive_id
        if (!record.drive_id) {
          if (verbose) console.log(`Skipping record without drive_id: ${record.id}`);
          result.skipped++;
          continue;
        }
        
        // Get current file metadata from Google Drive using service account
        try {
          const response = await drive.files.get({
            fileId: record.drive_id,
            fields: 'id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink'
          });
          
          const fileData = response.data;
          
          if (!fileData) {
            if (verbose) console.log(`No data found for file: ${record.drive_id}`);
            result.skipped++;
            continue;
          }
          
          // Prepare update data
          const metadata: Record<string, any> = record.metadata ? 
            (typeof record.metadata === 'object' ? { ...record.metadata } : {}) : 
            {};
          
          // Update metadata fields
          ['modifiedTime', 'size', 'thumbnailLink', 'webViewLink', 'mimeType'].forEach(field => {
            if (fileData[field] !== undefined) {
              metadata[field] = fileData[field];
            }
          });
          
          // Additional column-specific updates
          const updateData: any = {
            metadata,
            updated_at: new Date().toISOString()
          };
          
          if (fileData.size !== undefined) {
            updateData.size = parseInt(fileData.size, 10) || null;
          }
          
          if (fileData.thumbnailLink !== undefined) {
            updateData.thumbnail_link = fileData.thumbnailLink;
          }
          
          if (fileData.modifiedTime !== undefined) {
            updateData.modified_time = fileData.modifiedTime;
          }
          
          // Update record in Supabase
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('google_sources')
              .update(updateData)
              .eq('id', record.id);
              
            if (updateError) throw updateError;
            
            if (verbose) console.log(`Updated record: ${record.name}`);
          } else if (verbose) {
            console.log(`DRY RUN: Would update record: ${record.name}`);
            console.log('Update data:', updateData);
          }
          
          result.updated++;
        } catch (error: any) {
          const errorMessage = `Error getting file metadata: ${error.message || 'Unknown error'}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
          result.skipped++;
        }
      } catch (error: any) {
        const errorMessage = `Error updating record ${record.id}: ${error.message || 'Unknown error'}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);
        result.skipped++;
      }
    }
  } catch (error: any) {
    const errorMessage = `Error updating metadata: ${error.message || 'Unknown error'}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
  }
  
  result.endTime = new Date();
  return result;
}

/**
 * Main function
 */
async function updateDynamicHealingMetadata(): Promise<void> {
  console.log('=== Dynamic Healing Discussion Group Metadata Update ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
  console.log(`Records limit: ${limit}`);
  console.log(`Verbose logging: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log('======================================================');

  try {
    // Initialize Google Drive client with service account
    const drive = await initDriveClient();
    if (!drive) {
      console.error('❌ Failed to initialize Google Drive client');
      process.exit(1);
    }
    
    // Make sure folder exists
    console.log(`Checking folder: ${DYNAMIC_HEALING_FOLDER_ID}`);
    
    try {
      const folder = await drive.files.get({
        fileId: DYNAMIC_HEALING_FOLDER_ID,
        fields: 'id,name,mimeType'
      });
      
      console.log(`✅ Folder exists: "${folder.data.name}"`);
      
      if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`The provided ID is not a folder: ${folder.data.mimeType}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to get folder: ${error.message || error}`);
      process.exit(1);
    }

    // Update metadata
    console.log(`Starting metadata update for ${limit} records...`);
    const result = await updateMetadata(drive, DYNAMIC_HEALING_FOLDER_ID, limit, isDryRun, isVerbose);

    // Print results
    console.log('\n=== Update Summary ===');
    console.log(`Records found: ${result.records}`);
    console.log(`Records updated: ${result.updated}`);
    console.log(`Records skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Duration: ${(result.endTime.getTime() - result.startTime.getTime()) / 1000}s`);

    if (result.errors.length > 0) {
      console.error('\nErrors encountered:');
      result.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error}`);
      });
    }

    console.log('\n=== Update Complete ===');
  } catch (error: any) {
    console.error('Unexpected error:', error.message || error);
    process.exit(1);
  }
}

// Execute the main function
updateDynamicHealingMetadata().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});