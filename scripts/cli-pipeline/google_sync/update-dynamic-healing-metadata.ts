#!/usr/bin/env ts-node
/**
 * Update Google Drive Metadata Script
 * 
 * This script updates metadata for files in the Dynamic Healing Discussion Group
 * Google Drive folder. It can be run in dry-run mode to see what would be updated
 * without making actual changes.
 * 
 * Usage:
 *   ts-node update-dynamic-healing-metadata.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --limit <n>        Limit to updating n records (default: 10)
 *   --verbose          Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
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
  ? parseInt(args[limitIndex + 1]) 
  : 10;

// Folder ID for Dynamic Healing Discussion Group
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Debug loaded environment variables
console.log('Loaded environment variables:');
console.log('- VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('- VITE_GOOGLE_ACCESS_TOKEN:', process.env.VITE_GOOGLE_ACCESS_TOKEN ? 'Found' : 'Not found');

// Ensure Supabase credentials are available
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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
 * Update metadata for existing Google Drive files
 */
async function updateMetadata(
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
    // Get Google access token
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('No Google access token found in environment variables');
    }

    // Fetch records from Supabase
    if (verbose) console.log(`Fetching records from Supabase (limit: ${limit})...`);
    
    const { data: records, error } = await supabase
      .from('sources_google')
      .select('*')
      .or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    if (!records) throw new Error('No records returned from Supabase');
    
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
        
        // Get current file metadata from Google Drive
        const url = `https://www.googleapis.com/drive/v3/files/${record.drive_id}?fields=id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get file metadata: ${response.status} ${response.statusText}`);
        }
        
        const fileData = await response.json();
        
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
            .from('sources_google')
            .update(updateData)
            .eq('id', record.id);
            
          if (updateError) throw updateError;
          
          if (verbose) console.log(`Updated record: ${record.name}`);
        } else if (verbose) {
          console.log(`DRY RUN: Would update record: ${record.name}`);
          console.log('Update data:', updateData);
        }
        
        result.updated++;
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        console.error(`Error updating record ${record.id}:`, errorMessage);
        result.errors.push(errorMessage);
        result.skipped++;
      }
    }
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';
    console.error('Error updating metadata:', errorMessage);
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
    // Make sure we have access token
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('❌ No Google access token found in environment variables');
      process.exit(1);
    }
    
    // Skip folder check and proceed directly to metadata update
    console.log(`Skipping folder check due to token issues - assuming folder exists: ${DYNAMIC_HEALING_FOLDER_ID}`);

    // Update metadata
    console.log(`Starting metadata update for ${limit} records...`);
    const result = await updateMetadata(DYNAMIC_HEALING_FOLDER_ID, limit, isDryRun, isVerbose);

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
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Execute the main function
updateDynamicHealingMetadata().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});