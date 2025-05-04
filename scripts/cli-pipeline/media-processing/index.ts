#!/usr/bin/env ts-node
/**
 * Media Processing CLI Pipeline
 * 
 * A unified command-line interface for media processing tasks including:
 * - Processing summaries into AI summaries and storing in expert_documents
 * - Managing presentations that use these summaries
 * - Linking presentation assets
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

// Create the program
const program = new Command();

// Set basic program information
program
  .name('media-processing')
  .description('CLI utilities for processing media files and summaries')
  .version('1.0.0');

// Add help text
program.on('--help', () => {
  console.log(`
Media Processing CLI Pipeline
----------------------------
A unified command-line interface for media processing tasks including:
- Processing summaries into AI summaries and storing in expert_documents
- Managing presentations that use these summaries
- Linking presentation assets

Summary Processing Commands:
  process-summary       Process a summary file and store in expert_documents
  batch-process         Process multiple summary files in batch

Presentation Management Commands:
  manage-presentations  List, create, update, or delete presentations
  link-assets           Link assets to a presentation

Utility Commands:
  check-status          Check processing status of summaries and presentations
  show-recent-expert-docs Show expert documents updated recently with their content
  help                  Display this help information

For more information on a specific command, try:
  ts-node scripts/cli-pipeline/media-processing/index.ts <command> --help
`);
});

// Process summary command
program
  .command('process-summary <file>')
  .description('Process a summary file and store the AI-generated summary in expert_documents')
  .option('--write-to-db', 'Save processed summary to expert_documents table')
  .option('--output-file <path>', 'Save processed summary to local file')
  .option('--summary-type <type>', 'Specify AI summary format (short, medium, detailed)', 'medium')
  .option('--dry-run', 'Show what would be processed without making changes')
  .action(async (file: string, options: any) => {
    console.log(`Processing summary file: ${file}`);
    console.log('Options:', options);
    // This would call the actual implementation
    await executeCommand('process-summary.ts', { file, ...options });
  });

// Batch process command
program
  .command('batch-process')
  .description('Process multiple summary files in batch')
  .option('--directory <dir>', 'Directory containing summary files to process')
  .option('--pattern <pattern>', 'File pattern to match (e.g., "*.txt")', '*.txt')
  .option('--write-to-db', 'Save processed summaries to expert_documents table')
  .option('--output-dir <dir>', 'Directory to save processed summaries as local files')
  .option('--summary-type <type>', 'Specify AI summary format (short, medium, detailed)', 'medium')
  .option('--limit <number>', 'Maximum number of files to process', '10')
  .option('--dry-run', 'Show what would be processed without making changes')
  .action(async (options) => {
    console.log('Batch processing summary files');
    console.log('Options:', options);
    // This would call the actual implementation
    await executeCommand('batch-process.ts', options);
  });

// Manage presentations command
program
  .command('manage-presentations')
  .description('Manage presentations that use summaries')
  .option('--list', 'List all presentations')
  .option('--create', 'Create a new presentation')
  .option('--update <id>', 'Update an existing presentation')
  .option('--delete <id>', 'Delete a presentation')
  .option('--title <title>', 'Title for create/update operations')
  .option('--description <desc>', 'Description for create/update operations')
  .option('--expert <id>', 'Expert ID for create/update operations')
  .option('--format <format>', 'Output format: json, table (default: table)')
  .option('--filter <query>', 'Filter presentations by query string')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (options) => {
    console.log('Managing presentations');
    console.log('Options:', options);
    // This would call the actual implementation
    await executeCommand('manage-presentations.ts', options);
  });

// Link assets command
program
  .command('link-assets <presentation_id>')
  .description('Link assets to a presentation')
  .option('--asset-type <type>', 'Type of asset to link (document, summary, video, image)')
  .option('--asset-id <id>', 'ID of the asset to link')
  .option('--asset-file <file>', 'Path to the asset file to upload and link')
  .option('--position <pos>', 'Position in the presentation (e.g., "intro", "main", "conclusion")')
  .option('--replace', 'Replace existing asset if it exists')
  .option('--list', 'List all assets linked to the presentation')
  .option('--unlink <id>', 'Unlink an asset from the presentation')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (presentationId: string, options: any) => {
    console.log(`Linking assets to presentation: ${presentationId}`);
    console.log('Options:', options);
    // This would call the actual implementation
    await executeCommand('link-assets.ts', { presentationId, ...options });
  });

// Check status command
program
  .command('check-status')
  .description('Check processing status of summaries and presentations')
  .option('--summary <id>', 'Check status of a specific summary')
  .option('--presentation <id>', 'Check status of a specific presentation')
  .option('--all-summaries', 'Check status of all summaries')
  .option('--all-presentations', 'Check status of all presentations')
  .option('--format <format>', 'Output format: json, table (default: table)')
  .action(async (options) => {
    console.log('Checking status');
    console.log('Options:', options);
    // This would call the actual implementation
    await executeCommand('check-status.ts', options);
  });

// Show recent expert documents command
program
  .command('show-recent-expert-docs')
  .description('Show expert documents updated recently with their raw content and source information')
  .option('--days <number>', 'Number of days to look back (default: 1)', '1')
  .option('--limit <number>', 'Maximum number of documents to show (default: 10)', '10')
  .option('--status <status>', 'Filter by document status')
  .option('--document-type <type>', 'Filter by document type')
  .option('--format <format>', 'Output format: json, table (default: table)')
  .option('--show-content', 'Show full raw content of each document')
  .action(async (options) => {
    console.log('Showing recent expert documents');
    // Parse numeric options
    if (options.days) options.days = parseInt(options.days);
    if (options.limit) options.limit = parseInt(options.limit);
    await executeCommand('show-recent-expert-docs.ts', options);
  });

// Extract video metadata command
program
  .command('extract-video-metadata')
  .description('Extract metadata (especially duration) from MP4 video files')
  .option('--file-id <id>', 'Process a specific file by its sources_google.id')
  .option('--limit <number>', 'Limit to processing <number> of videos (default: 50)', '50')
  .option('--dry-run', 'Show what would be updated without making changes')
  .action(async (options) => {
    console.log('Extracting video metadata');
    // Parse numeric options
    if (options.limit) options.limit = parseInt(options.limit);
    await executeCommand('extract-video-metadata.ts', options);
  });

/**
 * Execute a command from the commands directory
 */
