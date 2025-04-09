#!/usr/bin/env ts-node
/**
 * Update Paths and Root Drive IDs Script
 * 
 * This script updates the path, path_array, path_depth, and root_drive_id values
 * in the sources_google2 table to ensure proper structure and organization.
 */

import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Updating paths and root drive IDs in sources_google2 table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // 1. Fix paths that don't start with a slash
    console.log('Fixing paths without leading slash...');
    
    const fixPathsQuery = `
      UPDATE sources_google2
      SET path = '/' || path
      WHERE path NOT LIKE '/%'
    `;
    
    const { error: pathError } = await supabase.rpc('execute_sql', {
      sql: fixPathsQuery
    });
    
    if (pathError) {
      throw new Error(`Failed to fix paths: ${pathError.message}`);
    }
    
    // 2. Regenerate path_array and path_depth
    console.log('Regenerating path_array and path_depth...');
    
    const pathArrayQuery = `
      UPDATE sources_google2
      SET 
        path_array = string_to_array(path, '/'),
        path_depth = array_length(string_to_array(path, '/'), 1)
    `;
    
    const { error: arrayError } = await supabase.rpc('execute_sql', {
      sql: pathArrayQuery
    });
    
    if (arrayError) {
      throw new Error(`Failed to update path arrays: ${arrayError.message}`);
    }
    
    // 3. Set root_drive_id for Dynamic Healing Discussion Group
    console.log('Setting root_drive_id for Dynamic Healing Discussion Group...');
    
    const dhgRootQuery = `
      UPDATE sources_google2
      SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
      WHERE 
        path LIKE '%/Dynamic Healing Discussion Group/%'
        OR drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
    `;
    
    const { error: dhgError } = await supabase.rpc('execute_sql', {
      sql: dhgRootQuery
    });
    
    if (dhgError) {
      throw new Error(`Failed to set DHG root_drive_id: ${dhgError.message}`);
    }
    
    // 4. Set root_drive_id for Polyvagal Steering Group
    console.log('Setting root_drive_id for Polyvagal Steering Group...');
    
    const pvsgRootQuery = `
      UPDATE sources_google2
      SET root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
      WHERE 
        path LIKE '%/Polyvagal Steering Group/%'
        OR drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
    `;
    
    const { error: pvsgError } = await supabase.rpc('execute_sql', {
      sql: pvsgRootQuery
    });
    
    if (pvsgError) {
      throw new Error(`Failed to set PVSG root_drive_id: ${pvsgError.message}`);
    }
    
    // 5. Set root_drive_id for any transcript files
    console.log('Setting root_drive_id for transcript files...');
    
    const transcriptQuery = `
      UPDATE sources_google2
      SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
      WHERE 
        (name ILIKE '%transcript%' OR path ILIKE '%transcript%')
        AND mime_type IN ('text/plain', 'application/vnd.google-apps.document')
        AND (root_drive_id IS NULL OR root_drive_id = '')
    `;
    
    const { error: transcriptError } = await supabase.rpc('execute_sql', {
      sql: transcriptQuery
    });
    
    if (transcriptError) {
      throw new Error(`Failed to set transcript root_drive_id: ${transcriptError.message}`);
    }
    
    // 6. Count records by root
    const { data: dhgCount, error: dhgCountError } = await supabase.rpc('execute_sql', {
      sql: `SELECT COUNT(*) FROM sources_google2 WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'`
    });
    
    if (dhgCountError) {
      throw new Error(`Failed to count DHG records: ${dhgCountError.message}`);
    }
    
    const { data: pvsgCount, error: pvsgCountError } = await supabase.rpc('execute_sql', {
      sql: `SELECT COUNT(*) FROM sources_google2 WHERE root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'`
    });
    
    if (pvsgCountError) {
      throw new Error(`Failed to count PVSG records: ${pvsgCountError.message}`);
    }
    
    const dhgRecords = dhgCount && dhgCount[0] ? dhgCount[0].count : 0;
    const pvsgRecords = pvsgCount && pvsgCount[0] ? pvsgCount[0].count : 0;
    
    console.log('Update complete!');
    console.log(`- Dynamic Healing Discussion Group: ${dhgRecords} records`);
    console.log(`- Polyvagal Steering Group: ${pvsgRecords} records`);
    
  } catch (error) {
    console.error('Error updating paths and roots:', error);
    process.exit(1);
  }
}

main();