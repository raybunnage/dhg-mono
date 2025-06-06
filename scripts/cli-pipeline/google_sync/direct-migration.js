#!/usr/bin/env node

/**
 * Direct Sources Google Migration Script
 * 
 * This script performs a direct migration focusing on just the
 * Dynamic Healing Discussion Group and Polyvagal Steering Group folders.
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const path = require('path');

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
    
    // Get Supabase client from singleton service
    const supabase = SupabaseClientService.getInstance().getClient();
    
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
      countQuery = supabase.from('google_sources')
        .select('id', { count: 'exact', head: true })
        .or(`root_drive_id.eq.${targetRootId},path.ilike.%${targetRootName}%`);
    } else {
      // Count all records
      countQuery = supabase.from('google_sources')
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
          .from('google_sources')
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
          .from('google_sources')
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
        .from('google_sources')
        .select('id', { count: 'exact', head: true })
        .eq('root_drive_id', ROOT_FOLDERS.DHG);
      
      if (dhgError) {
        console.error('Error counting DHG records:', dhgError.message);
      } else {
        console.log(`- Dynamic Healing Discussion Group: ${dhgCount} records`);
      }
      
      // Check PVSG records
      const { count: pvsgCount, error: pvsgError } = await supabase
        .from('google_sources')
        .select('id', { count: 'exact', head: true })
        .eq('root_drive_id', ROOT_FOLDERS.PVSG);
      
      if (pvsgError) {
        console.error('Error counting PVSG records:', pvsgError.message);
      } else {
        console.log(`- Polyvagal Steering Group: ${pvsgCount} records`);
      }
      
      // Get a sample record to verify
      const { data: sampleData, error: sampleError } = await supabase
        .from('google_sources')
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