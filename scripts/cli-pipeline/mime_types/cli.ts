#!/usr/bin/env ts-node
/**
 * CLI entry point for mime types management
 */

import { Command } from 'commander';
import { syncMimeTypes } from './sync-mime-types';
import { addMimeTypeProcessingConfig, MimeTypeProcessingOptions } from './manage-processing-config';

/**
 * Interface for the configure-processing command options
 */
interface ConfigureProcessingOptions {
  dryRun?: boolean;
  verbose?: boolean;
  priority?: string;
}

/**
 * Interface for the sync command options
 */
interface SyncOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

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
  .action((options: SyncOptions) => {
    syncMimeTypes({
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

program
  .command('configure-processing')
  .alias('add-processing-config')
  .description('Configure mime_type_processing for a specific file extension')
  .argument('<extension>', 'File extension (e.g., docx, txt, pdf, pptx, mp4)')
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