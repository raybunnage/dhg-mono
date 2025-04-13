#!/usr/bin/env node

/**
 * Direct Sources Google Migration Script
 * 
 * This script performs a direct migration focusing on just the
 * Dynamic Healing Discussion Group and Polyvagal Steering Group folders.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env files
const envFiles = ['.env', '.env.local', '.env.development'];
let envLoaded = false;

for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  try {
    require('fs').accessSync(filePath, require('fs').constants.R_OK);
    console.log(`Loading environment from ${file}`);
    dotenv.config({ path: filePath });
    envLoaded = true;
    break;
  } catch (e) {
    // File doesn't exist or isn't readable
  }
}

if (!envLoaded) {
  console.warn('No environment file found. Please create a .env.development file with Supabase credentials.');
}

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate credentials
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Supabase credentials not found in environment variables.');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.development file.');
  process.exit(1);
}

// Target root folder IDs
const ROOT_FOLDERS = {
  DHG: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',  // Dynamic Healing Discussion Group
  PVSG: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'  // Polyvagal Steering Group
};

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const onlyDHG = args.includes('--only-dhg');
const onlyPVSG = args.includes('--only-pvsg');

async function main() {
  try {
    console.log('Starting direct sources_google modification...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    if (onlyDHG && onlyPVSG) {
      console.error('Cannot specify both --only-dhg and --only-pvsg');
      process.exit(1);
    }
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check what we're targeting
    let targetRootId = null;
    let targetRootName = 'all folders';
    
    if (onlyDHG) {
      targetRootId = ROOT_FOLDERS.DHG;
      targetRootName = 'Dynamic Healing Discussion Group';
    } else if (onlyPVSG) {
      targetRootId = ROOT_FOLDERS.PVSG;
      targetRootName = 'Polyvagal Steering Group';
    }
    
    console.log(`Target: ${targetRootName}`);
    
    // Step 1: Get the current record counts
    console.log('\nSTEP 1: Checking current records...');
    
    // Count records matching our target
    let countQuery;
    
    if (targetRootId) {
      // Either matching root_drive_id or path containing the target name
      countQuery = supabase.from('sources_google')
        .select('id', { count: 'exact', head: true })
        .or(`root_drive_id.eq.${targetRootId},path.ilike.%${targetRootName}%`);
    } else {
      // Count all records
      countQuery = supabase.from('sources_google')
        .select('id', { count: 'exact', head: true });
    }
    
    const { count: matchCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Error counting records:', countError.message);
      return;
    }
    
    console.log(`Found ${matchCount} records matching the target criteria`);
    
    // Step 2: Direct updates to existing records
    console.log('\nSTEP 2: Updating records...');
    
    if (isDryRun) {
      console.log('DRY RUN - Would update records to fix paths and root_drive_id values');
    } else {
      if (targetRootId === ROOT_FOLDERS.DHG || !targetRootId) {
        console.log('Updating Dynamic Healing Discussion Group records...');
        
        // Set root_drive_id for DHG
        const { data: dhgData, error: dhgError } = await supabase
          .from('sources_google')
          .update({ 
            root_drive_id: ROOT_FOLDERS.DHG,
            // We'd add parent_folder_id here, but it would require renaming
            // the column, which is more complex
          })
          .or(`root_drive_id.eq.${ROOT_FOLDERS.DHG},path.ilike.%Dynamic Healing Discussion Group%`)
          .select('id');
        
        if (dhgError) {
          console.error('Error updating DHG records:', dhgError.message);
        } else {
          console.log(`Updated ${dhgData.length} DHG records`);
        }
      }
      
      if (targetRootId === ROOT_FOLDERS.PVSG || !targetRootId) {
        console.log('Updating Polyvagal Steering Group records...');
        
        // Set root_drive_id for PVSG
        const { data: pvsgData, error: pvsgError } = await supabase
          .from('sources_google')
          .update({ 
            root_drive_id: ROOT_FOLDERS.PVSG 
          })
          .or(`root_drive_id.eq.${ROOT_FOLDERS.PVSG},path.ilike.%Polyvagal Steering Group%`)
          .select('id');
        
        if (pvsgError) {
          console.error('Error updating PVSG records:', pvsgError.message);
        } else {
          console.log(`Updated ${pvsgData?.length || 0} PVSG records`);
        }
      }
    }
    
    // Step 3: Verification
    console.log('\nSTEP 3: Verifying updates...');
    
    if (!isDryRun) {
      // Check DHG records
      const { count: dhgCount, error: dhgError } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact', head: true })
        .eq('root_drive_id', ROOT_FOLDERS.DHG);
      
      if (dhgError) {
        console.error('Error counting DHG records:', dhgError.message);
      } else {
        console.log(`- Dynamic Healing Discussion Group: ${dhgCount} records`);
      }
      
      // Check PVSG records
      const { count: pvsgCount, error: pvsgError } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact', head: true })
        .eq('root_drive_id', ROOT_FOLDERS.PVSG);
      
      if (pvsgError) {
        console.error('Error counting PVSG records:', pvsgError.message);
      } else {
        console.log(`- Polyvagal Steering Group: ${pvsgCount} records`);
      }
      
      // Get a sample record to verify
      const { data: sampleData, error: sampleError } = await supabase
        .from('sources_google')
        .select('*')
        .eq('root_drive_id', ROOT_FOLDERS.DHG)
        .limit(1);
      
      if (sampleError) {
        console.error('Error getting sample record:', sampleError.message);
      } else if (sampleData && sampleData.length > 0) {
        console.log('\nSample record:');
        const record = sampleData[0];
        console.log(`- ID: ${record.id}`);
        console.log(`- Name: ${record.name}`);
        console.log(`- Path: ${record.path}`);
        console.log(`- Root Drive ID: ${record.root_drive_id}`);
      }
    } else {
      console.log('DRY RUN - Would verify updates here');
    }
    
    console.log('\nUpdate completed successfully!');
    
  } catch (error) {
    console.error('Error during update:', error);
    process.exit(1);
  }
}

main();