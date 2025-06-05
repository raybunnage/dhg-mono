#!/usr/bin/env ts-node
/**
 * Check path_depth in sources_google against depth in google-drive.json
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

async function checkPathDepths() {
  console.log('Comparing depth fields between google-drive.json and sources_google table');
  
  try {
    // Read the JSON file
    const jsonFilePath = path.resolve(__dirname, '../../../file_types/json/google-drive.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    if (!jsonData.files || !Array.isArray(jsonData.files)) {
      console.error('Invalid JSON file format: no files array found');
      return;
    }
    
    // Define file type
    interface GoogleDriveFile {
      id: string;
      name: string;
      depth: number;
      [key: string]: any;
    }
    
    // Filter files with depth field
    const filesWithDepth = jsonData.files.filter((file: any) => 'depth' in file && 'id' in file) as GoogleDriveFile[];
    
    console.log(`Found ${filesWithDepth.length} files with depth field in JSON`);
    console.log('Checking against database records...\n');
    
    // Track statistics
    let totalChecked = 0;
    let matchesFound = 0;
    let mismatchesFound = 0;
    let notFoundCount = 0;
    
    // Check each file against the database
    for (const file of filesWithDepth) {
      totalChecked++;
      
      const { data, error } = await supabase
        .from('google_sources')
        .select('id, name, drive_id, path_depth')
        .eq('drive_id', file.id);
        
      if (error) {
        console.error(`Error for file ${file.id}:`, error);
        continue;
      }
      
      if (!data || data.length === 0) {
        notFoundCount++;
        // Only log if not found
        console.log(`⚠️ NOT FOUND - ${file.name}`);
        console.log(`  Drive ID: ${file.id}`);
        console.log(`  JSON depth: ${file.depth}`);
        console.log('');
        continue;
      }
      
      const dbRecord = data[0];
      
      // Only show mismatches
      if (file.depth !== dbRecord.path_depth) {
        mismatchesFound++;
        console.log(`❌ MISMATCH - ${file.name}`);
        console.log(`  Drive ID: ${file.id}`);
        console.log(`  JSON depth: ${file.depth}`);
        console.log(`  DB path_depth: ${dbRecord.path_depth}`);
        console.log('');
      } else {
        matchesFound++;
      }
      
      // Show progress every 100 files
      if (totalChecked % 100 === 0) {
        console.log(`Progress: Checked ${totalChecked} of ${filesWithDepth.length} files...`);
      }
    }
    
    // Print summary
    console.log('\n===== SUMMARY =====');
    console.log(`Total files checked: ${totalChecked}`);
    console.log(`Matches found: ${matchesFound}`);
    console.log(`Mismatches found: ${mismatchesFound}`);
    console.log(`Files not found in database: ${notFoundCount}`);
    console.log(`Match percentage: ${(matchesFound / totalChecked * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkPathDepths();