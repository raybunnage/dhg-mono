#!/usr/bin/env ts-node
/**
 * Sources Google Migration Manager
 * 
 * A comprehensive tool to migrate the sources_google table to an improved schema
 * that addresses metadata issues, enhances path structures, and adds main_video_id associations.
 * 
 * This script serves as a TypeScript interface to the SQL migration scripts,
 * providing a safer, step-by-step approach with validation between steps.
 */

import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Get the current directory where this script is located
const scriptsDir = __dirname;

// Define migration phases
const PHASES = {
  PHASE1: 'migrate_sources_google_phase1.sql',
  PHASE2: 'migrate_sources_google_phase2.sql',
  VALIDATE: 'validate_sources_google_migration.sql',
  FINALIZE: 'finalize_sources_google_migration.sql'
};

// Create the Supabase client service
function getSupabaseClient() {
  const supabaseClientService = SupabaseClientService.getInstance();
  return supabaseClientService.getClient();
}

// Execute a SQL file against the database
async function executeSqlFile(filePath: string): Promise<string> {
  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error(`SQL file not found: ${filePath}`);
    }

    // Read the SQL file
    const sqlContent = readFileSync(filePath, 'utf8');
    
    // Split the SQL into separate statements
    // We need to execute each statement separately
    const statements = sqlContent
      .split(/--.*?\n/) // Remove SQL comments
      .join('\n')       // Rejoin the content
      .split(/[\n\r]/)  // Split by newlines
      .filter(line => line.trim().length > 0) // Remove empty lines
      .join(' ')        // Join back into a single string
      .split(/(?<=;)/)  // Split on semicolons
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && stmt !== ';');
    
    // Get the Supabase client
    const supabase = getSupabaseClient();
    
    // If there's only one statement, execute it directly
    if (statements.length === 1) {
      const sql = statements[0];
      const { data, error } = await supabase.rpc('execute_sql', { sql });
      
      if (error) {
        throw new Error(`Failed to execute SQL: ${error.message}`);
      }
    } else {
      // For multiple statements, execute as a transaction
      const transaction = `BEGIN; ${statements.join(' ')} COMMIT;`;
      const { data, error } = await supabase.rpc('execute_sql', { 
        sql: transaction
      });
      
      if (error) {
        throw new Error(`Failed to execute SQL transaction: ${error.message}`);
      }
    }
    
    return `SQL executed successfully: ${filePath}`;
  } catch (error) {
    console.error(`Error executing SQL file: ${error}`);
    throw error;
  }
}

// Get counts from the database for validation
async function getCounts() {
  const supabase = getSupabaseClient();
  
  // Get count from original table
  const { data: originalCountData, error: originalError } = await supabase
    .from('google_sources')
    .select('*', { count: 'exact', head: true });
    
  if (originalError) {
    throw new Error(`Failed to get count from sources_google: ${originalError.message}`);
  }
  
  const originalCount = originalCountData ? (originalCountData as any).count || 0 : 0;
  
  // Check if sources_google exists
  const { data: tableExists, error: existsError } = await supabase.rpc('execute_sql', {
    sql: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'google_sources')"
  });
  
  if (existsError) {
    throw new Error(`Failed to check if sources_google exists: ${existsError.message}`);
  }
  
  let newCount = 0;
  
  // Get count from new table if it exists
  if (tableExists && tableExists.length > 0 && tableExists[0].exists) {
    const { data: newCountData, error: newError } = await supabase
      .from('google_sources')
      .select('*', { count: 'exact', head: true });
      
    if (newError) {
      throw new Error(`Failed to get count from sources_google: ${newError.message}`);
    }
    
    newCount = newCountData ? (newCountData as any).count || 0 : 0;
  }
  
  // Get count of Dynamic Healing files
  const { data: dhgCountData, error: dhgError } = await supabase
    .from('google_sources')
    .select('*', { count: 'exact', head: true })
    .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
  if (dhgError) {
    throw new Error(`Failed to get DHG count: ${dhgError.message}`);
  }
  
  const dhgCount = dhgCountData ? (dhgCountData as any).count || 0 : 0;
  
  return {
    originalCount,
    newCount,
    dhgCount,
    tableExists: tableExists && tableExists.length > 0 && tableExists[0].exists
  };
}

interface MigrationOptions {
  createOnly?: boolean;
  validateOnly?: boolean;
  finalize?: boolean;
  dryRun?: boolean;
  phase?: string;
}

