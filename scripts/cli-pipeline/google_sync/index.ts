#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import * as fs from 'fs';
import * as path from 'path';
// Import commands
import { reportMainVideoIds } from './report-main-video-ids';
import { updateSourcesFromJson } from './update-sources-from-json';
import { insertMissingSources } from './insert-missing-sources';
import { updateSchemaFromJson } from './update-schema-from-json';
import { syncAndUpdateMetadata } from './sync-and-update-metadata';
import { checkDocumentTypes } from './check-document-types';
import { checkDuplicates, CheckDuplicatesOptions } from './check-duplicates';
// These functions may not exist as TypeScript exports, so we'll use exec for them

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
  .option('--update-db', 'Update main_video_id values in the database', false)
  .action(async (options: any) => {
    try {
      await reportMainVideoIds(
        options.folderId,
        options.verbose,
        options.output,
        options.limit ? parseInt(options.limit, 10) : 0,
        options.updateDb
      );
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
  .option('--use-sources-google', 'Use sources_google table instead of sources_google', false)
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
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
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

// Define browser-recursive-search command
program
  .command('browser-recursive-search')
  .description('Generate browser-based recursive folder search script and save it to a markdown file')
  .option('--folder-id <id>', 'Specify a folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--output <path>', 'Path to write markdown output (default: docs/cli-pipeline/browser-recursive-search.md)', 'docs/cli-pipeline/browser-recursive-search.md')
  .action(async (options: any) => {
    try {
      const { exec } = require('child_process');
      
      // Create docs/cli-pipeline directory if it doesn't exist
      const outputDir = path.dirname(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        Logger.info(`Created directory: ${outputDir}`);
      }

      // Get the script path
      const scriptPath = path.resolve(__dirname, 'browser-recursive-search.sh');
      
      // Execute the script and capture its output
      Logger.info(`Generating browser recursive search script for folder ID: ${options.folderId}`);
      Logger.info(`Output will be saved to: ${options.output}`);
      
      exec(`bash "${scriptPath}"`, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          Logger.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          Logger.error(`stderr: ${stderr}`);
          return;
        }
        
        // Modify the output to use the specified folder ID
        const modifiedOutput = stdout.replace(
          /const folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';/,
          `const folderId = '${options.folderId}';`
        );
        
        // Add a proper markdown header
        const markdownContent = `# Browser Recursive Search Tool for Google Drive\n\n${modifiedOutput}`;
        
        // Write to the output file
        fs.writeFileSync(options.output, markdownContent);
        Logger.info(`Successfully saved browser recursive search script to: ${options.output}`);
      });
    } catch (error) {
      Logger.error('Error generating browser recursive search script:', error);
      process.exit(1);
    }
  });

// Define update-sources-from-json command
program
  .command('update-sources-from-json')
  .description('Update sources_google records using JSON file data with folder metadata and path information')
  .argument('[json-file]', 'Path to the JSON file (default: file_types/json/google-drive.json)', 'file_types/json/google-drive.json')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .option('--drive-id <id>', 'Update only a specific drive ID')
  .action(async (jsonFile: string, options: any) => {
    try {
      await updateSourcesFromJson(jsonFile, options.dryRun, options.verbose, options.driveId);
    } catch (error) {
      Logger.error('Error updating sources from JSON:', error);
      process.exit(1);
    }
  });

// Define insert-missing-sources command
program
  .command('insert-missing-sources')
  .description('Insert records from JSON file that do not exist in sources_google')
  .argument('[json-file]', 'Path to the JSON file (default: file_types/json/google-drive.json)', 'file_types/json/google-drive.json')
  .option('--dry-run', 'Show what would be inserted without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .option('--ids <ids>', 'Comma-separated list of specific drive IDs to insert')
  .option('--missing-nine', 'Insert the 9 specific missing records identified in the recent analysis', false)
  .option('--check-all-dhdg', 'Check for any missing files across the entire DHDG folder structure', false)
  .action(async (jsonFile: string, options: any) => {
    try {
      // Parse IDs if provided
      const specificIds: string[] = [];
      if (options.ids) {
        specificIds.push(...options.ids.split(',').map((id: string) => id.trim()));
      }
      
      // Handle --missing-nine flag
      if (options.missingNine) {
        specificIds.push(
          '1lY0Vxhv51RBZ5K9PmVQ9_T5PGpmcnkdh',
          '16FpSTTysb1KQ27pKX4gpMnCU4UawN_te',
          '16_yUoUFiyIT1lCRp3djQroTmKJjs9pYx',
          '1UxtOppPsbbbvG5BHP2M89TCPAs6ygAKQ',
          '1v9o3h8szKYHV_ZMKnph2XzAQYhMJmI-h',
          '1R3KlwjPNO6imIerLeBxg9cAXtU23WOcE',
          '1ab12OG1nS8jeWyY8gb4fCc_NPOP52F6k',
          '1Ldhx29BXAKJEU0F9mFN_AodvykRGZ06-',
          '13G5WPeK47jeeJI8kGG26jxqcIsjRAzQR'
        );
      }
      
      await insertMissingSources(
        jsonFile, 
        options.dryRun, 
        options.verbose, 
        specificIds.length > 0 ? specificIds : undefined,
        options.checkAllDhdg
      );
    } catch (error) {
      Logger.error('Error inserting missing sources:', error);
      process.exit(1);
    }
  });

// Define update-schema-from-json command
program
  .command('update-schema-from-json')
  .description('Update database schema based on a JSON schema definition')
  .argument('[json-file]', 'Path to the JSON schema file', 'schema.json')
  .option('--table=<name>', 'Table name to update', 'sources_google')
  .option('--dry-run', 'Show what would be updated without making changes (default)', true)
  .option('--execute', 'Actually execute the schema changes', false)
  .option('--generate-sql', 'Generate SQL migration file', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (jsonFile: string, options: any) => {
    try {
      await updateSchemaFromJson(
        jsonFile,
        options.table,
        !options.execute,  // dryRun is true unless --execute is specified
        options.generateSql,
        options.verbose
      );
    } catch (error) {
      Logger.error('Error updating schema from JSON:', error);
      process.exit(1);
    }
  });

// Define update-folder-video-mapping command
program
  .command('update-folder-video-mapping')
  .description('Update main_video_id for folder and subfolders based on folder:video mapping')
  .requiredOption('--mapping <mapping>', 'Mapping in format: \'folder name\': \'file name.mp4\'')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options: any) => {
    try {
      // Call the shell script which has more sophisticated argument handling
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'update-folder-video-mapping.sh');
      
      // Build command with options
      let cmd = `bash "${scriptPath}"`;
      if (options.mapping) cmd += ` --mapping "${options.mapping}"`;
      if (options.verbose) cmd += ' --verbose';
      if (options.dryRun) cmd += ' --dry-run';
      
      Logger.debug(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
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
      Logger.error('Error updating folder-video mapping:', error);
      process.exit(1);
    }
  });

