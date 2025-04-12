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

// Load environment variables
dotenv.config();

// Create the main program
const program = new Command();

program
  .name('experts-cli')
  .description('CLI utilities for managing experts and their associations')
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
  .description('Assign an expert to a specific folder')
  .requiredOption('--folder-id <id>', 'ID of the folder to link')
  .requiredOption('--expert-id <id>', 'ID of the expert to link')
  .option('--primary <boolean>', 'Set as primary expert', 'true')
  .option('-d, --dry-run', 'Show what would be done without making changes', false)
  .option('-v, --verbose', 'Show more detailed output', false)
  .action(async (options) => {
    await assignExpert({
      folderId: options.folderId,
      expertId: options.expertId,
      isPrimary: options.primary === 'true',
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

// Command to list all experts
program
  .command('list-experts')
  .description('List all experts in the system')
  .option('-l, --limit <number>', 'Limit number of experts shown', '100')
  .option('-v, --verbose', 'Show more detailed output', false)
  .action(async (options) => {
    await listExperts({
      limit: parseInt(options.limit, 10),
      verbose: options.verbose
    });
  });

// Add more commands here as needed

// Execute the program
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}