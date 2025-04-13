#!/usr/bin/env ts-node
/**
 * Create sources_google Table Script
 * 
 * This script creates the sources_google table for the migration
 */

import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Setting up sources_google table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // 1. Check if the table exists - try a direct query first
    let tableExists = false;
    
    try {
      const { count, error } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`Table exists and has ${count} records`);
        tableExists = true;
      }
    } catch (e) {
      console.log('Error checking table directly, will attempt to create it');
    }
    
    // Table existence is already determined above
    
    if (tableExists) {
      // Ask to truncate
      const truncateConfirm = process.argv.includes('--truncate');
      
      if (truncateConfirm) {
        console.log('Dropping and recreating table...');
        
        // Drop the table first
        const { error: dropError } = await supabase.rpc('execute_sql', {
          sql: `DROP TABLE IF EXISTS public.sources_google`
        });
        
        if (dropError) {
          throw new Error(`Failed to drop table: ${dropError.message}`);
        }
        
        console.log('Table dropped successfully, will recreate it');
        tableExists = false;
      } else {
        console.log('Table already exists. Use --truncate flag to clear existing data.');
        return;
      }
    } else {
      // Create the table
      console.log('Creating sources_google table...');
      
      const createQuery = `
        CREATE TABLE IF NOT EXISTS public.sources_google (
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
      `CREATE INDEX IF NOT EXISTS sources_google_drive_id_idx ON public.sources_google (drive_id)`,
      `CREATE INDEX IF NOT EXISTS sources_google_root_drive_id_idx ON public.sources_google (root_drive_id)`,
      `CREATE INDEX IF NOT EXISTS sources_google_parent_folder_id_idx ON public.sources_google (parent_folder_id)`,
      `CREATE INDEX IF NOT EXISTS sources_google_mime_type_idx ON public.sources_google (mime_type)`,
      `CREATE INDEX IF NOT EXISTS sources_google_path_idx ON public.sources_google (path)`,
      `CREATE INDEX IF NOT EXISTS sources_google_name_idx ON public.sources_google (name)`
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