#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { reportMainVideoIds } from './report-main-video-ids';

// Create the main program
const program = new Command()
  .name('google-sync-cli')
  .description('CLI for managing and syncing Google Drive data')
  .version('0.1.0');

// Define report-main-video-ids command
program
  .command('report-main-video-ids')
  .description('Report on video files for folders under the Dynamic Healing Discussion Group root folder, recursively searching subfolders for MP4 files')
  .option('--folder-id <id>', 'Specify a folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--verbose', 'Show detailed logs', false)
  .option('--output <path>', 'Path to write markdown output to', '')
  .option('--limit <number>', 'Limit the number of folders to process')
  .action(async (options: any) => {
    try {
      await reportMainVideoIds(options.folderId, options.verbose, options.output, options.limit ? parseInt(options.limit) : 0);
    } catch (error) {
      Logger.error('Error reporting main video IDs:', error);
      process.exit(1);
    }
  });

// Define update-main-video-ids command
program
  .command('update-main-video-ids')
  .description('Update main_video_id for presentations by recursively searching folders for MP4 files')
  .option('--folder-id <id>', 'Specify a folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .option('--limit <number>', 'Limit the number of presentations to process')
  .option('--use-sources-google', 'Use sources_google table instead of sources_google2', false)
  .action(async (options: any) => {
    try {
      // Execute the script directly
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'update-main-video-ids.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.folderId) cmd += ` --folder-id ${options.folderId}`;
      if (options.verbose) cmd += ' --verbose';
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.dryRun) cmd += ' --dry-run';
      if (options.useSourcesGoogle) cmd += ' --use-sources-google';
      
      Logger.debug(`Executing: ${cmd}`);
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          Logger.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          Logger.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      Logger.error('Error updating main video IDs:', error);
      process.exit(1);
    }
  });

// Add more commands as needed

// Parse command line arguments
program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  console.log(`
Google Sync CLI
==============

The Google Sync CLI provides commands for managing Google Drive synchronization, 
including reporting on video files, folders, and their relationships.

Available Commands:
  report-main-video-ids    Report on video files for folders under the Dynamic Healing Discussion Group
                          Recursively searches subfolders for MP4 files, prioritizing Presentation folders
    Options:
      --folder-id <id>     Specify a folder ID (default: Dynamic Healing Discussion Group)
      --verbose            Show detailed logs
      --output <path>      Path to write markdown output report to a file
      --limit <number>     Limit the number of folders to process
  
  update-main-video-ids    Update main_video_id for presentations by recursively searching folders
                          Finds and sets the best MP4 file as the main_video_id for each presentation
    Options:
      --folder-id <id>     Specify a folder ID (default: Dynamic Healing Discussion Group)
      --dry-run            Show what would be updated without making changes
      --verbose            Show detailed logs
      --limit <number>     Limit the number of presentations to process
      --use-sources-google Use sources_google table instead of sources_google2 (default uses sources_google2)

For detailed help on a specific command, run:
  google-sync-cli [command] --help
`);
  program.outputHelp();
}

// Handle any unhandled exceptions
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});