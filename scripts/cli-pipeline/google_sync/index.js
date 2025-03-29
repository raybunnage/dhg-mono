#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const dayjs = require('dayjs');
const path = require('path');
const program = new Command();

// Load configuration and environment variables
const { loadConfig } = require('./config');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });
const config = loadConfig();

// Set up service adapters (these connect to the shared TypeScript services)
const GoogleAuthAdapter = require('./auth-adapter');
const GoogleDriveAdapter = require('./drive-adapter');

// Version from package.json
program.version('1.0.0');

// Common options that apply to all or most commands
const addCommonOptions = (command) => {
  return command
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--no-color', 'Disable color output');
};

// Auth command
const authCommand = program.command('auth')
  .description('Manage Google Drive authentication');

addCommonOptions(
  authCommand.command('status')
    .description('Check if Google auth token is valid')
    .action(async (options) => {
      console.log(chalk.blue('Checking Google auth token status...'));
      // Use the GoogleAuthAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const isValid = await authService.isTokenValid();
      
      if (isValid) {
        const expInfo = authService.getTokenExpirationTime();
        console.log(chalk.green(`✓ Token is valid (expires in ${expInfo.formattedTime})`));
      } else {
        console.log(chalk.red('✗ Token is invalid or expired'));
        console.log(chalk.yellow('Run "google-sync auth login" to authenticate'));
      }
    })
);

addCommonOptions(
  authCommand.command('login')
    .description('Login to Google Drive and get a new token')
    .action(async (options) => {
      console.log(chalk.blue('Starting Google authentication flow...'));
      // Use the GoogleAuthAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const success = await authService.authenticate();
      
      if (success) {
        console.log(chalk.green('✓ Authentication successful'));
        
        const expInfo = authService.getTokenExpirationTime();
        console.log(chalk.blue(`Token expires in ${expInfo.formattedTime}`));
      } else {
        console.log(chalk.red('✗ Authentication failed'));
      }
    })
);

addCommonOptions(
  authCommand.command('refresh')
    .description('Refresh the Google auth token')
    .action(async (options) => {
      console.log(chalk.blue('Refreshing Google auth token...'));
      // Use the GoogleAuthAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const success = await authService.refreshToken();
      
      if (success) {
        console.log(chalk.green('✓ Token refreshed successfully'));
        
        const expInfo = authService.getTokenExpirationTime();
        console.log(chalk.blue(`Token expires in ${expInfo.formattedTime}`));
      } else {
        console.log(chalk.red('✗ Token refresh failed'));
        console.log(chalk.yellow('Run "google-sync auth login" to authenticate'));
      }
    })
);

// Sync command
const syncCommand = program.command('sync')
  .description('Sync files with Google Drive');

