#!/usr/bin/env ts-node
/**
 * Update File Signatures Script
 * 
 * This script updates all existing file_signature values in the sources_google table
 * to use the new consistent format that properly handles file renames.
 * 
 * Usage:
 *   ts-node update-file-signatures.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --batch-size <n>   Process records in batches of n (default: 50)
 *   --verbose          Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    try {
      dotenv.config({ path: filePath });
      console.log(`Loaded environment from ${file}`);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Parse batch size
const batchSizeIndex = args.indexOf('--batch-size');
const BATCH_SIZE = batchSizeIndex !== -1 && args[batchSizeIndex + 1] 
  ? parseInt(args[batchSizeIndex + 1], 10) 
  : 50;

// Initialize Supabase client
const supabase = SupabaseClientService.getInstance().getClient();

interface UpdateStats {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

/**
 * Generate file signature using the new format
 */
function generateFileSignature(name: string, modifiedTime: string): string {
  return `${name.replace(/[^a-zA-Z0-9]/g, '')}${modifiedTime.replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * Update file signatures for all records in the database
 */
async function updateFileSignatures(): Promise<UpdateStats> {
  const result: UpdateStats = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    startTime: new Date()
  };
  
  console.log('=== File Signature Update ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Verbose logging: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log('===============================');
  
  try {
    // Count total records
    const { count, error: countError } = await supabase
      .from('sources_google')
      .select('id', { count: 'exact', head: true });
      
    if (countError) {
      throw new Error(`Error counting records: ${countError.message}`);
    }
    
    const totalRecords = count || 0;
    console.log(`Found ${totalRecords} records to process`);
    
    if (totalRecords === 0) {
      console.log('No records to process');
      result.endTime = new Date();
      return result;
    }
    
    // Process in batches
    const batches = Math.ceil(totalRecords / BATCH_SIZE);
    console.log(`Will process in ${batches} batches of ${BATCH_SIZE} records`);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const offset = batchIndex * BATCH_SIZE;
      
      if (isVerbose) {
        console.log(`\nProcessing batch ${batchIndex + 1}/${batches} (offset: ${offset})`);
      }
      
      // Fetch batch of records
      const { data: records, error: selectError } = await supabase
        .from('sources_google')
        .select('id, name, file_signature, modified_at')
        .range(offset, offset + BATCH_SIZE - 1);
        
      if (selectError) {
        const errorMessage = `Error fetching records: ${selectError.message}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);
        continue;
      }
      
      if (!records || records.length === 0) {
        console.log(`No records found in batch ${batchIndex + 1}`);
        continue;
      }
      
      if (isVerbose) {
        console.log(`Found ${records.length} records in batch ${batchIndex + 1}`);
      }
      
      // Process each record in the batch
      for (const record of records) {
        result.processed++;
        
        // Skip if name or modified_at is missing
        if (!record.name || !record.modified_at) {
          if (isVerbose) {
            console.log(`Skipping record ${record.id}: Missing name or modified_at`);
          }
          result.skipped++;
          continue;
        }
        
        // Generate new file signature
        const newSignature = generateFileSignature(record.name, record.modified_at);
        
        // Compare with existing file signature
        if (record.file_signature === newSignature) {
          if (isVerbose) {
            console.log(`Skipping record ${record.id}: File signature already matches new format`);
          }
          result.skipped++;
          continue;
        }
        
        if (isVerbose) {
          console.log(`Updating file signature for ${record.id} (${record.name}):`);
          console.log(`  Old: ${record.file_signature}`);
          console.log(`  New: ${newSignature}`);
        }
        
        if (!isDryRun) {
          // Update file signature in database
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ 
              file_signature: newSignature,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
            
          if (updateError) {
            const errorMessage = `Error updating file signature for record ${record.id}: ${updateError.message}`;
            console.error(errorMessage);
            result.errors.push(errorMessage);
            continue;
          }
        }
        
        result.updated++;
        
        // Periodic status update
        if (result.processed % 100 === 0) {
          console.log(`Processed ${result.processed}/${totalRecords} records (${Math.round(result.processed / totalRecords * 100)}%)`);
        }
      }
      
      console.log(`Completed batch ${batchIndex + 1}/${batches}`);
    }
  } catch (error: any) {
    const errorMessage = `Unexpected error: ${error.message || 'Unknown error'}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
  }
  
  result.endTime = new Date();
  
  // Final stats
  const duration = (result.endTime.getTime() - result.startTime.getTime()) / 1000;
  console.log('\n=== Update Summary ===');
  console.log(`Records processed: ${result.processed}`);
  console.log(`Records updated: ${result.updated}`);
  console.log(`Records skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Duration: ${duration.toFixed(3)}s`);
  
  return result;
}

async function main() {
  try {
    await updateFileSignatures();
    console.log('=== File Signature Update Complete ===');
  } catch (error: any) {
    console.error('Fatal error:', error.message || error);
    process.exit(1);
  }
}

main().catch(console.error);