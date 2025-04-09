#\!/usr/bin/env ts-node
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
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Get the current directory where this script is located
const scriptsDir = __dirname;

// Define migration phases
const PHASES = {
  CREATE: 'create_sources_google2.sql',
  PHASE1: 'migrate_sources_google2_phase1.sql',
  PHASE2: 'migrate_sources_google2_phase2.sql',
  VALIDATE: 'validate_sources_google2_migration.sql',
  FINALIZE: 'finalize_sources_google2_migration.sql'
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
    if (\!existsSync(filePath)) {
      throw new Error(`SQL file not found: ${filePath}`);
    }

    // Read the SQL file
    const sql = readFileSync(filePath, 'utf8');
    
    // Get the Supabase client
    const supabase = getSupabaseClient();
    
    // Execute the SQL via the Supabase RPC
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: sql
    });
    
    if (error) {
      throw new Error(`Failed to execute SQL: ${error.message}`);
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
  const { data: originalCount, error: originalError } = await supabase
    .from('sources_google')
    .select('*', { count: 'exact', head: true });
    
  if (originalError) {
    throw new Error(`Failed to get count from sources_google: ${originalError.message}`);
  }
  
  // Check if sources_google2 exists
  const { data: tableExists, error: existsError } = await supabase.rpc('execute_sql', {
    sql: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sources_google2');"
  });
  
  if (existsError) {
    throw new Error(`Failed to check if sources_google2 exists: ${existsError.message}`);
  }
  
  let newCount = 0;
  
  // Get count from new table if it exists
  if (tableExists && tableExists.length > 0 && tableExists[0].exists) {
    const { data: newCountData, error: newError } = await supabase
      .from('sources_google2')
      .select('*', { count: 'exact', head: true });
      
    if (newError) {
      throw new Error(`Failed to get count from sources_google2: ${newError.message}`);
    }
    
    newCount = newCountData?.count || 0;
  }
  
  // Get count of Dynamic Healing files
  const { data: dhgCount, error: dhgError } = await supabase
    .from('sources_google')
    .select('*', { count: 'exact', head: true })
    .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
  if (dhgError) {
    throw new Error(`Failed to get DHG count: ${dhgError.message}`);
  }
  
  return {
    originalCount: originalCount?.count || 0,
    newCount,
    dhgCount: dhgCount?.count || 0,
    tableExists: tableExists && tableExists.length > 0 && tableExists[0].exists
  };
}

