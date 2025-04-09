#!/usr/bin/env ts-node
/**
 * Create sources_google2 Table Script
 * 
 * This script creates the sources_google2 table for the migration
 */

import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Setting up sources_google2 table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // 1. Check if the table exists
    const { data: tableCheck, error: checkError } = await supabase.rpc('execute_sql', {
      sql: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sources_google2')`
    });
    
    if (checkError) {
      throw new Error(`Failed to check if table exists: ${checkError.message}`);
    }
    
    const tableExists = tableCheck && tableCheck[0] && tableCheck[0].exists;
    console.log(`Table exists: ${tableExists}`);
    
    if (tableExists) {
      // Ask to truncate
      const truncateConfirm = process.argv.includes('--truncate');
      
      if (truncateConfirm) {
        console.log('Truncating existing table...');
        
        const { error: truncateError } = await supabase.rpc('execute_sql', {
          sql: `TRUNCATE TABLE sources_google2`
        });
        
        if (truncateError) {
          throw new Error(`Failed to truncate table: ${truncateError.message}`);
        }
        
        console.log('Table truncated successfully');
      } else {
        console.log('Table already exists. Use --truncate flag to clear existing data.');
        return;
      }
    } else {
      // Create the table
      console.log('Creating sources_google2 table...');
      
      const createQuery = `
        CREATE TABLE IF NOT EXISTS public.sources_google2 (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          mime_type text,
          drive_id text NOT NULL,
          root_drive_id text,
          parent_folder_id text,
          path text,
          is_root boolean DEFAULT false,
          path_array text[],
          path_depth integer,
          is_deleted boolean DEFAULT false,
          metadata jsonb,
          size bigint,
          modified_time timestamp with time zone,
          web_view_link text,
          thumbnail_link text,
          content_extracted boolean DEFAULT false,
          extracted_content text,
          document_type_id uuid,
          expert_id uuid,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now(),
          last_indexed timestamp with time zone,
          main_video_id uuid
        )
      `;
      
      const { error: createError } = await supabase.rpc('execute_sql', {
        sql: createQuery
      });
      
      if (createError) {
        throw new Error(`Failed to create table: ${createError.message}`);
      }
      
      console.log('Table created successfully');
    }
    
    // Create indexes
    console.log('Creating indexes...');
    
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS sources_google2_drive_id_idx ON public.sources_google2 (drive_id)`,
      `CREATE INDEX IF NOT EXISTS sources_google2_root_drive_id_idx ON public.sources_google2 (root_drive_id)`,
      `CREATE INDEX IF NOT EXISTS sources_google2_parent_folder_id_idx ON public.sources_google2 (parent_folder_id)`,
      `CREATE INDEX IF NOT EXISTS sources_google2_mime_type_idx ON public.sources_google2 (mime_type)`,
      `CREATE INDEX IF NOT EXISTS sources_google2_path_idx ON public.sources_google2 (path)`,
      `CREATE INDEX IF NOT EXISTS sources_google2_name_idx ON public.sources_google2 (name)`
    ];
    
    for (const query of indexQueries) {
      const { error } = await supabase.rpc('execute_sql', { sql: query });
      
      if (error) {
        console.warn(`Warning: Failed to create index: ${error.message}`);
      }
    }
    
    console.log('Indexes created successfully');
    console.log('Setup complete!');
    
  } catch (error) {
    console.error('Error setting up table:', error);
    process.exit(1);
  }
}

main();