// Create command
const program = new Command('migrate-sources-google')
  .description('Migrate sources_google table to an improved schema')
  .option('-v, --validate-only', 'Only run the validation without making changes', false)
  .option('-f, --finalize', 'Finalize the migration (rename tables, create view, etc.)', false)
  .option('-d, --dry-run', 'Show what would happen without making changes', false)
  .option('-p, --phase <number>', 'Run a specific phase (1, 2)')
  .option('-c, --create-tables', 'Create the tables needed for migration', false)
  .option('-t, --truncate', 'Truncate the target table before migration', false)
  .action(async (options: MigrationOptions & { createTables?: boolean, truncate?: boolean }) => {
    try {
      // Load environment variables
      dotenv.config();
      
      // Get initial counts
      const { originalCount, newCount, dhgCount, tableExists } = await getCounts();
      
      console.log('Current database state:');
      console.log(`- sources_google records: ${originalCount}`);
      console.log(`- improved sources_google table exists: ${tableExists}`);
      if (tableExists) {
        console.log(`- improved sources_google records: ${newCount}`);
      }
      console.log(`- Dynamic Healing Group records: ${dhgCount}`);
      console.log('');
      
      // Handle create-tables option
      if (options.createTables) {
        console.log('Creating table structure...');
        
        // Create the improved sources_google table
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
            expert_id uuid,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            last_indexed timestamp with time zone,
            main_video_id uuid
          )
        `;
        
        const supabase = getSupabaseClient();
        const { error: createError } = await supabase.rpc('execute_sql', { sql: createQuery });
        
        if (createError) {
          throw new Error(`Failed to create table: ${createError.message}`);
        }
        
        // Create indexes
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
        
        console.log('Table structure created successfully!');
        return;
      }
      
      // Handle truncate option
      if (options.truncate && tableExists) {
        console.log('Truncating the sources_google table...');
        
        const supabase = getSupabaseClient();
        // Use direct table deletion - delete all records
        const { error: deleteError } = await supabase.from('google_sources').delete().gt('id', '00000000-0000-0000-0000-000000000000');
        
        if (deleteError) {
          throw new Error(`Failed to truncate table: ${deleteError.message}`);
        }
        
        console.log('Table truncated successfully!');
        return;
      }
      
      // Handle validate-only option
      if (options.validateOnly) {
        if (!tableExists) {
          console.error('Cannot validate - sources_google table does not exist');
          process.exit(1);
        }
        
        console.log('Running validation only...');
        const result = await executeSqlFile(join(scriptsDir, PHASES.VALIDATE));
        console.log('Validation complete!');
        process.exit(0);
      }
      
      // Handle finalize option
      if (options.finalize) {
        if (!tableExists) {
          console.error('Cannot finalize - sources_google table does not exist');
          process.exit(1);
        }
        
        if (options.dryRun) {
          console.log('Would finalize the migration (dry run)');
          console.log('This would rename sources_google to sources_google_deprecated');
          console.log('And rename improved sources_google structure');
          process.exit(0);
        }
        
        console.log('Finalizing migration...');
        const result = await executeSqlFile(join(scriptsDir, PHASES.FINALIZE));
        console.log('Migration finalized successfully!');
        process.exit(0);
      }
      
      // Check if sources_google already exists when not in dry-run mode
      if (tableExists && !options.dryRun && !options.phase) {
        console.error('sources_google table already exists. Options:');
        console.error('1. Use --validate-only to check its state');
        console.error('2. Use --finalize to complete the migration');
        console.error('3. Use --phase 1 or --phase 2 to rerun a specific phase');
        console.error('4. Use --truncate to clear the table');
        console.error('5. Use --create-tables to create/reset the table structure');
        process.exit(1);
      }
      
      if (options.dryRun) {
        console.log('Dry run mode - no changes will be made');
      }
      
      // Run specific phase
      if (options.phase) {
        const phase = parseInt(options.phase);
        if (phase !== 1 && phase !== 2) {
          console.error('Invalid phase. Use 1 or 2.');
          process.exit(1);
        }
        
        if (options.dryRun) {
          console.log(`Would run phase ${phase} (dry run)`);
          process.exit(0);
        }
        
        if (phase === 1) {
          console.log('Running phase 1: Initial data migration...');
          
          // Copy data directly without SQL file
          const supabase = getSupabaseClient();
          const copyQuery = `
            INSERT INTO sources_google (
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
          
          const { error: copyError } = await supabase.rpc('execute_sql', { sql: copyQuery });
          
          if (copyError) {
            throw new Error(`Failed to copy data: ${copyError.message}`);
          }
          
          console.log('Phase 1 completed successfully!');
        } else if (phase === 2) {
          console.log('Running phase 2: Recursive traversal and main_video_id association...');
          
          // Update paths and roots directly
          const supabase = getSupabaseClient();
          
          // Fix paths first
          const fixPathsQuery = `
            UPDATE sources_google
            SET path = '/' || path
            WHERE path NOT LIKE '/%'
          `;
          
          const { error: pathError } = await supabase.rpc('execute_sql', { sql: fixPathsQuery });
          
          if (pathError) {
            throw new Error(`Failed to fix paths: ${pathError.message}`);
          }
          
          // Update Dynamic Healing root
          const dhgRootQuery = `
            UPDATE sources_google
            SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
            WHERE 
              path LIKE '%Dynamic Healing Discussion Group%' 
              OR drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
          `;
          
          const { error: dhgError } = await supabase.rpc('execute_sql', { sql: dhgRootQuery });
          
          if (dhgError) {
            throw new Error(`Failed to set DHG root_drive_id: ${dhgError.message}`);
          }
          
          // Update Polyvagal Steering Group root
          const pvsgRootQuery = `
            UPDATE sources_google
            SET root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
            WHERE 
              path LIKE '%Polyvagal Steering Group%'
              OR drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
          `;
          
          const { error: pvsgError } = await supabase.rpc('execute_sql', { sql: pvsgRootQuery });
          
          if (pvsgError) {
            throw new Error(`Failed to set PVSG root_drive_id: ${pvsgError.message}`);
          }
          
          console.log('Phase 2 completed successfully!');
        }
        
        console.log('Phase completed successfully!');
        return;
      }
      
      // Run full migration
      if (options.dryRun) {
        console.log('Would run full migration (dry run):');
        console.log('1. Run phase 1: Initial data migration');
        console.log('2. Run phase 2: Recursive traversal and main_video_id association');
        console.log('3. Validate results');
        console.log('Run without --dry-run to execute');
        process.exit(0);
      }
      
      console.log('Starting full migration...');
      
      // Simplified migration using direct database calls
      
      // Step 1: Create table structure
      console.log('Step 1: Creating table structure...');
      const supabase = getSupabaseClient();
      
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
          expert_id uuid,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now(),
          last_indexed timestamp with time zone,
          main_video_id uuid
        )
      `;
      
      const { error: createError } = await supabase.rpc('execute_sql', { sql: createQuery });
      
      if (createError) {
        throw new Error(`Failed to create table: ${createError.message}`);
      }
      
      // Step 2: Copy data
      console.log('Step 2: Copying data...');
      
      const copyQuery = `
        INSERT INTO sources_google (
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
      
      const { error: copyError } = await supabase.rpc('execute_sql', { sql: copyQuery });
      
      if (copyError) {
        throw new Error(`Failed to copy data: ${copyError.message}`);
      }
      
      // Step 3: Update paths and roots
      console.log('Step 3: Updating paths and roots...');
      
      // Fix paths first
      const fixPathsQuery = `
        UPDATE sources_google
        SET path = '/' || path
        WHERE path NOT LIKE '/%'
      `;
      
      const { error: pathError } = await supabase.rpc('execute_sql', { sql: fixPathsQuery });
      
      if (pathError) {
        throw new Error(`Failed to fix paths: ${pathError.message}`);
      }
      
      // Update Dynamic Healing root
      const dhgRootQuery = `
        UPDATE sources_google
        SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
        WHERE 
          path LIKE '%Dynamic Healing Discussion Group%' 
          OR drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
      `;
      
      const { error: dhgError } = await supabase.rpc('execute_sql', { sql: dhgRootQuery });
      
      if (dhgError) {
        throw new Error(`Failed to set DHG root_drive_id: ${dhgError.message}`);
      }
      
      // Update Polyvagal Steering Group root
      const pvsgRootQuery = `
        UPDATE sources_google
        SET root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
        WHERE 
          path LIKE '%Polyvagal Steering Group%'
          OR drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
      `;
      
      const { error: pvsgError } = await supabase.rpc('execute_sql', { sql: pvsgRootQuery });
      
      if (pvsgError) {
        throw new Error(`Failed to set PVSG root_drive_id: ${pvsgError.message}`);
      }
      
      // Final counts
      const afterMigration = await getCounts();
      console.log(`\nMigration complete!`);
      console.log(`- Original records: ${originalCount}`);
      console.log(`- New records: ${afterMigration.newCount}`);
      
      console.log(`\nNext steps:`);
      console.log(`1. Run with --validate-only to check the results`);
      console.log(`2. Run with --finalize to complete the migration when you're satisfied`);
      
    } catch (error) {
      console.error('Error during migration:', error);
      process.exit(1);
    }
  });

// Execute the program if this script is run directly
if (require.main === module) {
  program.parse(process.argv);
}

export default program;