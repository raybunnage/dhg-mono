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
import { updateFileSignatures } from './update-file-signatures';
import { countMp4Files, CountMp4Result } from './count-mp4-files';
import { addRootFolder } from './add-root-service';
import { checkReprocessingStatus } from './check-reprocessing-status';
// These functions may not exist as TypeScript exports, so we'll use direct file paths 
// or wrap them in a functional command

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

// Define reclassify-docs command
program
  .command('reclassify-docs')
  .description('Re-classify documents that need reprocessing based on file type')
  .option('--limit <number>', 'Maximum number of records to process', '500')
  .option('--dry-run', 'Show what would be done without making changes', false)
  .action(async (options: any) => {
    try {
      // This is just a stub since the actual implementation is in the shell script
      // The health check now looks for this command in the program definition
      console.log('This command is implemented in the shell script wrapper.');
      console.log('Please use ./google-sync-cli.sh reclassify-docs instead.');
      process.exit(0);
    } catch (error) {
      Logger.error('Error in reclassify-docs command:', error);
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
      // Instead of using browser-recursive-search.sh, generate the script content directly
      const browserScriptContent = `
// Browser-based recursive search for Google Drive folders
// Run this script in your browser's JavaScript console while logged into Google Drive
const folderId = '${options.folderId}';
const maxDepth = 10;
const exportToJson = true;

// Function to search folders recursively
async function searchFoldersRecursively(folderId, depth = 0, path = []) {
  if (depth > maxDepth) return [];
  
  console.log(\`Searching folder at depth \${depth}: \${folderId}\`);
  
  // Get folder metadata
  const folderResponse = await gapi.client.drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType,parents'
  });
  
  const folder = folderResponse.result;
  const currentPath = [...path, folder.name];
  console.log(\`Current path: \${currentPath.join('/')}\`);
  
  // Add this folder to results
  const result = [{
    id: folder.id,
    name: folder.name,
    mimeType: folder.mimeType,
    path: currentPath,
    depth: depth
  }];
  
  // Get all items in this folder
  const response = await gapi.client.drive.files.list({
    q: \`'\${folderId}' in parents and trashed = false\`,
    fields: 'files(id,name,mimeType,parents,webViewLink,modifiedTime)',
    pageSize: 1000
  });
  
  const files = response.result.files;
  console.log(\`Found \${files.length} items in folder\`);
  
  // Add all non-folder files to results
  files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder')
    .forEach(file => {
      result.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        path: [...currentPath, file.name],
        depth: depth + 1
      });
    });
  
  // Recursively process subfolders
  const subfolders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
  
  for (const subfolder of subfolders) {
    const subResults = await searchFoldersRecursively(subfolder.id, depth + 1, currentPath);
    result.push(...subResults);
  }
  
  return result;
}

// Main function
async function main() {
  console.log('Initializing Drive API...');
  
  // Initialize the API client
  await gapi.client.init({
    apiKey: 'YOUR_API_KEY',  // Replace with your API key
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  });
  
  console.log('Starting recursive search...');
  
  try {
    const results = await searchFoldersRecursively(folderId);
    console.log(\`Completed search. Found \${results.length} total items.\`);
    
    if (exportToJson) {
      const jsonStr = JSON.stringify(results, null, 2);
      console.log('Results as JSON:');
      console.log(jsonStr);
      
      // Create downloadable link
      const blob = new Blob([jsonStr], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'drive-files.json';
      
      console.log('Click the link below to download results:');
      console.log(link);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error during search:', error);
  }
}

// Load the gapi client and execute
gapi.load('client', main);
`;
      
      // Generate the script directly
      Logger.info(`Generating browser recursive search script for folder ID: ${options.folderId}`);
      Logger.info(`Output will be saved to: ${options.output}`);
      
      // Add a proper markdown header
      const markdownContent = `# Browser Recursive Search Tool for Google Drive\n\n${browserScriptContent}`;
      
      // Write to the output file
      fs.writeFileSync(options.output, markdownContent);
      Logger.info(`Successfully saved browser recursive search script to: ${options.output}`);
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

// update-folder-video-mapping command removed

// Add sync-and-update-metadata command
program
  .command('sync-and-update-metadata')
  .description('Sync files from Google Drive with intelligent file categorization')
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

// Add update-file-signatures command
program
  .command('update-file-signatures')
  .description('Update all file signatures to use the consistent new format')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--batch-size <number>', 'Process records in batches of n (default: 50)', '50')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      const batchSize = parseInt(options.batchSize, 10);
      await updateFileSignatures(options.dryRun, batchSize, options.verbose);
      Logger.info('File signatures update complete');
    } catch (error) {
      Logger.error('Error updating file signatures:', error);
      process.exit(1);
    }
  });