// Add sync-and-update-metadata command
program
  .command('sync-and-update-metadata')
  .description('Sync folder and update metadata in one operation')
  .argument('[folder-id]', 'Folder ID to sync (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--file-id <id>', 'Specify a file ID for direct file lookup and insertion')
  .option('--dry-run', 'Show what would be synced without making changes', false)
  .option('--limit <number>', 'Limit to updating n records (default: 1000)', '1000')
  .option('--max-depth <number>', 'Maximum folder depth to traverse (default: 6)', '6')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (folderId, options) => {
    try {
      await syncAndUpdateMetadata(
        folderId,
        options.fileId,
        options.dryRun,
        parseInt(options.limit, 10),
        parseInt(options.maxDepth, 10),
        options.verbose
      );
    } catch (error) {
      Logger.error('Error syncing and updating metadata:', error);
      process.exit(1);
    }
  });

// Add check-document-types command
program
  .command('check-document-types')
  .description('Check for .docx and .txt files missing document_type_id')
  .option('--output <path>', 'Path to write markdown output to', 'docs/cli-pipeline/missing_document_types.md')
  .option('--verbose', 'Show detailed logs', false)
  .option('--limit <number>', 'Limit the number of files to process')
  .action(async (options) => {
    try {
      const limit = options.limit ? parseInt(options.limit, 10) : undefined;
      await checkDocumentTypes(options.verbose, options.output, limit);
    } catch (error) {
      Logger.error('Error checking document types:', error);
      process.exit(1);
    }
  });

