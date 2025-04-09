#!/usr/bin/env node

/**
 * Simple Sources Google Migration Script
 * 
 * This script performs a direct copy from sources_google to sources_google2,
 * focusing on just the Dynamic Healing Discussion Group and Polyvagal Steering Group.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
// Service role key from .env.development
const SUPABASE_KEY = '***REMOVED***';

// Target root folder IDs
const ROOT_FOLDERS = {
  DHG: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',  // Dynamic Healing Discussion Group
  PVSG: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'  // Polyvagal Steering Group
};

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipCreate = args.includes('--skip-create');
const onlyDHG = args.includes('--only-dhg');
const onlyPVSG = args.includes('--only-pvsg');

async function runQuery(supabase, query, params = {}) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql: query,
      ...params
    });
    
    if (error) {
      throw new Error(`SQL error: ${error.message}`);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error(`Error executing query: ${error.message}`);
    return { success: false, error };
  }
}

async function createSourcesGoogle2Table(supabase) {
  console.log('Creating sources_google2 table...');
  
  // This is the SQL for creating the table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.sources_google2 (
      id uuid PRIMARY KEY,
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
  `;
  
  if (isDryRun) {
    console.log('DRY RUN - Would create table');
    return true;
  }
  
  const result = await runQuery(supabase, createTableSQL);
  return result.success;
}

async function copyRecords(supabase, targetRootIds) {
  if (!targetRootIds || targetRootIds.length === 0) {
    console.warn('No target root IDs specified for copying');
    return false;
  }
  
  const rootIdConditions = targetRootIds.map(id => 
    `path LIKE '%${id === ROOT_FOLDERS.DHG ? 'Dynamic Healing Discussion Group' : 'Polyvagal Steering Group'}%'`
  ).join(' OR ');
  
  // Build the SQL for copying records
  const copySQL = `
    INSERT INTO sources_google2 (
      id, name, mime_type, drive_id, 
      root_drive_id, parent_folder_id, path, is_root,
      metadata, size, modified_time, web_view_link, thumbnail_link,
      content_extracted, extracted_content,
      document_type_id, expert_id, created_at, updated_at, last_indexed
    )
    SELECT 
      id, name, mime_type, drive_id,
      '${targetRootIds[0]}' as root_drive_id,
      parent_id as parent_folder_id, 
      path, is_root,
      metadata, size, modified_time, web_view_link, thumbnail_link,
      content_extracted, extracted_content,
      document_type_id, expert_id, created_at, updated_at, last_indexed
    FROM 
      sources_google
    WHERE 
      ${rootIdConditions}
  `;
  
  console.log(`Copying records for ${targetRootIds.length} root folders...`);
  
  if (isDryRun) {
    console.log('DRY RUN - Would copy records with SQL:');
    console.log(copySQL);
    return true;
  }
  
  const result = await runQuery(supabase, copySQL);
  return result.success;
}

async function updatePathArrays(supabase) {
  console.log('Updating path arrays...');
  
  const updateSQL = `
    UPDATE sources_google2
    SET 
      path_array = string_to_array(COALESCE(path, '/' || name), '/'),
      path_depth = array_length(string_to_array(COALESCE(path, '/' || name), '/'), 1),
      is_deleted = false
  `;
  
  if (isDryRun) {
    console.log('DRY RUN - Would update path arrays');
    return true;
  }
  
  const result = await runQuery(supabase, updateSQL);
  return result.success;
}

async function getRecordCounts(supabase) {
  try {
    // Get counts from sources_google
    const { data: sgData, error: sgError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
    
    if (sgError) {
      console.error('Error checking sources_google:', sgError.message);
      return null;
    }
    
    const originalCount = sgData?.count || 0;
    
    // Get counts by path for Dynamic Healing
    const { data: dhgData, error: dhgError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .ilike('path', '%Dynamic Healing Discussion Group%');
    
    const dhgCount = (dhgError || !dhgData) ? 0 : dhgData.count || 0;
    
    // Get counts by path for Polyvagal Steering
    const { data: pvsgData, error: pvsgError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .ilike('path', '%Polyvagal Steering Group%');
    
    const pvsgCount = (pvsgError || !pvsgData) ? 0 : pvsgData.count || 0;
    
    // Get counts from sources_google2
    try {
      const { data: sg2Data, error: sg2Error } = await supabase
        .from('sources_google2')
        .select('*', { count: 'exact', head: true });
      
      const newCount = (sg2Error || !sg2Data) ? 0 : sg2Data.count || 0;
      
      return {
        original: originalCount,
        dhg: dhgCount,
        pvsg: pvsgCount,
        new: newCount
      };
    } catch (error) {
      console.warn('Warning: Error checking sources_google2 count:', error.message);
      return {
        original: originalCount,
        dhg: dhgCount,
        pvsg: pvsgCount,
        new: 0
      };
    }
  } catch (error) {
    console.error('Error getting record counts:', error);
    return null;
  }
}

async function main() {
  try {
    console.log('Starting SIMPLE sources_google migration...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    // Filter logic
    if (onlyDHG && onlyPVSG) {
      console.error('Cannot specify both --only-dhg and --only-pvsg');
      process.exit(1);
    }
    
    let targetRootIds = [ROOT_FOLDERS.DHG, ROOT_FOLDERS.PVSG];
    let targetNames = ['Dynamic Healing Discussion Group', 'Polyvagal Steering Group'];
    
    if (onlyDHG) {
      targetRootIds = [ROOT_FOLDERS.DHG];
      targetNames = ['Dynamic Healing Discussion Group'];
    } else if (onlyPVSG) {
      targetRootIds = [ROOT_FOLDERS.PVSG];
      targetNames = ['Polyvagal Steering Group'];
    }
    
    console.log(`Targets: ${targetNames.join(', ')}`);
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Check initial record counts
    console.log('\nSTEP 1: Checking initial record counts...');
    const initialCounts = await getRecordCounts(supabase);
    
    if (!initialCounts) {
      throw new Error('Failed to get initial record counts');
    }
    
    console.log(`- Original table: ${initialCounts.original} total records`);
    console.log(`- Dynamic Healing Discussion Group: ${initialCounts.dhg} records`);
    console.log(`- Polyvagal Steering Group: ${initialCounts.pvsg} records`);
    console.log(`- New table: ${initialCounts.new} records`);
    
    if (initialCounts.new > 0) {
      console.warn('\nWARNING: sources_google2 already has data');
      
      if (!isDryRun) {
        // Drop the table if not in dry run mode and we want to create it
        if (!skipCreate) {
          console.log('Dropping existing sources_google2 table...');
          
          const dropResult = await runQuery(supabase, 'DROP TABLE IF EXISTS sources_google2');
          
          if (!dropResult.success) {
            throw new Error('Failed to drop existing table');
          }
          
          console.log('Table dropped successfully');
        } else {
          console.log('Keeping existing table (--skip-create specified)');
        }
      } else {
        console.log('DRY RUN - Would drop existing table');
      }
    }
    
    // Step 2: Create the table
    let tableReady = initialCounts.new > 0 && skipCreate;
    
    if (!tableReady) {
      console.log('\nSTEP 2: Creating sources_google2 table...');
      
      if (skipCreate) {
        console.log('Skipping table creation (--skip-create specified)');
        tableReady = true;
      } else {
        const createSuccess = await createSourcesGoogle2Table(supabase);
        
        if (!createSuccess) {
          throw new Error('Failed to create sources_google2 table');
        }
        
        console.log('Table created successfully');
        tableReady = true;
      }
    } else {
      console.log('\nSTEP 2: Using existing sources_google2 table (--skip-create specified)');
    }
    
    // Step 3: Copy the records
    if (tableReady) {
      console.log('\nSTEP 3: Copying records...');
      
      const copySuccess = await copyRecords(supabase, targetRootIds);
      
      if (!copySuccess) {
        throw new Error('Failed to copy records');
      }
      
      console.log('Records copied successfully');
    }
    
    // Step 4: Update path arrays and other derived fields
    console.log('\nSTEP 4: Updating derived fields...');
    
    const updateSuccess = await updatePathArrays(supabase);
    
    if (!updateSuccess) {
      throw new Error('Failed to update path arrays');
    }
    
    console.log('Path arrays updated successfully');
    
    // Step 5: Verify results
    if (!isDryRun) {
      console.log('\nSTEP 5: Verifying results...');
      
      const finalCounts = await getRecordCounts(supabase);
      
      if (!finalCounts) {
        throw new Error('Failed to get final record counts');
      }
      
      console.log(`- Original table: ${finalCounts.original} total records`);
      console.log(`- New table: ${finalCounts.new} records`);
      
      let expectedCount = 0;
      if (onlyDHG) {
        expectedCount = finalCounts.dhg;
      } else if (onlyPVSG) {
        expectedCount = finalCounts.pvsg;
      } else {
        expectedCount = finalCounts.dhg + finalCounts.pvsg;
      }
      
      if (finalCounts.new < expectedCount) {
        console.warn(`\nWARNING: Expected at least ${expectedCount} records, but found ${finalCounts.new}`);
      } else {
        console.log(`\nSUCCESS: New table has ${finalCounts.new} records (expected around ${expectedCount})`);
      }
      
      // Get a sample record from sources_google2
      const { data: sampleData, error: sampleError } = await supabase
        .from('sources_google2')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('Error getting sample record:', sampleError.message);
      } else if (sampleData && sampleData.length > 0) {
        const record = sampleData[0];
        console.log('\nSample record from sources_google2:');
        console.log(`- ID: ${record.id}`);
        console.log(`- Name: ${record.name}`);
        console.log(`- Path: ${record.path}`);
        console.log(`- Root Drive ID: ${record.root_drive_id}`);
        console.log(`- Parent Folder ID: ${record.parent_folder_id}`);
        console.log(`- Path Array: ${record.path_array ? '[' + record.path_array.join(', ') + ']' : 'null'}`);
        console.log(`- Path Depth: ${record.path_depth}`);
      } else {
        console.warn('No records found in sources_google2');
      }
    } else {
      console.log('\nDRY RUN - Would verify results');
    }
    
    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

main();