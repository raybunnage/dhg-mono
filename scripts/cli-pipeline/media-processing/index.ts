/**
 * Media Processing CLI Pipeline
 * 
 * A unified command-line interface for media processing tasks including:
 * - Converting MP4 files to M4A for audio extraction
 * - Transcribing audio files
 * - Checking media file status
 * - Managing processed media files
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

// Create the program
const program = new Command();

// Set basic program information
program
  .name('media-processing')
  .description('CLI utilities for processing media files')
  .version('1.0.0');

// Add help text (compatibility with older commander versions)
program.on('--help', () => {
  console.log(`
Media Processing CLI Pipeline
----------------------------
A unified command-line interface for media processing tasks including:
- Converting MP4 files to M4A for audio extraction
- Transcribing audio files
- Checking media file status
- Managing processed media files

File Checking Commands:
  check-media-files       Check for missing/orphaned MP4 and M4A files in database and local directories
  find-missing-js-files   Run JavaScript-based MP4 file checker (legacy implementation)
  run-shell-check         Run any shell script from the shell-scripts directory

File Management Commands:
  rename-mp4-files        Rename local MP4 files to match database records
  convert-mp4             Extract audio from MP4 files and create M4A files
  transcribe-audio        Transcribe audio files to text using Whisper
  transcribe-with-summary Generate transcriptions with summaries
  purge-processed-media   Remove processed MP4 and M4A files that have been extracted and saved in database
  
Database Integration Commands:
  update-disk-status      Update presentations with MP4 file status on disk
  register-expert-docs    Register MP4 files as expert documents in the database
  update-status           Update processing status of expert documents
  mark-skip-processing    Mark large files to skip batch processing
  
Listing & Utility Commands:
  list-ready              List files ready for processing
  list-pending            List files pending processing
  list-transcribable      List files ready for transcription
  find-processable-videos Find videos that can be processed

For more information on a specific command, try:
  ts-node scripts/cli-pipeline/media-processing/index.ts <command> --help
`);
});

// Media checking commands - use direct command() calls for compatibility
program
  .command('check-media-files')
  .description('Check for missing or orphaned MP4/M4A files in database and file system')
  .option('--summary', 'Display only summary information')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    await executeCommand('check-media-files.ts', options);
  });

// Legacy script wrappers
program
  .command('find-missing-js-files')
  .description('Run JavaScript-based MP4 file checker (legacy implementation)')
  .option('--verbose', 'Show detailed output')
  .action(async (options) => {
    await executeCommand('find-missing-js-files.ts', options);
  });

program
  .command('run-shell-check')
  .description('Run any shell script from the shell-scripts directory')
  .option('--verbose', 'Show detailed output')
  .option('--script <name>', 'Specify which shell script to run (available: mp4-files-check, check-missing-mp4-files, etc.)')
  .action(async (options) => {
    await executeCommand('run-shell-check.ts', options);
  });

// Media conversion commands
program
  .command('convert-mp4')
  .description('Convert MP4 files to M4A for audio extraction')
  .option('--all', 'Process all MP4 files')
  .option('--file <file>', 'Process specific file')
  .option('--batch-size <number>', 'Number of files to process at once')
  .action(async (options) => {
    await executeCommand('convert-mp4.ts', options);
  });

// Transcription commands
program
  .command('transcribe-audio')
  .description('Transcribe audio files to text')
  .option('--model <model>', 'Whisper model to use')
  .option('--file <file>', 'Process specific file')
  .option('--batch-size <number>', 'Number of files to process at once')
  .action(async (options) => {
    await executeCommand('transcribe-audio.ts', options);
  });

program
  .command('transcribe-with-summary')
  .description('Transcribe audio files and generate summary')
  .option('--model <model>', 'Whisper model to use')
  .option('--file <file>', 'Process specific file')
  .action(async (options) => {
    await executeCommand('transcribe-with-summary.ts', options);
  });

// File management commands
program
  .command('purge-processed-media')
  .description('Delete processed media files that have been extracted')
  .option('--dry-run', 'Show what would be deleted without actually removing files')
  .option('--force', 'Delete without confirmation')
  .option('--days <number>', 'Only purge files processed more than <number> days ago')
  .action(async (options) => {
    await executeCommand('purge-processed-media.ts', options);
  });

// Listing and reporting commands
program
  .command('list-ready')
  .description('List files ready for processing')
  .action(async (options) => {
    await executeCommand('list-ready.ts', options);
  });

program
  .command('list-pending')
  .description('List files pending processing')
  .action(async (options) => {
    await executeCommand('list-pending.ts', options);
  });

program
  .command('list-transcribable')
  .description('List files ready for transcription')
  .action(async (options) => {
    await executeCommand('list-transcribable.ts', options);
  });

program
  .command('find-processable-videos')
  .description('Find videos that can be processed')
  .action(async (options) => {
    await executeCommand('find-processable-videos.ts', options);
  });

// Add file renaming command
program
  .command('rename-mp4-files')
  .description('Rename local MP4 files to match database records')
  .option('--dry-run', 'Show what would be renamed without making changes')
  .option('--force', 'Rename even if a destination file already exists (will overwrite)')
  .option('--generate-map', 'Generate a CSV mapping file of original to new names')
  .option('--skip-sync', 'Skip automatic M4A filename synchronization')
  .action(async (options) => {
    await executeCommand('rename-mp4-files.ts', options);
  });

// Add M4A sync command
program
  .command('sync-m4a-names')
  .description('Sync M4A filenames with their MP4 counterparts after renaming')
  .option('--dry-run', 'Show what would be renamed without making changes')
  .option('--force', 'Rename even if destination files already exist (will overwrite)')
  .option('--after-rename', 'Run this after renaming MP4 files')
  .action(async (options) => {
    await executeCommand('sync-m4a-names.ts', options);
  });

// Database integration commands
program
  .command('update-disk-status')
  .description('Update presentations with MP4 file status on disk')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--force', 'Process all presentations even if they already have disk status')
  .action(async (options) => {
    // Call the update-presentation-disk-status.ts script using ts-node
    const { spawn } = require('child_process');
    const tsNodePath = path.join(process.cwd(), 'node_modules', '.bin', 'ts-node');
    const scriptPath = path.resolve(__dirname, '../../../scripts/cli-pipeline/google_sync/update-presentation-disk-status.ts');
    
    // Convert options to command-line arguments
    const args = [scriptPath];
    if (options.dryRun) args.push('--dry-run');
    if (options.force) args.push('--force');
    
    // Run the command
    const child = spawn(tsNodePath, args, { stdio: 'inherit' });
    
    // Handle completion
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });
      
      child.on('error', (err: Error) => {
        reject(err);
      });
    });
  });

program
  .command('update-status [fileId]')
  .description('Update processing status of expert documents')
  .option('--stage <stage>', 'Stage to update (extraction, transcription)')
  .option('--status <status>', 'New status (pending, processing, completed, failed, skip_processing)')
  .option('--error <message>', 'Error message (for failed status)')
  .option('--batch <file>', 'Process a batch of files from a file (one ID per line)')
  .action(async (fileId: string, options: any) => {
    // Ensure options includes the fileId
    if (fileId) options.fileId = fileId;
    await executeCommand('update-status.ts', options);
  });

program
  .command('mark-skip-processing [fileIdentifier]')
  .description('Mark large files to skip batch processing')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--resume', 'Remove the skip_processing status (make available for processing again)')
  .action(async (fileIdentifier: string, options: any) => {
    // Ensure options includes the fileIdentifier
    if (fileIdentifier) options.fileIdentifier = fileIdentifier;
    await executeCommand('mark-skip-processing.ts', options);
  });

program
  .command('register-expert-docs')
  .description('Register MP4 files as expert documents in the database')
  .option('--dry-run', 'Show what would be created without making changes')
  .option('--limit <number>', 'Limit the number of presentations to process')
  .action(async (options) => {
    // Call the create-mp4-expert-documents.ts script using ts-node
    const { spawn } = require('child_process');
    const tsNodePath = path.join(process.cwd(), 'node_modules', '.bin', 'ts-node');
    const scriptPath = path.resolve(__dirname, '../../../scripts/cli-pipeline/google_sync/create-mp4-expert-documents.ts');
    
    // Convert options to command-line arguments
    const args = [scriptPath];
    if (options.dryRun) args.push('--dry-run');
    if (options.limit) args.push('--limit', options.limit);
    
    // Run the command
    const child = spawn(tsNodePath, args, { stdio: 'inherit' });
    
    // Handle completion
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });
      
      child.on('error', (err: Error) => {
        reject(err);
      });
    });
  });

program
  .command('register-local-mp4-files')
  .description('Add local MP4 files to database that are not already registered')
  .option('--dry-run', 'Show what would be added without making changes')
  .option('--force', 'Add files even if similar filenames exist')
  .option('--specific-files <list>', 'Only register specific files (comma-separated list)')
  .action(async (options) => {
    await executeCommand('register-local-mp4-files.ts', options);
  });

/**
 * Execute a command from the commands directory
 */