async function executeCommand(commandFile: string, options: any): Promise<void> {
  const commandPath = path.join(__dirname, 'commands', commandFile);

  console.log(`Executing command: ${commandFile}`);
  
  // Extract actual options from Commander command object
  const cleanOptions: Record<string, any> = {};
  if (typeof options === 'object') {
    // Extract simple properties excluding circular references
    Object.keys(options).forEach(key => {
      if (
        key !== 'commands' && 
        key !== 'options' && 
        key !== 'parent' && 
        key !== '_events' && 
        key !== '_eventsCount' && 
        !key.startsWith('_') && 
        typeof options[key] !== 'function'
      ) {
        cleanOptions[key] = options[key];
      }
    });
  }
  
  console.log('With options:', cleanOptions);
  
  // Check if the command file exists and execute it if it does
  if (fs.existsSync(commandPath)) {
    try {
      // For .ts files, we need to use ts-node
      let commandModule;
      if (commandFile.endsWith('.ts')) {
        // Use require for TypeScript files
        commandModule = require(commandPath);
      } else {
        // Use import for JavaScript files
        commandModule = await import(commandPath);
      }
      
      // Execute the default export function if it exists
      if (typeof commandModule.default === 'function') {
        await commandModule.default(cleanOptions);
      } else {
        console.error(`Command ${commandFile} does not export a default function`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`Error executing command ${commandFile}:`, error.message);
      process.exit(1);
    }
  } else {
    console.log(`Command file not found: ${commandPath}`);
    console.log('This is expected during development. The actual command would be executed here when implemented.');
  }
}

// Parse arguments and run
program.parse(process.argv);

// If no command was specified, show help
if (!process.argv.slice(2).length) {
  program.help();
}