// Add check-duplicates command
program
  .command('check-duplicates')
  .description('Check for duplicate files in sources_google by name or drive_id')
  .option('-l, --limit <number>', 'Limit the number of duplicate groups to display', '10')
  .option('-j, --json', 'Output in JSON format')
  .option('-n, --by-name', 'Check duplicates by name (default)', true)
  .option('-d, --by-drive-id', 'Check duplicates by drive_id')
  .option('-a, --all', 'Check both name and drive_id duplicates', false)
  .option('-v, --verbose', 'Show detailed information for each duplicate', false)
  .action(async (options) => {
    try {
      const checkOptions: CheckDuplicatesOptions = {
        limit: options.limit ? parseInt(options.limit, 10) : 10,
        json: options.json || false,
        byName: options.byName !== false, // true by default
        byDriveId: options.byDriveId || false,
        all: options.all || false,
        verbose: options.verbose || false
      };
      
      await checkDuplicates(checkOptions);
    } catch (error) {
      Logger.error('Error checking duplicates:', error);
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
      --use-sources-google Use sources_google table instead of sources_google (default uses sources_google)
  
  browser-recursive-search Generate browser-based recursive folder search script
                          Creates a markdown file with JavaScript for searching Google Drive folders
    Options:
      --folder-id <id>     Specify a folder ID (default: Dynamic Healing Discussion Group)
      --output <path>      Path to write markdown output to a file

  update-sources-from-json Update sources_google records from a JSON file
                          Updates path arrays, path depth, web links, and parent folder information
                          NOTE: extracted_content is now deprecated
    Arguments:
      [json-file]          Path to JSON file (default: file_types/json/google-drive.json)
    Options:
      --dry-run            Show what would be updated without making changes
      --verbose            Show detailed logs
      --drive-id <id>      Update only a specific drive ID

  insert-missing-sources   Insert records from JSON file that do not exist in sources_google
                          Checks if records exist before insertion to avoid duplicate key errors
    Arguments:
      [json-file]          Path to JSON file (default: file_types/json/google-drive.json)
    Options:
      --dry-run            Show what would be inserted without making changes
      --verbose            Show detailed logs
      --ids <ids>          Comma-separated list of specific drive IDs to insert
      --missing-nine       Insert the 9 specific missing records identified in the recent analysis
      --check-all-dhdg     Check for any missing files across the entire DHDG folder structure

  update-schema-from-json  Update database schema based on a JSON schema definition
                          Compares schema definition with database and generates SQL
    Arguments:
      [json-file]          Path to JSON schema file (default: schema.json)
    Options:
      --table=<name>       Table name to update (default: sources_google)
      --dry-run            Show what would be updated without making changes (default)
      --execute            Actually execute the schema changes
      --generate-sql       Generate SQL migration file
      --verbose            Show detailed logs

  update-folder-video-mapping Update main_video_id for folder and subfolders based on folder:video mapping
                          Connects a folder with an MP4 file and sets main_video_id for related files
    Options:
      --mapping <mapping>  Mapping in format: 'folder name': 'file name.mp4' (required)
      --dry-run            Show what would be updated without making changes
      --verbose            Show detailed logs

  sync-and-update-metadata Sync folder and update metadata in one operation
                          Synchronizes files from Google Drive and updates metadata
    Arguments:
      [folder-id]          Folder ID to sync (default: Dynamic Healing Discussion Group)
    Options:
      --file-id <id>       Specify a file ID for direct file lookup and insertion
      --dry-run            Show what would be synced without making changes
      --limit <number>     Limit to updating n records (default: 1000)
      --max-depth <number> Maximum folder depth to traverse (default: 6)
      --verbose            Show detailed logs
      
  check-document-types    Check for .docx and .txt files missing document_type_id
                          Finds files that should have document types but don't
    Options:
      --output <path>      Path to write markdown output to (default: docs/cli-pipeline/missing_document_types.md)
      --verbose            Show detailed logs
      --limit <number>     Limit the number of files to process
      
  check-duplicates        Check for duplicate files in sources_google by name or drive_id
                          Identifies files that appear multiple times in the database
    Options:
      -l, --limit <n>      Limit the number of duplicate groups to display (default: 10)
      -j, --json           Output in JSON format
      -n, --by-name        Check duplicates by name (default)
      -d, --by-drive-id    Check duplicates by drive_id
      -a, --all            Check both name and drive_id duplicates
      -v, --verbose        Show detailed information for each duplicate

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