// Classification is now handled solely by the classify-docs-with-service command

// Add count-mp4 command
program
  .command('count-mp4')
  .description('Count MP4 files in a Google Drive folder')
  .argument('[drive-id]', 'Google Drive folder ID or name to search in')
  .option('--list', 'List all files found', false)
  .option('--summary', 'Show only summary information', false)
  .option('--local', 'Use local filesystem instead of Google Drive', false)
  .option('--verbose', 'Show detailed logs', false)
  .option('--recursive', 'Search recursively through subfolders (up to max depth)', false)
  .option('--max-depth <number>', 'Maximum folder depth to recursively search (default: 6)', '6')
  .action(async (driveId, options) => {
    try {
      const result = await countMp4Files({
        driveId,
        list: options.list,
        summary: options.summary,
        local: options.local,
        verbose: options.verbose,
        recursive: options.recursive,
        maxDepth: parseInt(options.maxDepth, 10)
      });
      
      // If summary only, output just the count
      if (options.summary) {
        console.log(`${result.total}`);
      }
      
      // Success exit code
      process.exit(0);
    } catch (error) {
      Logger.error('Error counting MP4 files:', error);
      process.exit(1);
    }
  });

// Add add-root-service command
program
  .command('add-root-service')
  .description('Add a new root folder using service account')
  .argument('<folder-id>', 'Google Drive folder ID or alias (e.g., dynamic-healing)')
  .option('--name <name>', 'Custom name for the folder')
  .option('--description <description>', 'Optional description for the folder')
  .option('--dry-run', 'Show what would be done without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (folderId, options) => {
    try {
      const success = await addRootFolder(
        folderId,
        options.name,
        options.description,
        options.dryRun,
        options.verbose
      );
      
      process.exit(success ? 0 : 1);
    } catch (error) {
      Logger.error('Error adding root folder:', error);
      process.exit(1);
    }
  });

