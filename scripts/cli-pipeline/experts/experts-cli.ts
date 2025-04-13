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
import { listExperts } from './commands/list-experts';
import { addExpert } from './commands/add-expert';

// Load environment variables
dotenv.config();

// Create the main program
const program = new Command();

program
  .name('experts-cli')
  .description('CLI utilities for managing experts and their associations\n\n' +
    'Common commands:\n' +
    '  list-experts      List all experts with their unique 3-character mnemonics\n' +
    '  assign-expert -i  Interactively assign experts to folders using mnemonics\n' +
    '  link-top-level-folders  List folders with videos that need expert assignment')
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

// Command to add a new expert
program
  .command('add-expert')
  .description('Add a new expert to the database\n' +
    'Examples:\n' +
    '  # Add a basic expert\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Wager"\n\n' +
    '  # Add expert with full details\n' +
    '  ./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Wager" --full-name "Tor Wager" --expertise "Neuroscience" --core-group')
  .option('--expert-name <n>', 'Short name for the expert (required)')
  .option('--full-name <n>', 'Full name of the expert')
  .option('--expertise <area>', 'Area of expertise')
  .option('--mnemonic <code>', 'Custom 3-character mnemonic for the expert (auto-generated if not provided)')
  .option('--core-group', 'Set as a core group member', false)
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-v, --verbose', 'Show more detailed output', false)
  .action(async (options) => {
    await addExpert({
      expertName: options.expertName,
      fullName: options.fullName,
      expertiseArea: options.expertise,
      mnemonic: options.mnemonic,
      isInCoreGroup: options.coreGroup,
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

// Execute the program
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}