#!/usr/bin/env ts-node
/**
 * Copy Data to sources_google2 Script
 * 
 * This script copies data from sources_google to sources_google2 with improved structure
 */

import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Copying data to sources_google2 table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Check if tables exist
    const { data: sourceCheck, error: sourceError } = await supabase.rpc('execute_sql', {
      sql: `SELECT COUNT(*) FROM sources_google`
    });
    
    if (sourceError) {
      throw new Error(`Failed to check sources_google: ${sourceError.message}`);
    }
    
    const sourceCount = sourceCheck && sourceCheck[0] ? sourceCheck[0].count : 0;
    console.log(`Source table has ${sourceCount} records`);
    
    const { data: targetCheck, error: targetError } = await supabase.rpc('execute_sql', {
      sql: `SELECT COUNT(*) FROM sources_google2`
    });
    
    if (targetError) {
      throw new Error(`Failed to check sources_google2: ${targetError.message}`);
    }
    
    const targetCount = targetCheck && targetCheck[0] ? targetCheck[0].count : 0;
    console.log(`Target table has ${targetCount} records initially`);
    
    if (targetCount > 0) {
      const forceOverwrite = process.argv.includes('--force');
      
      if (!forceOverwrite) {
        console.log('Target table already has data. Use --force to overwrite.');
        return;
      }
      
      // Truncate the table
      const { error: truncateError } = await supabase.rpc('execute_sql', {
        sql: `TRUNCATE TABLE sources_google2`
      });
      
      if (truncateError) {
        throw new Error(`Failed to truncate target table: ${truncateError.message}`);
      }
      
      console.log('Target table truncated');
    }
    
    // Copy data
    console.log('Copying data from sources_google to sources_google2...');
    
    const copyQuery = `
      INSERT INTO sources_google2 (
        id, name, mime_type, drive_id, root_drive_id, parent_folder_id, path, is_root,
        path_array, path_depth, is_deleted, metadata, size, modified_time, 
        web_view_link, thumbnail_link, content_extracted, extracted_content,
        document_type_id, expert_id, created_at, updated_at, last_indexed
      )
      SELECT 
        id, 
        name, 
        mime_type, 
        drive_id,
        COALESCE(root_drive_id, 
                CASE WHEN drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' THEN drive_id
                     WHEN path LIKE '%Dynamic Healing Discussion Group%' THEN '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
                     ELSE drive_id END),
        parent_id,
        COALESCE(path, '/' || name),
        is_root,
        string_to_array(COALESCE(path, '/' || name), '/'),
        array_length(string_to_array(COALESCE(path, '/' || name), '/'), 1),
        COALESCE(deleted, false),
        metadata,
        COALESCE(size, size_bytes, (metadata->>'size')::bigint),
        modified_time, 
        web_view_link, 
        thumbnail_link,
        content_extracted, 
        extracted_content,
        document_type_id, 
        expert_id,
        created_at, 
        updated_at, 
        last_indexed
      FROM sources_google
    `;
    
    const { error: copyError } = await supabase.rpc('execute_sql', {
      sql: copyQuery
    });
    
    if (copyError) {
      throw new Error(`Failed to copy data: ${copyError.message}`);
    }
    
    // Check final count
    const { data: finalCheck, error: finalError } = await supabase.rpc('execute_sql', {
      sql: `SELECT COUNT(*) FROM sources_google2`
    });
    
    if (finalError) {
      throw new Error(`Failed to check final count: ${finalError.message}`);
    }
    
    const finalCount = finalCheck && finalCheck[0] ? finalCheck[0].count : 0;
    console.log(`Data copied successfully. Target table now has ${finalCount} records`);
    
    console.log('Copy complete!');
    
  } catch (error) {
    console.error('Error copying data:', error);
    process.exit(1);
  }
}

main();