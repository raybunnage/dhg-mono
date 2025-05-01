#!/usr/bin/env node

/**
 * Direct Copy Script for DHG Records
 * 
 * This script directly pulls records from sources_google that match
 * the Dynamic Healing Discussion Group pattern and creates new records in sources_google
 * with the proper structure.
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

// Target root folder IDs and names
const ROOT_FOLDERS = {
  DHG: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',  // Dynamic Healing Discussion Group
  PVSG: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'  // Polyvagal Steering Group
};

const ROOT_NAMES = {
  DHG: 'Dynamic Healing Discussion Group',
  PVSG: 'Polyvagal Steering Group'
};

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const onlyDHG = args.includes('--only-dhg');
const onlyPVSG = args.includes('--only-pvsg');
const skipCreate = args.includes('--skip-create');
const batchSize = 100; // Number of records to process at once

async function main() {
  try {
    console.log('Starting DIRECT copy from sources_google to sources_google...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    // Filter logic
    if (onlyDHG && onlyPVSG) {
      console.error('Cannot specify both --only-dhg and --only-pvsg');
      process.exit(1);
    }
    
    let targetRootId = null;
    let targetRootPattern = null;
    let targetName = 'all folders';
    
    if (onlyDHG) {
      targetRootId = ROOT_FOLDERS.DHG;
      targetRootPattern = '%Dynamic Healing Discussion Group%';
      targetName = 'Dynamic Healing Discussion Group';
    } else if (onlyPVSG) {
      targetRootId = ROOT_FOLDERS.PVSG;
      targetRootPattern = '%Polyvagal Steering Group%';
      targetName = 'Polyvagal Steering Group';
    }
    
    console.log(`Target: ${targetName}`);
    
    // Get Supabase client from singleton service
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Step 1: Check if tables exist
    console.log('\nSTEP 1: Checking tables...');
    let sourceRecords = 0;
    let targetRecords = 0;
    let dhgRecords = 0;
    let pvsgRecords = 0;
    
    // Check sources_google
    try {
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        throw new Error(`Error checking sources_google: ${error.message}`);
      }
      
      sourceRecords = count;
      console.log(`- sources_google table has ${sourceRecords} records`);
      
      // Check for DHG records by root_drive_id
      const { count: dhgCount, error: dhgError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
      
      if (!dhgError) {
        dhgRecords = dhgCount;
        console.log(`- sources_google has ${dhgRecords} Dynamic Healing Discussion Group records (by root_drive_id)`);
      }
      
      // Also check by path for comparison
      const { count: dhgPathCount, error: dhgPathError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .ilike('path', '%Dynamic Healing Discussion Group%');
      
      if (!dhgPathError) {
        console.log(`- sources_google has ${dhgPathCount} records with DHG in path`);
      }
      
      // Check for PVSG records by path
      const { count: pvsgCount, error: pvsgError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .ilike('path', '%Polyvagal Steering Group%');
      
      if (!pvsgError) {
        pvsgRecords = pvsgCount;
        console.log(`- sources_google has ${pvsgRecords} Polyvagal Steering Group records`);
      }
    } catch (error) {
      console.error(`Error checking sources_google: ${error.message}`);
      process.exit(1);
    }
    
    // Check sources_google
    try {
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('- sources_google table does not exist yet');
        } else {
          throw new Error(`Error checking sources_google: ${error.message}`);
        }
      } else {
        targetRecords = count;
        console.log(`- sources_google table has ${targetRecords} records`);
      }
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('- sources_google table does not exist yet');
      } else {
        console.error(`Error checking sources_google: ${error.message}`);
      }
    }
    
    // Step 2: Create the sources_google table structure using direct schema manipulation
    if (!skipCreate) {
      console.log('\nSTEP 2: Creating sources_google table structure...');
      
      if (isDryRun) {
        console.log('DRY RUN - Would create sources_google table');
      } else {
        try {
          // Use direct schema manipulation to create the table
          const { error } = await supabase.schema('public').createTable('sources_google', [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'text', notNull: true },
            { name: 'mime_type', type: 'text' },
            { name: 'drive_id', type: 'text', notNull: true },
            { name: 'root_drive_id', type: 'text' },
            { name: 'parent_folder_id', type: 'text' },
            { name: 'path', type: 'text' },
            { name: 'is_root', type: 'boolean', default: false },
            { name: 'path_array', type: 'text[]' },
            { name: 'path_depth', type: 'integer' },
            { name: 'is_deleted', type: 'boolean', default: false },
            { name: 'metadata', type: 'jsonb' },
            { name: 'size', type: 'bigint' },
            { name: 'modified_time', type: 'timestamp with time zone' },
            { name: 'web_view_link', type: 'text' },
            { name: 'thumbnail_link', type: 'text' },
            { name: 'content_extracted', type: 'boolean', default: false },
            { name: 'extracted_content', type: 'text' },
            { name: 'document_type_id', type: 'uuid' },
            { name: 'expert_id', type: 'uuid' },
            { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
            { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
            { name: 'last_indexed', type: 'timestamp with time zone' },
            { name: 'main_video_id', type: 'uuid' }
          ]);
          
          if (error) {
            if (error.message.includes('already exists')) {
              console.log('- Table already exists, using existing structure');
            } else {
              throw new Error(`Failed to create table: ${error.message}`);
            }
          } else {
            console.log('- Table created successfully');
          }
        } catch (error) {
          console.error(`Error creating table: ${error.message}`);
          
          // Continue anyway, as the table might exist but with an incompatible error message
          console.log('- Continuing with existing table or will attempt direct copies...');
        }
      }
    } else {
      console.log('\nSTEP 2: Skipping table creation (--skip-create specified)');
    }
    
    // Step 3: Fetch DHG records from sources_google and copy to sources_google
    console.log('\nSTEP 3: Copying records...');
    
    if (isDryRun) {
      console.log(`DRY RUN - Would copy records from sources_google to sources_google`);
      
      if (targetRootPattern) {
        console.log(`- Would copy records matching path ILIKE '${targetRootPattern}'`);
        console.log(`- Would set root_drive_id to '${targetRootId}'`);
      } else {
        console.log('- Would copy records matching both DHG and PVSG patterns');
      }
    } else {
      // First, clear out any existing records if we're not skipping create
      if (!skipCreate) {
        try {
          const { error: clearError } = await supabase
            .from('sources_google')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (clearError) {
            console.warn(`Warning: Failed to clear existing records: ${clearError.message}`);
          }
        } catch (error) {
          console.warn(`Warning: Error clearing existing records: ${error.message}`);
        }
      }
      
      // Now fetch and copy records in batches
      let offset = 0;
      let totalCopied = 0;
      let hasMore = true;
      
      // Prepare the query
      let baseQuery = supabase.from('sources_google').select('*');
      
      if (targetRootId) {
        // Use root_drive_id for more accurate filtering
        baseQuery = baseQuery.eq('root_drive_id', targetRootId);
      } else if (targetRootPattern) {
        // Fall back to path pattern if needed
        baseQuery = baseQuery.ilike('path', targetRootPattern);
      }
      
      console.log('- Copying records in batches...');
      
      while (hasMore) {
        // Fetch a batch of records
        const query = baseQuery.range(offset, offset + batchSize - 1);
        const { data, error } = await query;
        
        if (error) {
          throw new Error(`Failed to fetch records: ${error.message}`);
        }
        
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }
        
        console.log(`- Processing batch of ${data.length} records (offset ${offset})...`);
        
        // Transform records to match the new schema
        const transformedRecords = data.map(record => {
          let rootDriveId = record.root_drive_id;
          
          // Set the appropriate root_drive_id based on pattern matching
          if (record.path) {
            if (record.path.includes('Dynamic Healing Discussion Group')) {
              rootDriveId = ROOT_FOLDERS.DHG;
            } else if (record.path.includes('Polyvagal Steering Group')) {
              rootDriveId = ROOT_FOLDERS.PVSG;
            }
          }
          
          // Generate a default path if none exists
          let path = record.path;
          if (!path) {
            // Use the appropriate root folder name based on root_drive_id
            const rootName = rootDriveId === ROOT_FOLDERS.DHG 
              ? ROOT_NAMES.DHG 
              : (rootDriveId === ROOT_FOLDERS.PVSG ? ROOT_NAMES.PVSG : 'Unknown');
            path = `/${rootName}/${record.name || 'unnamed_file'}`;
          }
          
          // Only include specific fields
          return {
            id: record.id,
            name: record.name,
            mime_type: record.mime_type,
            drive_id: record.drive_id,
            root_drive_id: rootDriveId,
            parent_folder_id: record.parent_id, // Note the rename
            path: path,
            is_root: record.is_root || false,
            path_array: path ? path.split('/').filter(p => p) : [record.name || 'unnamed_file'],
            path_depth: path ? path.split('/').filter(p => p).length : 1,
            is_deleted: record.deleted || false, // Note the rename
            metadata: record.metadata,
            size: record.size || record.size_bytes || (record.metadata?.size ? parseInt(record.metadata.size) : null),
            modified_time: record.modified_time,
            web_view_link: record.web_view_link,
            thumbnail_link: record.thumbnail_link,
            content_extracted: record.content_extracted || false,
            extracted_content: record.extracted_content,
            document_type_id: record.document_type_id,
            expert_id: record.expert_id,
            created_at: record.created_at,
            updated_at: record.updated_at,
            last_indexed: record.last_indexed
          };
        });
        
        // Filter records to only include those with matching patterns
        const filteredRecords = transformedRecords.filter(record => {
          if (!targetRootPattern) {
            // If no specific target, include both DHG and PVSG
            return (
              record.path && (
                record.path.includes('Dynamic Healing Discussion Group') ||
                record.path.includes('Polyvagal Steering Group')
              )
            );
          }
          
          // Otherwise, only include records matching the target pattern
          return true; // Already filtered by the query
        });
        
        if (filteredRecords.length > 0) {
          // Insert the transformed records into sources_google
          const { error: insertError } = await supabase
            .from('sources_google')
            .upsert(filteredRecords);
          
          if (insertError) {
            throw new Error(`Failed to insert records: ${insertError.message}`);
          }
          
          totalCopied += filteredRecords.length;
          console.log(`- Copied ${filteredRecords.length} records (total: ${totalCopied})`);
        }
        
        offset += data.length;
        
        // Check if we've reached the end
        if (data.length < batchSize) {
          hasMore = false;
        }
      }
      
      console.log(`- Successfully copied ${totalCopied} records to sources_google`);
    }
    
    // Step 4: Verify the results
    if (!isDryRun) {
      console.log('\nSTEP 4: Verifying results...');
      
      try {
        // Count the records in sources_google
        const { count: finalCount, error: countError } = await supabase
          .from('sources_google')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          throw new Error(`Failed to count records: ${countError.message}`);
        }
        
        console.log(`- sources_google now has ${finalCount} records`);
        
        // Get a sample record
        const { data: sampleData, error: sampleError } = await supabase
          .from('sources_google')
          .select('*')
          .limit(1);
        
        if (sampleError) {
          console.warn(`Warning: Failed to get sample record: ${sampleError.message}`);
        } else if (sampleData && sampleData.length > 0) {
          const record = sampleData[0];
          console.log('\nSample record:');
          console.log(`- ID: ${record.id}`);
          console.log(`- Name: ${record.name}`);
          console.log(`- Path: ${record.path}`);
          console.log(`- Root Drive ID: ${record.root_drive_id}`);
          console.log(`- Parent Folder ID: ${record.parent_folder_id}`);
          
          // Check if record has path_array
          if (record.path_array) {
            console.log(`- Path Array: [${record.path_array.join(', ')}]`);
            console.log(`- Path Depth: ${record.path_depth}`);
          } else {
            console.log('- Path Array: not set');
          }
        } else {
          console.warn('No records found in sources_google');
        }
        
        // Check the expected counts
        let expectedCount = 0;
        if (onlyDHG) {
          expectedCount = dhgRecords;
        } else if (onlyPVSG) {
          expectedCount = pvsgRecords;
        } else {
          expectedCount = dhgRecords + pvsgRecords;
        }
        
        if (finalCount < expectedCount * 0.8) { // Allow for some filtering variations
          console.warn(`\nWARNING: sources_google has ${finalCount} records, which is fewer than expected (${expectedCount})`);
          console.warn('This might indicate that some records were not properly copied.');
        } else {
          console.log(`\nSUCCESS: sources_google has ${finalCount} records (expected approximately ${expectedCount})`);
        }
      } catch (error) {
        console.error(`Error verifying results: ${error.message}`);
      }
    } else {
      console.log('\nDRY RUN - Would verify the results');
    }
    
    console.log('\nCopy operation completed!');
    
  } catch (error) {
    console.error('Error during copy operation:', error);
    process.exit(1);
  }
}

main();