// Add classify-docs-with-service command
program
  .command('classify-docs-with-service')
  .description('Classify files missing document types using the PromptService')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Path to write analysis results', './document-analysis-results')
  .option('-v, --verbose', 'Show detailed logs', false)
  .option('-d, --debug', 'Show debug information', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or name')
  .option('--include-pdfs', 'Include PDF files in classification (default is only .docx and .txt)', false)
  .action(async (options) => {
    try {
      console.log('Launching the command via ts-node directly...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'classify-missing-docs-with-service.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      if (options.debug) cmd += ' --debug';
      if (options.dryRun) cmd += ' --dry-run';
      if (options.folderId) cmd += ` --folder-id "${options.folderId}"`;
      if (options.includePdfs) cmd += ' --include-pdfs';
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing classify-docs-with-service:', error);
      process.exit(1);
    }
  });

// Add classify-pdfs-with-service command
program
  .command('classify-pdfs-with-service')
  .description('Classify PDF files missing document types using the PromptService')
  .option('-l, --limit <number>', 'Limit the number of PDF files to process', '10')
  .option('-o, --output <path>', 'Path to write analysis results', './document-analysis-results/pdf-classification.json')
  .option('-v, --verbose', 'Show detailed logs', false)
  .option('-d, --debug', 'Show debug information', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or name')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (default: 3)', '3')
  .action(async (options) => {
    try {
      console.log('Launching the PDF classification command via ts-node...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'classify-pdfs-with-service.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      if (options.debug) cmd += ' --debug';
      if (options.dryRun) cmd += ' --dry-run';
      if (options.folderId) cmd += ` --folder-id "${options.folderId}"`;
      if (options.concurrency) cmd += ` --concurrency ${options.concurrency}`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing classify-pdfs-with-service:', error);
      process.exit(1);
    }
  });

// Add reclassify-docs-with-service command
program
  .command('reclassify-docs-with-service')
  .description('Re-classify already classified documents with temperature 0 for deterministic results')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Path to write analysis results', './document-analysis-results/reclassification.json')
  .option('-v, --verbose', 'Show detailed logs', false)
  .option('-d, --debug', 'Show debug information', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or name')
  .option('--include-pdfs', 'Include PDF files in classification (default: true)', true)
  .option('--exclude-pdfs', 'Exclude PDF files from classification', false)
  .option('--start-date <date>', 'Only process files created after this date (YYYY-MM-DD)', '')
  .action(async (options) => {
    try {
      console.log('Launching the reclassification command via ts-node...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'reclassify-docs-with-service.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      if (options.debug) cmd += ' --debug';
      if (options.dryRun) cmd += ' --dry-run';
      if (options.folderId) cmd += ` --folder-id "${options.folderId}"`;
      if (options.excludePdfs) cmd += ' --exclude-pdfs';
      if (options.startDate) cmd += ` --start-date "${options.startDate}"`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing reclassify-docs-with-service:', error);
      process.exit(1);
    }
  });

// Add test-prompt-service command
program
  .command('test-prompt-service')
  .description('Test the new PromptService')
  .option('-o, --output <path>', 'Path to write output to', 'docs/cli-pipeline/prompt-test-result.md')
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      console.log('Launching the command via ts-node directly...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'test-prompt-service.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing test-prompt-service:', error);
      process.exit(1);
    }
  });

// Add show-expert-documents command
program
  .command('show-expert-documents')
  .description('Generate a report of expert documents in the database')
  .option('--limit <number>', 'Limit the number of records to show', '100')
  .option('--output <path>', 'Path to write output to', 'docs/cli-pipeline/expert-documents-report.md')
  .option('--verbose', 'Show detailed logs', false)
  .option('--expert <name>', 'Filter by expert name')
  .action(async (options) => {
    try {
      console.log('Launching show-expert-documents command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'show-expert-documents.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      if (options.expert) cmd += ` --expert "${options.expert}"`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing show-expert-documents:', error);
      process.exit(1);
    }
  });

// Add list-unclassified-files command
program
  .command('list-unclassified-files')
  .description('List PDF and PowerPoint files without document types')
  .option('--output <path>', 'Path to write output to', 'docs/cli-pipeline/unclassified_files.md')
  .option('--verbose', 'Show detailed logs', false)
  .option('--limit <number>', 'Limit the number of files to list', '100')
  .action(async (options) => {
    try {
      console.log('Launching list-unclassified-files command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'list-unclassified-files.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      if (options.limit) cmd += ` --limit ${options.limit}`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing list-unclassified-files:', error);
      process.exit(1);
    }
  });

// Add check-expert-doc command
program
  .command('check-expert-doc')
  .description('Check the most recent expert document for proper content extraction')
  .option('--id <id>', 'Specific document ID to check')
  .option('--expert <name>', 'Filter by expert name')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      console.log('Launching check-expert-doc command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'check-expert-doc.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.id) cmd += ` --id "${options.id}"`;
      if (options.expert) cmd += ` --expert "${options.expert}"`;
      if (options.verbose) cmd += ' --verbose';
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing check-expert-doc:', error);
      process.exit(1);
    }
  });

// Add fix-orphaned-docx command
program
  .command('fix-orphaned-docx')
  .description('Fix DOCX files with document_type_id but no expert_documents records')
  .option('--dry-run', 'Show what would be fixed without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .option('--limit <number>', 'Limit the number of files to process', '100')
  .action(async (options) => {
    try {
      console.log('Launching fix-orphaned-docx command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'fix-orphaned-docx.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.dryRun) cmd += ' --dry-run';
      if (options.verbose) cmd += ' --verbose';
      if (options.limit) cmd += ` --limit ${options.limit}`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing fix-orphaned-docx:', error);
      process.exit(1);
    }
  });

// Add remove-expert-docs-pdf-records command
program
  .command('remove-expert-docs-pdf-records')
  .description('Remove expert_documents for PDF files with null document_type_id (incl. large PDFs)')
  .option('--dry-run', 'Show what would be removed without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .option('--limit <number>', 'Limit the number of files to process', '50')
  .action(async (options) => {
    try {
      console.log('Launching remove-expert-docs-pdf-records command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'remove-expert-docs-pdf-records.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.dryRun) cmd += ' --dry-run';
      if (options.verbose) cmd += ' --verbose';
      if (options.limit) cmd += ` --limit ${options.limit}`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing remove-expert-docs-pdf-records:', error);
      process.exit(1);
    }
  });

// Add validate-pdf-classification command
program
  .command('validate-pdf-classification')
  .description('Validate PDF classification results and generate a report')
  .option('--limit <number>', 'Limit the number of files to validate', '10')
  .option('--output <path>', 'Path to write output to', 'docs/cli-pipeline/pdf-validation-10-docs.md')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      console.log('Launching validate-pdf-classification command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'validate-pdf-classification.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.output) cmd += ` --output "${options.output}"`;
      if (options.verbose) cmd += ' --verbose';
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing validate-pdf-classification:', error);
      process.exit(1);
    }
  });

// Add check-recent-updates command
program
  .command('check-recent-updates')
  .description('Show recently updated files and their associated expert documents')
  .option('--limit <number>', 'Limit the number of files to check', '10')
  .option('--days <number>', 'Check files updated in the last n days', '7')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      console.log('Launching check-recent-updates command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'check-recent-updates.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.days) cmd += ` --days ${options.days}`;
      if (options.verbose) cmd += ' --verbose';
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing check-recent-updates:', error);
      process.exit(1);
    }
  });

