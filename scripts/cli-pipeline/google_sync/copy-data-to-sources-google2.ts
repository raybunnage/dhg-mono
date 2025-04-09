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
    
    // Get all records from sources_google
    console.log('Fetching data from sources_google...');
    
    // First, count the records
    const { count: sourceCount, error: countError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      throw new Error(`Failed to count sources_google: ${countError.message}`);
    }
    
    console.log(`Source table has ${sourceCount} records`);
    
    // Then get existing records in the target
    console.log('Checking target table...');
    
    const { count: targetCount, error: targetCountError } = await supabase
      .from('sources_google2')
      .select('*', { count: 'exact', head: true });
      
    if (targetCountError) {
      throw new Error(`Failed to check sources_google2: ${targetCountError.message}`);
    }
    
    console.log(`Target table has ${targetCount} records initially`);
    
    // Check if we should proceed
    if (targetCount && targetCount > 0) {
      const forceOverwrite = process.argv.includes('--force');
      
      if (!forceOverwrite) {
        console.log('Target table already has data. Use --force to overwrite.');
        return;
      }
      
      console.log('Force flag detected, will upsert all records');
    }
    
    // Fetch source records in batches
    const batchSize = 100;
    const batches = Math.ceil(Number(sourceCount || 0) / batchSize);
    let processedCount = 0;
    
    console.log(`Processing ${sourceCount} records in ${batches} batches of ${batchSize}...`);
    
    for (let i = 0; i < batches; i++) {
      const offset = i * batchSize;
      
      console.log(`Processing batch ${i+1}/${batches}, offset ${offset}...`);
      
      // Fetch a batch of records
      const { data: sourceRecords, error: fetchError } = await supabase
        .from('sources_google')
        .select('*')
        .range(offset, offset + batchSize - 1);
        
      if (fetchError) {
        throw new Error(`Failed to fetch batch ${i+1}: ${fetchError.message}`);
      }
      
      if (!sourceRecords || sourceRecords.length === 0) {
        console.log(`Batch ${i+1} is empty, skipping`);
        continue;
      }
      
      console.log(`Batch ${i+1} has ${sourceRecords.length} records`);
      
      // Transform the records
      const transformedRecords = sourceRecords.map(record => ({
        id: record.id, // Keep the same ID to preserve references
        name: record.name,
        mime_type: record.mime_type,
        drive_id: record.drive_id,
        root_drive_id: record.root_drive_id || 
                     (record.drive_id === '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' ? record.drive_id : 
                     (record.path && record.path.includes('Dynamic Healing Discussion Group') ? 
                     '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' : record.drive_id)),
        parent_folder_id: record.parent_id,
        path: record.path || ('/' + record.name),
        is_root: record.is_root,
        path_array: record.path ? record.path.split('/') : ['', record.name],
        path_depth: record.path ? record.path.split('/').length : 2,
        is_deleted: record.deleted || false,
        metadata: record.metadata,
        size: record.size || record.size_bytes || (record.metadata && record.metadata.size ? parseInt(record.metadata.size) : null),
        modified_time: record.modified_time,
        web_view_link: record.web_view_link,
        thumbnail_link: record.thumbnail_link,
        content_extracted: record.content_extracted,
        extracted_content: record.extracted_content,
        document_type_id: record.document_type_id,
        expert_id: record.expert_id,
        created_at: record.created_at,
        updated_at: record.updated_at,
        last_indexed: record.last_indexed,
        main_video_id: record.main_video_id
      }));
      
      // Upsert the records
      const { error: upsertError } = await supabase
        .from('sources_google2')
        .upsert(transformedRecords, { onConflict: 'id' });
        
      if (upsertError) {
        throw new Error(`Failed to upsert batch ${i+1}: ${upsertError.message}`);
      }
      
      processedCount += transformedRecords.length;
      console.log(`Processed ${processedCount}/${sourceCount} records so far`);
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