async function executeCommand(commandFile: string, options: any): Promise<void> {
  const commandPath = path.join(__dirname, 'commands', commandFile);

  if (!fs.existsSync(commandPath)) {
    console.error(`Command file not found: ${commandPath}`);
    process.exit(1);
  }

  try {
    // Import the command module
    const commandModule = await import(commandPath);
    
    // Execute the default export function if it exists
    if (typeof commandModule.default === 'function') {
      await commandModule.default(options);
    } else {
      console.error(`Command ${commandFile} does not export a default function`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error executing command ${commandFile}:`, error.message);
    process.exit(1);
  }
}

/**
 * Execute a command from an external path
 */
async function executeExternalCommand(commandPath: string, options: any): Promise<void> {
  const absolutePath = path.resolve(__dirname, commandPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`External command file not found: ${absolutePath}`);
    process.exit(1);
  }

  try {
    // Import the command module
    const commandModule = await import(absolutePath);
    
    // For external modules, assume they have a main function to execute
    if (typeof commandModule.default === 'function') {
      await commandModule.default(options);
    } else if (typeof commandModule.main === 'function') {
      await commandModule.main(options);
    } else {
      // If no default or main function, try to call the module itself
      await commandModule(options);
    }
  } catch (error: any) {
    console.error(`Error executing external command ${absolutePath}:`, error.message);
    process.exit(1);
  }
}

// Parse arguments and run
program.parse(process.argv);

// If no command was specified, show help
if (!process.argv.slice(2).length) {
  program.help();
}