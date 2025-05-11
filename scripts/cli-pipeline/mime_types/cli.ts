#!/usr/bin/env ts-node
/**
 * CLI entry point for mime types management
 */

import { Command } from 'commander';
import { syncMimeTypes, SyncMimeTypesOptions } from './sync-mime-types';
import { addMimeTypeProcessingConfig, MimeTypeProcessingOptions } from './manage-processing-config';

// Setup CLI program
const program = new Command();

program
  .name('mime-types-cli')
  .description('CLI tools for managing MIME types');

// Interface for sync command options
interface SyncCommandOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

// Interface for configure-processing command options
interface ConfigureProcessingOptions {
  dryRun?: boolean;
  verbose?: boolean;
  priority?: string;
}

// Add commands directly to the program using .command()
program
  .command('sync')
  .description('Synchronize the mime_types table with unique MIME types from sources_google')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Show detailed information about each MIME type')
  .action((options: SyncCommandOptions) => {
    const syncOptions: SyncMimeTypesOptions = {
      dryRun: options.dryRun,
      verbose: options.verbose
    };
    syncMimeTypes(syncOptions);
  });

program
  .command('configure-processing <extension>')
  .alias('add-processing-config')
  .description('Configure mime_type_processing for a specific file extension')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Show detailed information about the configuration')
  .option('-p, --priority <number>', 'Processing priority (higher numbers = higher priority)')
  .action((extension: string, options: ConfigureProcessingOptions) => {
    const processingOptions: MimeTypeProcessingOptions = {
      extension,
      dryRun: options.dryRun,
      verbose: options.verbose,
      priority: options.priority ? parseInt(options.priority) : undefined
    };
    addMimeTypeProcessingConfig(processingOptions);
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