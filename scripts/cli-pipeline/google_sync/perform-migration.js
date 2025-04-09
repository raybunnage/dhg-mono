#!/usr/bin/env node

/**
 * Complete Sources Google Migration Script
 * 
 * This script performs a full migration from sources_google to sources_google2
 * with improved structure, and focuses on the root folders we care about.
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
// Service role key from .env.development
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';

// Target root folder IDs
const ROOT_FOLDERS = {
  DHG: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',  // Dynamic Healing Discussion Group
  PVSG: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'  // Polyvagal Steering Group
};

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipTruncate = args.includes('--skip-truncate');
const onlyDHG = args.includes('--only-dhg');
const onlyPVSG = args.includes('--only-pvsg');
const skipPvsg = args.includes('--skip-pvsg');

async function executeSql(supabase, sql, description) {
  console.log(`Executing SQL: ${description}...`);
  
  if (isDryRun) {
    console.log('DRY RUN - Would execute:', sql.substring(0, 100) + '...');
    return { success: true };
  }
  
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql });
    
    if (error) {
      throw new Error(`Failed to execute SQL (${description}): ${error.message}`);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error(`Error executing SQL (${description}):`, error.message);
    return { success: false, error };
  }
}

async function main() {
  try {
    console.log('Starting sources_google migration...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    if (onlyDHG && onlyPVSG) {
      console.error('Cannot specify both --only-dhg and --only-pvsg');
      process.exit(1);
    }
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Check if tables exist
    console.log('\nSTEP 1: Checking tables...');
    
    const { data: sgData, error: sgError } = await supabase
      .from('sources_google')
      .select('id', { count: 'exact', head: true });
    
    if (sgError) {
      throw new Error(`Failed to access sources_google: ${sgError.message}`);
    }
    
    const sourceCount = sgData?.count || 0;
    console.log(`sources_google has ${sourceCount} records`);
    
    // Check if sources_google2 exists
    const { data: sg2Data, error: sg2Error } = await supabase
      .from('sources_google2')
      .select('id', { count: 'exact', head: true });
    
    let targetTableExists = true;
    let targetCount = 0;
    
    if (sg2Error) {
      if (sg2Error.code === 'PGRST116') {
        console.log('sources_google2 table does not exist, will create it');
        targetTableExists = false;
      } else {
        throw new Error(`Error checking sources_google2: ${sg2Error.message}`);
      }
    } else {
      targetCount = sg2Data?.count || 0;
      console.log(`sources_google2 exists with ${targetCount} records`);
    }
    
    // Step 2: Create sources_google2 table if needed
    console.log('\nSTEP 2: Creating table structure...');
    
    if (!targetTableExists || targetCount === 0 || !skipTruncate) {
      // Create the table structure
      const createTableSql = `
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
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS sources_google2_drive_id_idx ON public.sources_google2 (drive_id);
        CREATE INDEX IF NOT EXISTS sources_google2_root_drive_id_idx ON public.sources_google2 (root_drive_id);
        CREATE INDEX IF NOT EXISTS sources_google2_parent_folder_id_idx ON public.sources_google2 (parent_folder_id);
        CREATE INDEX IF NOT EXISTS sources_google2_mime_type_idx ON public.sources_google2 (mime_type);
        CREATE INDEX IF NOT EXISTS sources_google2_path_idx ON public.sources_google2 (path);
        CREATE INDEX IF NOT EXISTS sources_google2_name_idx ON public.sources_google2 (name);
      `;
      
      const createResult = await executeSql(supabase, createTableSql, 'Create table structure');
      
      if (!createResult.success) {
        throw new Error('Failed to create table structure');
      }
      
      console.log('Table structure created successfully');
      
      // Truncate if the table exists and has data
      if (targetTableExists && targetCount > 0 && !skipTruncate) {
        console.log('Truncating existing sources_google2 table...');
        
        if (!isDryRun) {
          const { error: deleteError } = await supabase
            .from('sources_google2')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (deleteError) {
            console.warn(`Warning: Failed to truncate table: ${deleteError.message}`);
          } else {
            console.log('Table truncated successfully');
          }
        } else {
          console.log('DRY RUN - Would truncate the table');
        }
      }
    } else {
      console.log('Using existing table structure (--skip-truncate specified)');
    }
    
    // Step 3: Copy data from sources_google to sources_google2
    console.log('\nSTEP 3: Copying data...');
    
    // Build WHERE clause based on options
    let whereClause = '';
    if (onlyDHG) {
      whereClause = `WHERE root_drive_id = '${ROOT_FOLDERS.DHG}' OR path LIKE '%Dynamic Healing Discussion Group%'`;
    } else if (onlyPVSG) {
      whereClause = `WHERE root_drive_id = '${ROOT_FOLDERS.PVSG}' OR path LIKE '%Polyvagal Steering Group%'`;
    } else if (skipPvsg) {
      whereClause = `WHERE root_drive_id != '${ROOT_FOLDERS.PVSG}' AND path NOT LIKE '%Polyvagal Steering Group%'`;
    }
    
    const copyDataSql = `
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
                CASE WHEN drive_id = '${ROOT_FOLDERS.DHG}' THEN drive_id
                     WHEN path LIKE '%Dynamic Healing Discussion Group%' THEN '${ROOT_FOLDERS.DHG}'
                     WHEN drive_id = '${ROOT_FOLDERS.PVSG}' THEN drive_id
                     WHEN path LIKE '%Polyvagal Steering Group%' THEN '${ROOT_FOLDERS.PVSG}'
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
      ${whereClause}
    `;
    
    const copyResult = await executeSql(supabase, copyDataSql, 'Copy data to sources_google2');
    
    if (!copyResult.success) {
      throw new Error('Failed to copy data');
    }
    
    console.log('Data copied successfully');
    
    // Step 4: Fix paths and ensure proper root_drive_id values
    console.log('\nSTEP 4: Fixing paths and root_drive_id values...');
    
    // 4.1: Fix paths that don't start with a slash
    const fixPathsResult = await executeSql(
      supabase,
      `UPDATE sources_google2 SET path = '/' || path WHERE path NOT LIKE '/%'`,
      'Fix paths without leading slash'
    );
    
    if (!fixPathsResult.success) {
      console.warn('Warning: Failed to fix paths');
    }
    
    // 4.2: Regenerate path_array and path_depth
    const fixArraysResult = await executeSql(
      supabase,
      `UPDATE sources_google2 SET 
        path_array = string_to_array(path, '/'),
        path_depth = array_length(string_to_array(path, '/'), 1)`,
      'Regenerate path arrays'
    );
    
    if (!fixArraysResult.success) {
      console.warn('Warning: Failed to regenerate path arrays');
    }
    
    // 4.3: Set Dynamic Healing Discussion Group root_drive_id
    const fixDhgResult = await executeSql(
      supabase,
      `UPDATE sources_google2 SET root_drive_id = '${ROOT_FOLDERS.DHG}'
       WHERE path LIKE '%Dynamic Healing Discussion Group%' 
             OR drive_id = '${ROOT_FOLDERS.DHG}'`,
      'Fix Dynamic Healing Discussion Group root_drive_id'
    );
    
    if (!fixDhgResult.success) {
      console.warn('Warning: Failed to fix Dynamic Healing root_drive_id');
    }
    
    // 4.4: Set Polyvagal Steering Group root_drive_id
    const fixPvsgResult = await executeSql(
      supabase,
      `UPDATE sources_google2 SET root_drive_id = '${ROOT_FOLDERS.PVSG}'
       WHERE path LIKE '%Polyvagal Steering Group%' 
             OR drive_id = '${ROOT_FOLDERS.PVSG}'`,
      'Fix Polyvagal Steering Group root_drive_id'
    );
    
    if (!fixPvsgResult.success) {
      console.warn('Warning: Failed to fix Polyvagal Steering Group root_drive_id');
    }
    
    // Step 5: Check the results
    console.log('\nSTEP 5: Checking migration results...');
    
    if (!isDryRun) {
      // Check DHG records
      const { count: dhgCount, error: dhgError } = await supabase
        .from('sources_google2')
        .select('*', { count: 'exact', head: true })
        .eq('root_drive_id', ROOT_FOLDERS.DHG);
      
      if (dhgError) {
        console.error('Error counting DHG records:', dhgError.message);
      } else {
        console.log(`- Dynamic Healing Discussion Group: ${dhgCount} records`);
      }
      
      // Check PVSG records
      const { count: pvsgCount, error: pvsgError } = await supabase
        .from('sources_google2')
        .select('*', { count: 'exact', head: true })
        .eq('root_drive_id', ROOT_FOLDERS.PVSG);
      
      if (pvsgError) {
        console.error('Error counting PVSG records:', pvsgError.message);
      } else {
        console.log(`- Polyvagal Steering Group: ${pvsgCount} records`);
      }
      
      // Check total count
      const { count: finalCount, error: countError } = await supabase
        .from('sources_google2')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error counting total records:', countError.message);
      } else {
        console.log(`- Total records: ${finalCount}`);
      }
    } else {
      console.log('DRY RUN - Would check record counts here');
    }
    
    console.log('\nMigration completed successfully!');
    console.log('Next steps:');
    console.log('1. Review the results in sources_google2');
    console.log('2. When satisfied, run finalize-migration.js to rename the tables');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

main();