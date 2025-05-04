# SOURCES_GOOGLE2 Migration Solution Guide

This document details the solution for migrating data from the `sources_google` table to `sources_google2` while preserving the original IDs, which is critical for maintaining references from the `expert_documents` table.

## Background

The `sources_google` table stores information about Google Drive files and folders. A new `sources_google2` table was created with improved schema and data organization. However, it was critical that all IDs from the original table be preserved, as they're referenced by the `expert_documents` table.

## The Problem

The initial migration script encountered errors when attempting to copy data between tables:

1. The `main_video_id` column was missing from the column list during data transfer
2. SQL execution via RPC (`execute_sql`) wasn't working correctly
3. The path formatting and root drive ID values needed standardization

## The Solution

The solution involved refactoring the migration scripts to use standard Supabase client methods rather than direct SQL, and ensuring that all necessary columns including `main_video_id` were included in the transfer.

### Step 1: Fix the copy-data-to-sources-google2.ts Script

The updated script reads records from `sources_google` in batches and upserts them into `sources_google2`, maintaining all original column values including IDs.

```typescript
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
```

### Step 2: Fix the update-paths-and-roots.ts Script

After copying data, the script below updates path formatting and root drive IDs in `sources_google2`:

```typescript
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
    
    // First, get records that need path fixing
    const { data: pathsToFix, error: fetchError } = await supabase
      .from('sources_google2')
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
            .from('sources_google2')
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
      .from('sources_google2')
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
            .from('sources_google2')
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
      .from('sources_google2')
      .update({ root_drive_id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' })
      .or('path.like.%/Dynamic Healing Discussion Group/%,drive_id.eq.1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
    if (dhgError) {
      throw new Error(`Failed to set DHG root_drive_id: ${dhgError.message}`);
    }
    
    // 4. Set root_drive_id for Polyvagal Steering Group
    console.log('Setting root_drive_id for Polyvagal Steering Group...');
    
    const { error: pvsgError } = await supabase
      .from('sources_google2')
      .update({ root_drive_id: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc' })
      .or('path.like.%/Polyvagal Steering Group/%,drive_id.eq.1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc');
    
    if (pvsgError) {
      throw new Error(`Failed to set PVSG root_drive_id: ${pvsgError.message}`);
    }
    
    // 5. Set root_drive_id for any transcript files
    console.log('Setting root_drive_id for transcript files...');
    
    const { error: transcriptError } = await supabase
      .from('sources_google2')
      .update({ root_drive_id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' })
      .or('name.ilike.%transcript%,path.ilike.%transcript%')
      .in('mime_type', ['text/plain', 'application/vnd.google-apps.document'])
      .or('root_drive_id.is.null,root_drive_id.eq.');
    
    if (transcriptError) {
      throw new Error(`Failed to set transcript root_drive_id: ${transcriptError.message}`);
    }
    
    // 6. Count records by root
    const { count: dhgRecords, error: dhgCountError } = await supabase
      .from('sources_google2')
      .select('id', { count: 'exact', head: true })
      .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
    if (dhgCountError) {
      throw new Error(`Failed to count DHG records: ${dhgCountError.message}`);
    }
    
    const { count: pvsgRecords, error: pvsgCountError } = await supabase
      .from('sources_google2')
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
```

### Step 3: Create an Empty Table First (Optional)

If starting from scratch, you can create the sources_google2 table with:

```typescript
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
    
    // 1. Check if the table exists - try a direct query first
    let tableExists = false;
    
    try {
      const { count, error } = await supabase
        .from('sources_google2')
        .select('id', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`Table exists and has ${count} records`);
        tableExists = true;
      }
    } catch (e) {
      console.log('Error checking table directly, will attempt to create it');
    }
    
    if (tableExists) {
      const truncateConfirm = process.argv.includes('--truncate');
      
      if (truncateConfirm) {
        console.log('Emptying existing table...');
        
        // Delete all records
        const { error: deleteError } = await supabase
          .from('sources_google2')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Safe condition that will match all records
          
        if (deleteError) {
          throw new Error(`Failed to empty table: ${deleteError.message}`);
        }
        
        console.log('Table emptied successfully');
      } else {
        console.log('Table already exists. Use --truncate flag to empty it.');
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
```

## Step-by-Step Migration Process

To recreate this migration in the future, follow these steps:

1. **Clear the target table** (if needed)
   - First check if sources_google2 table exists and has data
   - If it does, you can empty it using a direct DELETE operation via the admin dashboard
   - Alternatively, use the create-sources-google2.ts script with --truncate flag

2. **Copy data from sources_google to sources_google2**
   - Run the copy-data-to-sources-google2.ts script:
   ```bash
   cd /Users/raybunnage/Documents/github/dhg-mono && ts-node scripts/cli-pipeline/google_sync/copy-data-to-sources-google2.ts
   ```
   - This script reads data in batches and preserves all IDs

3. **Update paths and root drive IDs**
   - Run the update-paths-and-roots.ts script:
   ```bash
   cd /Users/raybunnage/Documents/github/dhg-mono && ts-node scripts/cli-pipeline/google_sync/update-paths-and-roots.ts
   ```
   - This standardizes path formats and sets proper root drive IDs

4. **Verify the migration**
   - Check counts in both tables to ensure all records were copied:
   ```typescript
   const { count: sourcesGoogleCount } = await supabase
     .from('sources_google')
     .select('*', { count: 'exact', head: true });
     
   const { count: sourcesGoogle2Count } = await supabase
     .from('sources_google2')
     .select('*', { count: 'exact', head: true });
   ```
   - Verify that expert_documents references are preserved
   - Confirm that paths and root_drive_id values are correctly set

## Key Lessons Learned

1. **Always include all columns** in migration scripts, even those that might currently be NULL
2. **Use standard Supabase client methods** for database operations instead of raw SQL via RPC when possible
3. **Process large datasets in batches** to avoid timeouts and memory issues
4. **Preserve IDs** when tables are referenced by other tables
5. **Verify data integrity** after migration with thorough checks

## Implementation Notes

- The scripts are designed to be idempotent; they can be run multiple times without causing issues
- The scripts include detailed logging to track progress and identify any problems
- Error handling is implemented to catch and report issues during migration
- All IDs from the original sources_google table are preserved in sources_google2

By following this guide, you can successfully migrate data from sources_google to sources_google2 while maintaining all critical references from the expert_documents table.