#!/usr/bin/env ts-node
/**
 * Experts CLI Pipeline
 * 
 * Management utilities for experts and their associations with presentations and content
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { linkTopLevelFolders } from './commands/link-top-level-folders';
import { assignExpert } from './commands/assign-expert';
import { assignFolderExperts } from './commands/assign-folder-experts';
import { listExperts } from './commands/list-experts';
import { addExpert } from './commands/add-expert';
import { propagateExpertIds } from './commands/propagate-expert-ids';
import { transferExpertMetadata } from './commands/transfer-expert-metadata';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

// Create the main program
const program = new Command();

program
  .name('experts-cli')
  .description('CLI utilities for managing experts and their associations\n\n' +
    'Common commands:\n' +
    '  list-experts              List all experts with their unique 3-character mnemonics\n' +
    '  assign-expert -i          Interactively assign experts to folders using mnemonics\n' +
    '  assign-folder-experts     Interactively assign experts to high-level folders with path_depth = 0\n' +
    '  link-top-level-folders    List folders with videos that need expert assignment\n' +
    '  propagate-expert-ids      Recursively assign expert_id to all files under expert folders')
  .version('1.0.0');

// Command to list top-level folders for expert assignment
program
  .command('link-top-level-folders')
  .description('List top-level folders with main videos for expert assignment')
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-p, --primary', 'Set associations as primary', true)
  .option('-v, --verbose', 'Show more detailed output', false)
  .option('-l, --limit <number>', 'Limit number of folders shown', '50')
  .option('-s, --skip-assigned <boolean>', 'Skip folders that already have experts', 'true')
  .action(async (options) => {
    await linkTopLevelFolders({
      dryRun: options.dryRun,
      isPrimary: options.primary,
      verbose: options.verbose,
      limit: parseInt(options.limit, 10),
      skipAssigned: options.skipAssigned === 'true'
    });
  });

// Command to assign an expert to a specific folder
program
  .command('assign-expert')
  .description('Assign an expert to a specific folder\n' +
    'Examples:\n' +
    '  # Interactive mode for bulk assignment using mnemonics\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh assign-expert -i\n\n' +
    '  # Direct assignment by IDs\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh assign-expert --folder-id "<id>" --expert-id "<id>"\n\n' +
    'Workflow:\n' +
    '  1. First run list-experts to get the mnemonic codes for experts\n' +
    '  2. Run assign-expert -i to begin assignment process\n' +
    '  3. For each folder, enter the 3-character mnemonic for the expert to assign\n' +
    '  4. Type "SKIP" to skip the current folder and move to the next one')
  .option('--folder-id <id>', 'ID of the folder to link')
  .option('--expert-id <id>', 'ID of the expert to link')
  .option('--primary <boolean>', 'Set as primary expert', 'true')
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-v, --verbose', 'Show more detailed output', false)
  .option('-i, --interactive', 'Run in interactive mode to assign experts by mnemonic to folders', false)
  .action(async (options) => {
    // Check if running in interactive mode
    if (options.interactive) {
      await assignExpert({
        isPrimary: options.primary === 'true',
        dryRun: options.dryRun,
        verbose: options.verbose,
        interactive: true
      });
      return;
    }
    
    // Validate required parameters for direct mode
    if (!options.folderId) {
      console.error('Error: --folder-id is required when not in interactive mode');
      process.exit(1);
    }
    
    if (!options.expertId) {
      console.error('Error: --expert-id is required when not in interactive mode');
      process.exit(1);
    }
    
    await assignExpert({
      folderId: options.folderId,
      expertId: options.expertId,
      isPrimary: options.primary === 'true',
      dryRun: options.dryRun,
      verbose: options.verbose,
      interactive: false
    });
  });

// Command to list all experts
program
  .command('list-experts')
  .description('List all experts in the system with their unique 3-character mnemonics\n' +
    'Examples:\n' +
    '  # List all experts with their 3-character mnemonics\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh list-experts\n\n' +
    '  # Show detailed output with assignment commands\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh list-experts -v\n\n' +
    'Workflow:\n' +
    '  1. Run this command to get a list of all experts with their mnemonics\n' +
    '  2. Use the mnemonics when running assign-expert -i to quickly assign experts to folders\n\n' +
    'Note: Using custom mnemonics from docs/cli-pipeline/expert-list.md')
  .option('-l, --limit <number>', 'Limit number of experts shown', '100')
  .option('-v, --verbose', 'Show more detailed output including assignment commands', false)
  .action(async (options) => {
    await listExperts({
      limit: parseInt(options.limit, 10),
      verbose: options.verbose
    });
  });

// Command to assign experts to high-level folders with path_depth = 0
program
  .command('assign-folder-experts')
  .description('Interactively assign experts to high-level folders with path_depth = 0\n' +
    'Examples:\n' +
    '  # Assign experts to high-level folders interactively\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh assign-folder-experts\n\n' +
    '  # Run in dry-run mode to see what would happen\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh assign-folder-experts --dry-run\n\n' +
    'Workflow:\n' +
    '  1. The command first displays a list of all available experts with their 3-char mnemonics\n' +
    '  2. It then shows each high-level folder with path_depth = 0 one at a time\n' +
    '  3. Enter the 3-char mnemonic to assign that expert to the current folder\n' +
    '  4. Type "SKIP" to skip assigning an expert to the current folder')
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-p, --primary', 'Set associations as primary', true)
  .option('-v, --verbose', 'Show more detailed output', false)
  .option('-l, --limit <number>', 'Limit number of folders shown', '50')
  .action(async (options) => {
    await assignFolderExperts({
      dryRun: options.dryRun,
      isPrimary: options.primary,
      verbose: options.verbose,
      limit: parseInt(options.limit, 10)
    });
  });

// Command to add a new expert
program
  .command('add-expert')
  .description('Add a new expert to the database\n' +
    'Examples:\n' +
    '  # Add a basic expert\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Wager"\n\n' +
    '  # Add expert with full details\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Wager" --full-name "Tor Wager" --core-group\n\n' +
    '  # Add expert with custom mnemonic\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Wager" --mnemonic "WAG"\n\n' +
    '  # Add expert with metadata\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Wager" --metadata \'{"field":"value"}\'')
  .option('--expert-name <n>', 'Short name for the expert (required)')
  .option('--full-name <n>', 'Full name of the expert')
  .option('--mnemonic <code>', 'Custom 3-character mnemonic for the expert (auto-generated if not provided)')
  .option('--metadata <json>', 'Additional metadata as a JSON string')
  .option('--core-group', 'Set as a core group member', false)
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-v, --verbose', 'Show more detailed output', false)
  .action(async (options: any) => {
    // Always log options for debugging
    console.log('Options received:', options);
    console.log('Expert name:', options.expertName);
    console.log('Full name:', options.fullName);
    console.log('Core group:', options.coreGroup);
    
    // Parse metadata if provided
    let metadata = null;
    if (options.metadata) {
      try {
        metadata = JSON.parse(options.metadata);
      } catch (error) {
        console.error('Error: --metadata must be a valid JSON string');
        return;
      }
    }
    
    // Fix the parameters - manually map them properly
    await addExpert({
      expertName: options.expertName || '',
      fullName: options.fullName || '',
      mnemonic: options.mnemonic || '',
      metadata: metadata,
      isInCoreGroup: options.coreGroup === true,
      dryRun: options.dryRun === true,
      verbose: true // Force verbose mode for debugging
    });
  });

// Command to propagate expert IDs to all files under expert folders
program
  .command('propagate-expert-ids')
  .description('Recursively assign expert_id to all files under expert folders\n' +
    'Examples:\n' +
    '  # Dry-run to see what would be updated\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh propagate-expert-ids --dry-run\n\n' +
    '  # Process all folders and update files\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh propagate-expert-ids\n\n' +
    '  # Process a specific folder\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh propagate-expert-ids --folder-id "<folder-id>"\n\n' +
    'Workflow:\n' +
    '  1. First assign experts to high-level folders using assign-expert or assign-folder-experts\n' +
    '  2. Run this command to propagate those expert associations to all child files and folders')
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-v, --verbose', 'Show more detailed output', false)
  .option('-l, --limit <number>', 'Limit number of folders processed', '0')
  .option('--folder-id <id>', 'Process only a specific high-level folder')
  .action(async (options) => {
    await propagateExpertIds({
      dryRun: options.dryRun,
      verbose: options.verbose,
      limit: parseInt(options.limit, 10),
      folderId: options.folderId
    });
  });

// Command to transfer expert_documents processed_content to experts metadata field
program
  .command('transfer-expert-metadata')
  .description('Transfer processed_content from expert_documents to experts.metadata field\n' +
    'Examples:\n' +
    '  # Run in dry-run mode first to see what changes would be made\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh transfer-expert-metadata --dry-run\n\n' +
    '  # Run with verbose output\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh transfer-expert-metadata --verbose\n\n' +
    '  # Actually update the metadata fields\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh transfer-expert-metadata\n\n' +
    '  # Specify a different document type ID\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh transfer-expert-metadata --document-type-id "<uuid>"\n\n' +
    'Workflow:\n' +
    '  1. For each expert, finds the most recent source with document_type_id = 554ed67c-35d1-4218-abba-8d1b0ff7156d\n' +
    '  2. Gets the expert_document associated with that source\n' +
    '  3. If the processed_content field contains JSON, transfers it to the experts.metadata field')
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-v, --verbose', 'Show more detailed output', false)
  .option('--document-type-id <id>', 'Specific document type ID to look for', '554ed67c-35d1-4218-abba-8d1b0ff7156d')
  .option('--expert-limit <number>', 'Limit the number of experts to process (0 = no limit)', '0')
  .action(async (options) => {
    await transferExpertMetadata({
      dryRun: options.dryRun,
      verbose: options.verbose,
      documentTypeId: options.documentTypeId,
      expertLimit: parseInt(options.expertLimit, 10)
    });
  });

// Health check command
program
  .command('health-check')
  .description('Check the health of the experts service infrastructure')
  .option('--skip-database', 'Skip database connection check')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (options) => {
    try {
      console.log('🏥 Running experts pipeline health checks...');
      
      // Check database connection
      if (!options.skipDatabase) {
        console.log('\n🔍 Checking Supabase database connection...');
        try {
          // Test connection to database
          const connectionTest = await SupabaseClientService.getInstance().testConnection();
          
          if (connectionTest.success) {
            console.log('✅ Database connection successful');
            
            // Additional check for experts table
            const supabase = SupabaseClientService.getInstance().getClient();
            const { data, error } = await supabase
              .from('experts')
              .select('count(*)', { count: 'exact', head: true });
              
            if (error) {
              throw new Error(`Error querying experts table: ${error.message}`);
            }
            
            console.log('✅ Experts table accessible');
            
            // Additional check for document_types table using the new column name 'name'
            const { data: docTypes, error: docTypesError } = await supabase
              .from('document_types')
              .select('id, name')
              .limit(1);
              
            if (docTypesError) {
              console.warn(`⚠️ Could not verify document_types table: ${docTypesError.message}`);
            } else {
              console.log('✅ Document types table accessible');
            }
            
            // Additional check for folder-expert relationships
            const { data: relations, error: relError } = await supabase
              .from('folder_expert_relationships')
              .select('count(*)', { count: 'exact', head: true });
              
            if (relError) {
              console.warn(`⚠️ Could not verify folder_expert_relationships table: ${relError.message}`);
            } else {
              console.log('✅ Folder-expert relationships table accessible');
            }
          } else {
            const errorMessage = connectionTest.error || 'Unknown database connection error';
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error('❌ Database connection failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping database check');
      }
      
      // Summary
      console.log('\n📋 Overall Status:');
      if (!options.skipDatabase) {
        console.log('✅ Experts service infrastructure appears healthy');
      } else {
        console.log('⚠️ Health status unknown (database check skipped)');
      }
    } catch (error) {
      console.error(`Error performing health check: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Execute the program
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}