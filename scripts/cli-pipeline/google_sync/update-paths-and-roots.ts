#!/usr/bin/env ts-node
/**
 * Update Paths and Root Drive IDs Script
 * 
 * This script updates the path, path_array, path_depth, and root_drive_id values
 * in the sources_google table to ensure proper structure and organization.
 */

import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Updating paths and root drive IDs in sources_google table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // 1. Fix paths that don't start with a slash
    console.log('Fixing paths without leading slash...');
    
    // First, get records that need path fixing
    const { data: pathsToFix, error: fetchError } = await supabase
      .from('google_sources')
      .select('id, path')
      .not('path', 'like', '/%');
      
    if (fetchError) {
      throw new Error(`Failed to fetch paths to fix: ${fetchError.message}`);
    }
    
    console.log(`Found ${pathsToFix?.length || 0} paths that need leading slash`);
    
    // Update them in batches if needed
    if (pathsToFix && pathsToFix.length > 0) {
      for (const record of pathsToFix) {
        if (record.path) {
          const newPath = '/' + record.path;
          await supabase
            .from('google_sources')
            .update({ path: newPath })
            .eq('id', record.id);
        }
      }
      console.log('Fixed paths without leading slash');
    }
    
    // 2. Regenerate path_array and path_depth
    console.log('Regenerating path arrays and depths...');
    
    // Get all records to update path arrays
    const { data: allRecords, error: recordsError } = await supabase
      .from('google_sources')
      .select('id, path')
      .order('id');
      
    if (recordsError) {
      throw new Error(`Failed to fetch records for path arrays: ${recordsError.message}`);
    }
    
    console.log(`Updating path arrays for ${allRecords?.length || 0} records`);
    
    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < (allRecords?.length || 0); i += batchSize) {
      const batch = allRecords?.slice(i, i + batchSize) || [];
      console.log(`Processing path array batch ${i/batchSize + 1}/${Math.ceil((allRecords?.length || 0) / batchSize)}`);
      
      for (const record of batch) {
        if (record.path) {
          const pathArray = record.path.split('/').filter(Boolean);
          const pathDepth = pathArray.length;
          
          await supabase
            .from('google_sources')
            .update({ 
              path_array: pathArray, 
              path_depth: pathDepth 
            })
            .eq('id', record.id);
        }
      }
    }
    
    // 3. Set root_drive_id for Dynamic Healing Discussion Group
    console.log('Setting root_drive_id for Dynamic Healing Discussion Group...');
    
    const { error: dhgError } = await supabase
      .from('google_sources')
      .update({ root_drive_id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' })
      .or('path.like.%/Dynamic Healing Discussion Group/%,drive_id.eq.1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
    if (dhgError) {
      throw new Error(`Failed to set DHG root_drive_id: ${dhgError.message}`);
    }
    
    // 4. Set root_drive_id for Polyvagal Steering Group
    console.log('Setting root_drive_id for Polyvagal Steering Group...');
    
    const { error: pvsgError } = await supabase
      .from('google_sources')
      .update({ root_drive_id: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc' })
      .or('path.like.%/Polyvagal Steering Group/%,drive_id.eq.1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc');
    
    if (pvsgError) {
      throw new Error(`Failed to set PVSG root_drive_id: ${pvsgError.message}`);
    }
    
    // 5. Set root_drive_id for any transcript files
    console.log('Setting root_drive_id for transcript files...');
    
    const { error: transcriptError } = await supabase
      .from('google_sources')
      .update({ root_drive_id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' })
      .or('name.ilike.%transcript%,path.ilike.%transcript%')
      .in('mime_type', ['text/plain', 'application/vnd.google-apps.document'])
      .or('root_drive_id.is.null,root_drive_id.eq.');
    
    if (transcriptError) {
      throw new Error(`Failed to set transcript root_drive_id: ${transcriptError.message}`);
    }
    
    // 6. Count records by root
    const { count: dhgRecords, error: dhgCountError } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact', head: true })
      .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
    if (dhgCountError) {
      throw new Error(`Failed to count DHG records: ${dhgCountError.message}`);
    }
    
    const { count: pvsgRecords, error: pvsgCountError } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact', head: true })
      .eq('root_drive_id', '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc');
    
    if (pvsgCountError) {
      throw new Error(`Failed to count PVSG records: ${pvsgCountError.message}`);
    }
    
    console.log('Update complete!');
    console.log(`- Dynamic Healing Discussion Group: ${dhgRecords || 0} records`);
    console.log(`- Polyvagal Steering Group: ${pvsgRecords || 0} records`);
    
  } catch (error) {
    console.error('Error updating paths and roots:', error);
    process.exit(1);
  }
}

main();