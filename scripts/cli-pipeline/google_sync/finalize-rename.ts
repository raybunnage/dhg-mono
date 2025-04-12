#!/usr/bin/env ts-node
/**
 * Finalize Migration by Renaming Tables
 * 
 * This script renames the sources_google table to sources_google
 * and creates a compatibility view if needed.
 */

import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Finalizing migration by renaming tables...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Check if old table exists
    const { data: oldTableCheck, error: oldTableError } = await supabase.rpc('execute_sql', {
      sql: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sources_google')`
    });
    
    if (oldTableError) {
      throw new Error(`Failed to check old table: ${oldTableError.message}`);
    }
    
    const oldTableExists = oldTableCheck && oldTableCheck[0] && oldTableCheck[0].exists;
    
    // Check if new table exists
    const { data: newTableCheck, error: newTableError } = await supabase.rpc('execute_sql', {
      sql: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sources_google')`
    });
    
    if (newTableError) {
      throw new Error(`Failed to check new table: ${newTableError.message}`);
    }
    
    const newTableExists = newTableCheck && newTableCheck[0] && newTableCheck[0].exists;
    
    console.log(`Original table exists: ${oldTableExists}`);
    console.log(`New table exists: ${newTableExists}`);
    
    if (!newTableExists) {
      console.error('Cannot finalize - sources_google table does not exist');
      process.exit(1);
    }
    
    // Rename old table if it exists
    if (oldTableExists) {
      console.log('Renaming original table to sources_google_deprecated...');
      
      const { error: renameOldError } = await supabase.rpc('execute_sql', {
        sql: `ALTER TABLE sources_google RENAME TO sources_google_deprecated`
      });
      
      if (renameOldError) {
        throw new Error(`Failed to rename old table: ${renameOldError.message}`);
      }
      
      console.log('Old table renamed successfully');
    }
    
    // Rename new table
    console.log('Renaming sources_google to sources_google...');
    
    const { error: renameNewError } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE sources_google RENAME TO sources_google`
    });
    
    if (renameNewError) {
      throw new Error(`Failed to rename new table: ${renameNewError.message}`);
    }
    
    console.log('New table renamed successfully');
    
    // Create compatibility view if needed
    console.log('Creating compatibility view...');
    
    const viewQuery = `
      CREATE OR REPLACE VIEW sources_google_legacy_view AS
      SELECT
          id,
          drive_id,
          name,
          mime_type,
          parent_folder_id AS parent_id,
          is_deleted AS deleted,
          root_drive_id,
          path,
          metadata,
          size AS size_bytes,
          modified_time,
          web_view_link,
          thumbnail_link,
          content_extracted,
          extracted_content,
          document_type_id,
          expert_id,
          created_at,
          updated_at,
          last_indexed,
          main_video_id
      FROM
          sources_google
    `;
    
    const { error: viewError } = await supabase.rpc('execute_sql', {
      sql: viewQuery
    });
    
    if (viewError) {
      console.warn(`Warning: Failed to create view: ${viewError.message}`);
    } else {
      console.log('Compatibility view created successfully');
    }
    
    // Rename indexes if needed
    console.log('Renaming indexes...');
    
    const indexQueries = [
      `ALTER INDEX IF EXISTS sources_google_drive_id_idx RENAME TO sources_google_drive_id_idx`,
      `ALTER INDEX IF EXISTS sources_google_root_drive_id_idx RENAME TO sources_google_root_drive_id_idx`,
      `ALTER INDEX IF EXISTS sources_google_parent_folder_id_idx RENAME TO sources_google_parent_folder_id_idx`,
      `ALTER INDEX IF EXISTS sources_google_mime_type_idx RENAME TO sources_google_mime_type_idx`,
      `ALTER INDEX IF EXISTS sources_google_path_idx RENAME TO sources_google_path_idx`,
      `ALTER INDEX IF EXISTS sources_google_name_idx RENAME TO sources_google_name_idx`,
      `ALTER INDEX IF EXISTS sources_google_document_type_id_idx RENAME TO sources_google_document_type_id_idx`,
      `ALTER INDEX IF EXISTS sources_google_expert_id_idx RENAME TO sources_google_expert_id_idx`
    ];
    
    for (const query of indexQueries) {
      const { error } = await supabase.rpc('execute_sql', { sql: query });
      if (error) {
        console.warn(`Warning: Error renaming index: ${error.message}`);
      }
    }
    
    console.log('Finalizing migration...COMPLETE!');
    console.log('The migration has been finalized. The sources_google table now uses the new schema.');
    
  } catch (error) {
    console.error('Error finalizing migration:', error);
    process.exit(1);
  }
}

main();