// Add update-media-document-types command
program
  .command('update-media-document-types')
  .description('Update document_type_id for media files and create corresponding expert_documents')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--skip-expert-docs', 'Skip creating expert_documents', false)
  .option('--batch-size <number>', 'Number of expert_documents to create in each batch', '50')
  .action(async (options) => {
    try {
      console.log('Launching update-media-document-types command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'update-media-document-types.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.dryRun) cmd += ' --dry-run';
      if (options.skipExpertDocs) cmd += ' --skip-expert-docs';
      if (options.batchSize) cmd += ` --batch-size ${options.batchSize}`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing update-media-document-types:', error);
      process.exit(1);
    }
  });

// Add wrapper command for fix-mp4-status
program
  .command('fix-mp4-status')
  .description('Fix MP4 files that are incorrectly marked as needs_reprocessing')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      // This script is implemented as a standalone file accessed through google-sync-cli.sh
      // This command entry is just for the health check
      console.log('fix-mp4-status command is executed directly through the shell script');
      console.log('Please run: ./google-sync-cli.sh fix-mp4-status [options]');
      process.exit(0);
    } catch (error) {
      console.error('Error executing fix-mp4-status:', error);
      process.exit(1);
    }
  });

// Add wrapper command for ids-need-reprocessing
program
  .command('ids-need-reprocessing')
  .description('Reset document_processing_status to needs_reprocessing for specified sources')
  .argument('<ids>', 'Comma-separated list of source IDs to reset')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('-v, --verbose', 'Show detailed output', false)
  .action(async (ids, options) => {
    try {
      // This script is implemented as a standalone file accessed through google-sync-cli.sh
      // This command entry is just for the health check
      console.log('ids-need-reprocessing command is executed directly through the shell script');
      console.log('Please run: ./google-sync-cli.sh ids-need-reprocessing <ids> [options]');
      process.exit(0);
    } catch (error) {
      console.error('Error executing ids-need-reprocessing:', error);
      process.exit(1);
    }
  });

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
      
  update-file-signatures  Update all file signatures to use the consistent new format
                          Ensures file_signature values properly handle file renames
    Options:
      --dry-run            Show what would be updated without making changes
      --batch-size <n>     Process records in batches of n (default: 50)
      --verbose            Show detailed logs
      
  classify-docs-with-service  Classify files missing document types using the PromptService
                          Uses Claude AI with the new PromptService for classification
    Options:
      -l, --limit <number>     Limit the number of files to process (default: 10)
      -o, --output <path>      Path to write analysis results
      -v, --verbose            Show detailed logs
      -d, --debug              Show debug information
      --dry-run                Process files but do not update database
      --folder-id <id>         Filter by Google Drive folder ID or name
      --include-pdfs           Include PDF files in classification (default is only .docx and .txt)
      -o, --output <path>      Path to write analysis results
      -v, --verbose            Show detailed logs
      -d, --debug              Show debug information
      --dry-run                Process files but do not update database
      --folder-id <id>         Filter by Google Drive folder ID or name
      --include-pdfs           Include PDF files in classification (default is only .docx and .txt)
      
  test-prompt-service      Test the new PromptService
                          Tests loading prompts and metadata extraction
    Options:
      -o, --output <path>      Path to write output to (default: docs/cli-pipeline/prompt-test-result.md)
      -v, --verbose            Show detailed logs
      
  count-mp4               Count MP4 files in a Google Drive folder
                          Finds video files in Google Drive or local filesystem
    Arguments:
      [drive-id]                 Google Drive folder ID or name to search in
    Options:
      --list                     List all files found
      --summary                  Show only summary information
      --local                    Use local filesystem instead of Google Drive
      --verbose                  Show detailed logs

