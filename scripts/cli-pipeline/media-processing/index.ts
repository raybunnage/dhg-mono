#!/usr/bin/env ts-node
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
import path from 'path';
import fs from 'fs';

// Create the program
const program = new Command();

// Set basic program information
program
  .name('media-processing')
  .description('CLI utilities for processing media files')
  .version('1.0.0');

// Helper function to register commands
function registerCommand(commandName: string, description: string, options?: any[]) {
  const command = new Command(commandName)
    .description(description);
  
  // Add options if provided
  if (options && options.length) {
    for (const opt of options) {
      command.option(opt.flags, opt.description, opt.defaultValue);
    }
  }
  
  // Add action to execute the command file
  command.action(async (options) => {
    // Get all arguments to pass to the command
    const args = process.argv.slice(3);

    // Build the path to the command file
    const commandFile = path.join(
      __dirname,
      'commands',
      `${commandName}.ts`
    );

    // Check if command file exists
    if (!fs.existsSync(commandFile)) {
      console.error(`Command file not found: ${commandFile}`);
      process.exit(1);
    }

    // Execute the command file using ts-node
    try {
      // Dynamic import for the command
      const result = await import(commandFile);
      
      // If the command has a main function, execute it
      if (typeof result.default === 'function') {
        await result.default(options);
      }
    } catch (error: any) {
      console.error(`Error executing command ${commandName}:`, error.message);
      process.exit(1);
    }
  });

  // Register the command with the program
  program.addCommand(command);
}

// Register commands

// Media checking commands
registerCommand('check-media-files', 'Check for missing or orphaned MP4/M4A files', [
  { flags: '--summary', description: 'Display only summary information' },
  { flags: '--json', description: 'Output results in JSON format' }
]);

// Legacy script wrappers
registerCommand('find-missing-js-files', 'Find missing MP4 files using JavaScript script', [
  { flags: '--verbose', description: 'Show detailed output' }
]);

registerCommand('run-shell-check', 'Run shell script-based media file checker', [
  { flags: '--verbose', description: 'Show detailed output' },
  { flags: '--script <name>', description: 'Specify which shell script to run (without .sh extension)' }
]);

// Media conversion commands
registerCommand('convert-mp4', 'Convert MP4 files to M4A for audio extraction', [
  { flags: '--all', description: 'Process all MP4 files' },
  { flags: '--file <file>', description: 'Process specific file' },
  { flags: '--batch-size <number>', description: 'Number of files to process at once' }
]);

// Transcription commands
registerCommand('transcribe-audio', 'Transcribe audio files to text', [
  { flags: '--model <model>', description: 'Whisper model to use' },
  { flags: '--file <file>', description: 'Process specific file' },
  { flags: '--batch-size <number>', description: 'Number of files to process at once' }
]);

registerCommand('transcribe-with-summary', 'Transcribe audio files and generate summary', [
  { flags: '--model <model>', description: 'Whisper model to use' },
  { flags: '--file <file>', description: 'Process specific file' }
]);

// File management commands
registerCommand('purge-processed-media', 'Delete processed media files that have been extracted', [
  { flags: '--dry-run', description: 'Show what would be deleted without actually removing files' },
  { flags: '--force', description: 'Delete without confirmation' },
  { flags: '--days <number>', description: 'Only purge files processed more than <number> days ago' }
]);

// Listing and reporting commands
registerCommand('list-ready', 'List files ready for processing');
registerCommand('list-pending', 'List files pending processing');
registerCommand('list-transcribable', 'List files ready for transcription');
registerCommand('find-processable-videos', 'Find videos that can be processed');

// Parse arguments and run
program.parse(process.argv);

// If no command was specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}