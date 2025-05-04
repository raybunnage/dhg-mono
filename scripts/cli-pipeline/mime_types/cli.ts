#!/usr/bin/env ts-node
/**
 * CLI entry point for mime types management
 */

import { Command } from 'commander';
import { syncMimeTypes } from './sync-mime-types';

// Setup CLI program
const program = new Command();

program
  .name('mime-types-cli')
  .description('CLI tools for managing MIME types');

program
  .command('sync')
  .description('Synchronize the mime_types table with unique MIME types from sources_google')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Show detailed information about each MIME type')
  .action((options) => {
    syncMimeTypes({
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

program
  .command('help')
  .description('Display help information')
  .action(() => {
    program.outputHelp();
  });

// Run the program if this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}