// Create command
const program = new Command('migrate-sources-google')
  .description('Migrate sources_google table to an improved sources_google2 schema')
  .option('-c, --create-only', 'Only create the sources_google2 table structure without copying data', false)
  .option('-v, --validate-only', 'Only run the validation without making changes', false)
  .option('-f, --finalize', 'Finalize the migration (rename tables, create view, etc.)', false)
  .option('-d, --dry-run', 'Show what would happen without making changes', false)
  .option('-p, --phase <number>', 'Run a specific phase (1, 2)', null)
  .action(async (options) => {
    try {
      // Load environment variables
      dotenv.config();
      
      // Get initial counts
      const { originalCount, newCount, dhgCount, tableExists } = await getCounts();
      
      console.log('Current database state:');
      console.log(`- sources_google records: ${originalCount}`);
      console.log(`- sources_google2 table exists: ${tableExists}`);
      if (tableExists) {
        console.log(`- sources_google2 records: ${newCount}`);
      }
      console.log(`- Dynamic Healing Group records: ${dhgCount}`);
      console.log('');
      
      // Handle validate-only option
      if (options.validateOnly) {
        if (\!tableExists) {
          console.error('Cannot validate - sources_google2 table does not exist');
          process.exit(1);
        }
        
        console.log('Running validation only...');
        const result = await executeSqlFile(join(scriptsDir, PHASES.VALIDATE));
        console.log('Validation complete\!');
        process.exit(0);
      }
      
      // Handle finalize option
      if (options.finalize) {
        if (\!tableExists) {
          console.error('Cannot finalize - sources_google2 table does not exist');
          process.exit(1);
        }
        
        if (options.dryRun) {
          console.log('Would finalize the migration (dry run)');
          console.log('This would rename sources_google to sources_google_deprecated');
          console.log('And rename sources_google2 to sources_google');
          process.exit(0);
        }
        
        console.log('Finalizing migration...');
        const result = await executeSqlFile(join(scriptsDir, PHASES.FINALIZE));
        console.log('Migration finalized successfully\!');
        process.exit(0);
      }
      
      // Check if sources_google2 already exists when not in dry-run mode
      if (tableExists && \!options.dryRun && \!options.phase) {
        console.error('sources_google2 table already exists. Options:');
        console.error('1. Use --validate-only to check its state');
        console.error('2. Use --finalize to complete the migration');
        console.error('3. Use --phase 1 or --phase 2 to rerun a specific phase');
        console.error('4. Drop the table first if you want to start over');
        process.exit(1);
      }
      
      if (options.dryRun) {
        console.log('Dry run mode - no changes will be made');
      }
      
      // Create only
      if (options.createOnly) {
        if (options.dryRun) {
          console.log('Would create sources_google2 table structure (dry run)');
          process.exit(0);
        }
        
        console.log('Creating sources_google2 table structure...');
        const result = await executeSqlFile(join(scriptsDir, PHASES.CREATE));
        console.log('Table created successfully\!');
        process.exit(0);
      }
      
      // Run specific phase
      if (options.phase) {
        const phase = parseInt(options.phase);
        if (phase \!== 1 && phase \!== 2) {
          console.error('Invalid phase. Use 1 or 2.');
          process.exit(1);
        }
        
        if (options.dryRun) {
          console.log(`Would run phase ${phase} (dry run)`);
          process.exit(0);
        }
        
        if (phase === 1) {
          console.log('Running phase 1: Initial data migration...');
          if (\!tableExists) {
            console.log('Creating sources_google2 table first...');
            await executeSqlFile(join(scriptsDir, PHASES.CREATE));
          }
          await executeSqlFile(join(scriptsDir, PHASES.PHASE1));
          console.log('Phase 1 completed successfully\!');
        } else if (phase === 2) {
          console.log('Running phase 2: Recursive traversal and main_video_id association...');
          await executeSqlFile(join(scriptsDir, PHASES.PHASE2));
          console.log('Phase 2 completed successfully\!');
        }
        
        console.log('Running validation...');
        await executeSqlFile(join(scriptsDir, PHASES.VALIDATE));
        console.log('Phase completed and validated\!');
        process.exit(0);
      }
      
      // Run full migration
      if (options.dryRun) {
        console.log('Would run full migration (dry run):');
        console.log('1. Create sources_google2 table');
        console.log('2. Run phase 1: Initial data migration');
        console.log('3. Run phase 2: Recursive traversal and main_video_id association');
        console.log('4. Validate results');
        console.log('Run without --dry-run to execute');
        process.exit(0);
      }
      
      console.log('Starting full migration...');
      
      // Step 1: Create the new table
      console.log('Step 1: Creating sources_google2 table...');
      await executeSqlFile(join(scriptsDir, PHASES.CREATE));
      
      // Step 2: Run phase 1
      console.log('Step 2: Running phase 1 (initial data migration)...');
      await executeSqlFile(join(scriptsDir, PHASES.PHASE1));
      
      // Validate phase 1
      const afterPhase1 = await getCounts();
      console.log(`After phase 1: ${afterPhase1.newCount} records in sources_google2`);
      
      if (afterPhase1.newCount < originalCount * 0.9) {
        console.error(`Warning: After phase 1, sources_google2 has only ${afterPhase1.newCount} records,`);
        console.error(`which is less than 90% of the original ${originalCount} records.`);
        console.error('This could indicate data loss. Continue with caution\!');
      }
      
      // Step 3: Run phase 2
      console.log('Step 3: Running phase 2 (recursive traversal and main_video_id association)...');
      await executeSqlFile(join(scriptsDir, PHASES.PHASE2));
      
      // Step 4: Validate
      console.log('Step 4: Validating results...');
      await executeSqlFile(join(scriptsDir, PHASES.VALIDATE));
      
      // Final counts
      const afterPhase2 = await getCounts();
      console.log(`\nMigration complete\!`);
      console.log(`- Original records: ${originalCount}`);
      console.log(`- New records: ${afterPhase2.newCount}`);
      
      console.log(`\nNext steps:`);
      console.log(`1. Verify the validation results above`);
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