For detailed help on a specific command, run:
  google-sync-cli [command] --help
`);
  program.outputHelp();
}

// Add expert-documents-duplicates command
program
  .command('expert-documents-duplicates')
  .description('Find and display duplicate expert_documents for the same source_id')
  .option('--limit <number>', 'Limit the number of duplicates to show', '100')
  .option('--dry-run', 'Show duplicates without deleting any records', true)
  .option('--delete', 'Delete duplicate records (dangerous)', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      // This command is implemented in the shell script wrapper
      console.log('expert-documents-duplicates command is executed through the shell script');
      console.log('Please run: ./google-sync-cli.sh expert-documents-duplicates [options]');
      process.exit(0);
    } catch (error) {
      console.error('Error executing expert-documents-duplicates:', error);
      process.exit(1);
    }
  });

// Add expert-documents-purge command
program
  .command('expert-documents-purge')
  .description('Purge expert_documents with null document_type_id')
  .option('--limit <number>', 'Limit the number of records to purge', '100')
  .option('--dry-run', 'Show what would be purged without making changes', true)
  .option('--execute', 'Actually execute the purge', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      // This command is implemented in the shell script wrapper
      console.log('expert-documents-purge command is executed through the shell script');
      console.log('Please run: ./google-sync-cli.sh expert-documents-purge [options]');
      process.exit(0);
    } catch (error) {
      console.error('Error executing expert-documents-purge:', error);
      process.exit(1);
    }
  });

// Add check-duplicate-prevention command
program
  .command('check-duplicate-prevention')
  .description('Check if duplicate prevention is working correctly')
  .option('--verbose', 'Show detailed logs', false)
  .option('--test-insert', 'Test insert with duplicate prevention', false)
  .action(async (options) => {
    try {
      // This command is implemented in the shell script wrapper
      console.log('check-duplicate-prevention command is executed through the shell script');
      console.log('Please run: ./google-sync-cli.sh check-duplicate-prevention [options]');
      process.exit(0);
    } catch (error) {
      console.error('Error executing check-duplicate-prevention:', error);
      process.exit(1);
    }
  });

// Add check-deleted-files command  
program
  .command('check-deleted-files')
  .description('Check if files marked as deleted in the database still exist in Google Drive')
  .option('--limit <number>', 'Limit the number of files to check', '10')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options) => {
    try {
      // This command is implemented in the shell script wrapper
      console.log('check-deleted-files command is executed through the shell script');
      console.log('Please run: ./google-sync-cli.sh check-deleted-files [options]');
      process.exit(0);
    } catch (error) {
      console.error('Error executing check-deleted-files:', error);
      process.exit(1);
    }
  });

// Add classify-unprocessed-with-content command
program
  .command('classify-unprocessed-with-content')
  .description('Find docx/txt/pptx files with content and classify them using AI')
  .option('-l, --limit <number>', 'Limit the number of files to process (default: 10)', '10')
  .option('--dry-run', 'Run without making database changes', false)
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-m, --mime-types <types>', 'Comma-separated mime types to process (default: docx,txt,pptx)', 'docx,txt,pptx')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (1-5, default: 1)', '1')
  .action(async (options) => {
    try {
      console.log('Launching classify-unprocessed-with-content command...');
      const { exec } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.resolve(__dirname, 'classify-unprocessed-with-content.ts');
      
      // Build command with options
      let cmd = `ts-node "${scriptPath}"`;
      if (options.limit) cmd += ` --limit ${options.limit}`;
      if (options.dryRun) cmd += ' --dry-run';
      if (options.verbose) cmd += ' --verbose';
      if (options.mimeTypes) cmd += ` --mime-types "${options.mimeTypes}"`;
      if (options.concurrency) cmd += ` --concurrency ${options.concurrency}`;
      
      console.log(`Executing: ${cmd}`);
      
      exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing classify-unprocessed-with-content:', error);
      process.exit(1);
    }
  });

// Handle any unhandled exceptions
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});