addCommonOptions(
  syncCommand.command('folder')
    .description('Sync a specific Google Drive folder')
    .requiredOption('-i, --id <folder-id>', 'Google Drive folder ID to sync')
    .option('-r, --recursive', 'Sync recursively through subfolders', true)
    .option('-b, --batch-size <size>', 'Number of files to process in each batch', '50')
    .option('-d, --depth <levels>', 'Maximum folder depth to traverse', '10')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async (options) => {
      console.log(chalk.blue(`Syncing folder with ID: ${options.id}`));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Syncing folder...').start();
      
      try {
        // Convert options
        const syncOptions = {
          recursive: options.recursive,
          maxDepth: parseInt(options.depth, 10),
          batchSize: parseInt(options.batchSize, 10),
          dryRun: options.dryRun,
        };
        
        // Sync
        const result = await driveService.syncFolder(options.id, syncOptions);
        
        spinner.succeed('Folder sync completed');
        
        // Display results
        console.log(chalk.green(`Files found: ${result.filesFound}`));
        console.log(chalk.green(`Files inserted: ${result.filesInserted}`));
        console.log(chalk.green(`Files updated: ${result.filesUpdated}`));
        console.log(chalk.green(`Total size: ${formatBytes(result.totalSize)}`));
        
        if (result.errors.length > 0) {
          console.log(chalk.yellow(`Errors: ${result.errors.length}`));
          if (options.verbose) {
            result.errors.forEach((error, i) => {
              console.log(chalk.red(`Error ${i + 1}: ${error.message}`));
            });
          }
        }
      } catch (error) {
        spinner.fail('Folder sync failed');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

addCommonOptions(
  syncCommand.command('roots')
    .description('Sync all registered root folders')
    .option('-b, --batch-size <size>', 'Number of files to process in each batch', '50')
    .option('-d, --depth <levels>', 'Maximum folder depth to traverse', '10')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async (options) => {
      console.log(chalk.blue('Syncing all root folders...'));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Syncing root folders...').start();
      
      try {
        // Convert options
        const syncOptions = {
          maxDepth: parseInt(options.depth, 10),
          batchSize: parseInt(options.batchSize, 10),
          dryRun: options.dryRun,
        };
        
        // Sync
        const result = await driveService.syncRootFolders(syncOptions);
        
        spinner.succeed('Root folders sync completed');
        
        // Display results
        console.log(chalk.green(`Folders processed: ${result.foldersProcessed}`));
        console.log(chalk.green(`Files found: ${result.filesFound}`));
        console.log(chalk.green(`Files inserted: ${result.filesInserted}`));
        console.log(chalk.green(`Files updated: ${result.filesUpdated}`));
        console.log(chalk.green(`Total size: ${formatBytes(result.totalSize)}`));
        
        if (result.errors.length > 0) {
          console.log(chalk.yellow(`Errors: ${result.errors.length}`));
          if (options.verbose) {
            result.errors.forEach((error, i) => {
              console.log(chalk.red(`Error ${i + 1}: ${error.message}`));
            });
          }
        }
      } catch (error) {
        spinner.fail('Root folders sync failed');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

// Roots management
const rootsCommand = program.command('roots')
  .description('Manage root folders for syncing');

addCommonOptions(
  rootsCommand.command('list')
    .description('List all registered root folders')
    .action(async (options) => {
      console.log(chalk.blue('Listing all root folders...'));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Fetching root folders...').start();
      
      try {
        const rootFolders = await driveService.listRootFolders();
        
        spinner.succeed('Root folders fetched');
        
        if (rootFolders.length === 0) {
          console.log(chalk.yellow('No root folders found'));
          console.log(chalk.blue('Use "google-sync roots add" to add a root folder'));
          return;
        }
        
        // Display results
        console.log(chalk.green(`Found ${rootFolders.length} root folders:`));
        
        rootFolders.forEach((folder, i) => {
          console.log(chalk.white(`${i + 1}. ${folder.name} (${folder.folder_id})`));
          console.log(chalk.gray(`   Added: ${dayjs(folder.created_at).format('YYYY-MM-DD HH:mm:ss')}`));
          if (folder.last_synced) {
            console.log(chalk.gray(`   Last synced: ${dayjs(folder.last_synced).format('YYYY-MM-DD HH:mm:ss')}`));
          } else {
            console.log(chalk.gray('   Last synced: Never'));
          }
        });
      } catch (error) {
        spinner.fail('Failed to fetch root folders');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

addCommonOptions(
  rootsCommand.command('add')
    .description('Add a new root folder for syncing')
    .requiredOption('-i, --id <folder-id>', 'Google Drive folder ID to add as root')
    .option('-n, --name <name>', 'Custom name for this root folder')
    .action(async (options) => {
      console.log(chalk.blue(`Adding root folder with ID: ${options.id}`));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Adding root folder...').start();
      
      try {
        const rootFolder = await driveService.addRootFolder(options.id, options.name);
        
        if (rootFolder) {
          spinner.succeed('Root folder added');
          console.log(chalk.green(`Added root folder: ${rootFolder.name} (${rootFolder.folder_id})`));
        } else {
          spinner.fail('Failed to add root folder');
        }
      } catch (error) {
        spinner.fail('Failed to add root folder');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

addCommonOptions(
  rootsCommand.command('remove')
    .description('Remove a root folder')
    .requiredOption('-i, --id <folder-id>', 'Google Drive folder ID to remove')
    .action(async (options) => {
      console.log(chalk.blue(`Removing root folder with ID: ${options.id}`));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Removing root folder...').start();
      
      try {
        const success = await driveService.removeRootFolder(options.id);
        
        if (success) {
          spinner.succeed('Root folder removed');
        } else {
          spinner.fail('Failed to remove root folder');
        }
      } catch (error) {
        spinner.fail('Failed to remove root folder');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

// Cleanup and maintenance
const cleanupCommand = program.command('cleanup')
  .description('Cleanup and maintenance operations');

addCommonOptions(
  cleanupCommand.command('fix-paths')
    .description('Fix missing parent paths in the database')
    .option('--dry-run', 'Show what would be fixed without making changes')
    .action(async (options) => {
      console.log(chalk.blue('Fixing missing parent paths...'));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Fixing parent paths...').start();
      
      try {
        const result = await driveService.fixParentPaths(options.dryRun);
        
        if (options.dryRun) {
          spinner.succeed(`Would fix ${result.fixed} parent paths`);
        } else {
          spinner.succeed(`Fixed ${result.fixed} parent paths`);
        }
        
        if (result.errors.length > 0) {
          console.log(chalk.yellow(`Errors: ${result.errors.length}`));
          if (options.verbose) {
            result.errors.forEach((error, i) => {
              console.log(chalk.red(`Error ${i + 1}: ${error.message}`));
            });
          }
        }
      } catch (error) {
        spinner.fail('Failed to fix parent paths');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

addCommonOptions(
  cleanupCommand.command('purge')
    .description('Purge old records from the database')
    .option('-d, --days <number>', 'Delete records older than this many days', '30')
    .option('--dry-run', 'Show what would be purged without making changes')
    .action(async (options) => {
      console.log(chalk.blue(`Purging records older than ${options.days} days...`));
      
      // TODO: Implement using shared service
      console.log(chalk.yellow('Purge functionality not yet implemented'));
    })
);

// Stats and reporting
const statsCommand = program.command('stats')
  .description('Get statistics about synced files');

addCommonOptions(
  statsCommand.command('sync')
    .description('Get sync statistics')
    .option('-f, --folder-id <id>', 'Get stats for a specific folder only')
    .action(async (options) => {
      console.log(chalk.blue('Getting sync statistics...'));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Fetching statistics...').start();
      
      try {
        const stats = await driveService.getSyncStats(options.folderId);
        
        spinner.succeed('Statistics fetched');
        
        // Display results
        console.log(chalk.green(`Total files: ${stats.totalFiles}`));
        console.log(chalk.green(`Total folders: ${stats.totalFolders}`));
        console.log(chalk.green(`Total size: ${formatBytes(stats.totalSize)}`));
        console.log(chalk.green(`Synced files: ${stats.syncedFiles}`));
        console.log(chalk.green(`Failed files: ${stats.failedFiles}`));
        
        console.log(chalk.blue('\nFile types:'));
        Object.entries(stats.fileTypes).forEach(([type, count]) => {
          console.log(chalk.white(`${type}: ${count}`));
        });
      } catch (error) {
        spinner.fail('Failed to fetch statistics');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

addCommonOptions(
  statsCommand.command('types')
    .description('Get statistics by file types')
    .action(async (options) => {
      console.log(chalk.blue('Getting file type statistics...'));
      
      // TODO: Implement using shared service
      console.log(chalk.yellow('File type statistics not yet implemented'));
    })
);

// File operations
const filesCommand = program.command('files')
  .description('Operations on synced files');

addCommonOptions(
  filesCommand.command('list')
    .description('List synced files')
    .option('-f, --folder-id <id>', 'List files in a specific folder')
    .option('-t, --type <mime-type>', 'Filter by MIME type')
    .option('-l, --limit <number>', 'Maximum number of files to list', '50')
    .option('--csv', 'Output in CSV format')
    .action(async (options) => {
      console.log(chalk.blue('Listing synced files...'));
      
      // TODO: Implement using shared service
      console.log(chalk.yellow('File listing not yet implemented'));
    })
);

addCommonOptions(
  filesCommand.command('extract')
    .description('Extract content from synced files')
    .requiredOption('-i, --id <file-id>', 'File ID to extract content from')
    .option('-o, --output <path>', 'Path to save extracted content')
    .action(async (options) => {
      console.log(chalk.blue(`Extracting content from file ID: ${options.id}`));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Extracting content...').start();
      
      try {
        const outputPath = options.output || path.join(process.cwd(), `extracted_${options.id}.txt`);
        
        const result = await driveService.extractFileContent(options.id, outputPath);
        
        if (result.success) {
          spinner.succeed('Content extracted');
          console.log(chalk.green(`Content saved to: ${outputPath}`));
        } else {
          spinner.fail(`Failed to extract content: ${result.message}`);
        }
      } catch (error) {
        spinner.fail('Failed to extract content');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

addCommonOptions(
  filesCommand.command('batch-extract')
    .description('Extract content from multiple files in batch')
    .option('-t, --type <mime-type>', 'Filter by MIME type for batch extraction')
    .option('-l, --limit <number>', 'Maximum number of files to process', '20')
    .option('-b, --batch-size <number>', 'Batch size for processing', '5')
    .action(async (options) => {
      console.log(chalk.blue('Starting batch content extraction...'));
      
      // TODO: Implement using shared service
      console.log(chalk.yellow('Batch content extraction not yet implemented'));
    })
);

// Process audio files
const audioCommand = program.command('audio')
  .description('Operations on audio files');

addCommonOptions(
  audioCommand.command('extract')
    .description('Extract audio from video or audio files')
    .requiredOption('-i, --id <file-id>', 'File ID to extract audio from')
    .option('-o, --output-dir <path>', 'Directory to save extracted audio')
    .option('-f, --format <format>', 'Output format (mp3, wav, etc.)', 'mp3')
    .action(async (options) => {
      console.log(chalk.blue(`Extracting audio from file ID: ${options.id}`));
      
      // TODO: Implement using shared service
      console.log(chalk.yellow('Audio extraction not yet implemented'));
    })
);

addCommonOptions(
  audioCommand.command('batch-extract')
    .description('Extract audio from multiple files in batch')
    .option('-t, --type <mime-type>', 'Filter by MIME type for batch extraction', 'video/')
    .option('-l, --limit <number>', 'Maximum number of files to process', '10')
    .option('-b, --batch-size <number>', 'Batch size for processing', '2')
    .action(async (options) => {
      console.log(chalk.blue('Starting batch audio extraction...'));
      
      // TODO: Implement using shared service
      console.log(chalk.yellow('Batch audio extraction not yet implemented'));
    })
);

// Connection management
addCommonOptions(
  program.command('test-connection')
    .description('Test connections to Google Drive and Supabase')
    .action(async (options) => {
      console.log(chalk.blue('Testing connections...'));
      
      // Use the GoogleDriveAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      const driveService = new GoogleDriveAdapter(config, authService);
      
      const spinner = ora('Testing connections...').start();
      
      try {
        const result = await driveService.testConnections();
        
        spinner.succeed('Connection tests completed');
        
        if (result.google) {
          console.log(chalk.green('✓ Google Drive: Connected'));
        } else {
          console.log(chalk.red('✗ Google Drive: Not connected'));
        }
        
        if (result.supabase) {
          console.log(chalk.green('✓ Supabase: Connected'));
        } else {
          console.log(chalk.red('✗ Supabase: Not connected'));
        }
      } catch (error) {
        spinner.fail('Connection tests failed');
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

// Display timer function for token expiration
addCommonOptions(
  program.command('token-timer')
    .description('Display time until token expiration')
    .action(async (options) => {
      console.log(chalk.blue('Checking token expiration...'));
      
      // Use the GoogleAuthAdapter which connects to shared services
      const authService = new GoogleAuthAdapter(config);
      
      try {
        const isValid = await authService.isTokenValid();
        
        if (isValid) {
          const expInfo = authService.getTokenExpirationTime();
          console.log(chalk.green(`Token is valid and expires in ${expInfo.formattedTime}`));
        } else {
          console.log(chalk.red('Token is invalid or expired'));
          console.log(chalk.yellow('Run "google-sync auth login" to authenticate'));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
      }
    })
);

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to show generic examples
program
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  # Check Google auth status');
    console.log('  $ google-sync auth status');
    console.log('');
    console.log('  # Sync a specific folder');
    console.log('  $ google-sync sync folder --id 1EHBAhSv1hmcuctiAgaLI9stLvefFFl3m');
    console.log('');
    console.log('  # List synced files of a specific type');
    console.log('  $ google-sync files list --type "audio/x-m4a" --limit 10');
  });

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}