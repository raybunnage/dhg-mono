#!/usr/bin/env node

/**
 * Finalize Sources Google Migration Script
 * 
 * This script completes the migration by renaming the tables and 
 * setting up a compatibility view.
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
// Service role key from .env.development
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const force = args.includes('--force');

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

async function checkTableCounts(supabase) {
  try {
    // Check sources_google
    const { count: sgCount, error: sgError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
    
    if (sgError) {
      console.error('Error checking sources_google:', sgError.message);
      return null;
    }
    
    // Check sources_google2
    const { count: sg2Count, error: sg2Error } = await supabase
      .from('sources_google2')
      .select('*', { count: 'exact', head: true });
    
    if (sg2Error) {
      console.error('Error checking sources_google2:', sg2Error.message);
      return null;
    }
    
    return {
      original: sgCount,
      new: sg2Count
    };
  } catch (error) {
    console.error('Error checking table counts:', error);
    return null;
  }
}

async function main() {
  try {
    console.log('Finalizing sources_google migration...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Check table counts
    console.log('\nSTEP 1: Checking table counts...');
    const counts = await checkTableCounts(supabase);
    
    if (!counts) {
      throw new Error('Failed to check table counts');
    }
    
    console.log(`- sources_google: ${counts.original} records`);
    console.log(`- sources_google2: ${counts.new} records`);
    
    // Safety check - warn if sources_google2 has fewer records
    if (counts.new < counts.original && !force) {
      console.warn(`\nWARNING: sources_google2 has ${counts.new} records, which is less than sources_google (${counts.original})`);
      console.warn('This could indicate data loss. Use --force to proceed anyway.');
      console.warn('Exiting without making changes...');
      
      if (!isDryRun) {
        process.exit(1);
      }
    }
    
    // Step 2: Rename tables
    console.log('\nSTEP 2: Renaming tables...');
    
    // 2.1: Rename sources_google to sources_google_deprecated
    const renameOldResult = await executeSql(
      supabase,
      'ALTER TABLE sources_google RENAME TO sources_google_deprecated',
      'Rename sources_google to sources_google_deprecated'
    );
    
    if (!renameOldResult.success) {
      throw new Error('Failed to rename sources_google table');
    }
    
    // 2.2: Rename sources_google2 to sources_google
    const renameNewResult = await executeSql(
      supabase,
      'ALTER TABLE sources_google2 RENAME TO sources_google',
      'Rename sources_google2 to sources_google'
    );
    
    if (!renameNewResult.success) {
      // Try to revert the first rename if possible
      if (!isDryRun) {
        console.error('Error occurred. Attempting to revert first rename...');
        await executeSql(
          supabase,
          'ALTER TABLE sources_google_deprecated RENAME TO sources_google',
          'Revert rename of sources_google'
        );
      }
      
      throw new Error('Failed to rename sources_google2 table');
    }
    
    // Step 3: Create compatibility view
    console.log('\nSTEP 3: Creating compatibility view...');
    
    const createViewResult = await executeSql(
      supabase,
      `CREATE OR REPLACE VIEW sources_google_legacy_view AS
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
          sources_google`,
      'Create compatibility view'
    );
    
    if (!createViewResult.success) {
      console.warn('Warning: Failed to create compatibility view');
    }
    
    // Step 4: Rename indexes
    console.log('\nSTEP 4: Renaming indexes...');
    
    const indexNames = [
      'drive_id', 'root_drive_id', 'parent_folder_id', 
      'mime_type', 'path', 'name', 'document_type_id', 'expert_id'
    ];
    
    for (const idx of indexNames) {
      const renameIndexResult = await executeSql(
        supabase,
        `ALTER INDEX IF EXISTS sources_google2_${idx}_idx RENAME TO sources_google_${idx}_idx`,
        `Rename ${idx} index`
      );
      
      if (!renameIndexResult.success) {
        console.warn(`Warning: Failed to rename index for ${idx}`);
      }
    }
    
    // Step 5: Final verification
    if (!isDryRun) {
      console.log('\nSTEP 5: Verifying migration...');
      
      // Check if sources_google exists
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Error verifying sources_google:', error.message);
      } else {
        console.log(`- sources_google exists with ${count} records`);
      }
      
      // Check if we can access the compatibility view
      try {
        const { data, error: viewError } = await supabase.rpc('execute_sql', {
          sql: 'SELECT COUNT(*) FROM sources_google_legacy_view'
        });
        
        if (viewError) {
          console.warn(`Warning: Compatibility view issue: ${viewError.message}`);
        } else {
          console.log('- Compatibility view accessible');
        }
      } catch (viewError) {
        console.warn(`Warning: Unable to verify compatibility view: ${viewError.message}`);
      }
    } else {
      console.log('DRY RUN - Would verify migration here');
    }
    
    console.log('\nMigration finalization completed successfully!');
    console.log('The sources_google table now uses the new schema.');
    
  } catch (error) {
    console.error('Error finalizing migration:', error);
    process.exit(1);
  }
}

main();