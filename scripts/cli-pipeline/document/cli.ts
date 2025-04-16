/**
 * Document CLI
 * 
 * Command-line interface for the document pipeline.
 * Uses shared CLI service for command parsing and execution.
 */
import { cliService } from '../shared/services/cli-service';
import { documentService } from './services/document-service';
import { logger } from '../shared/services/logger-service';
import { environmentService } from '../shared/services/environment-service';

// Register commands
cliService.registerCommand({
  name: 'test-connection',
  description: 'Test connection to Supabase',
  action: async () => {
    cliService.startSpinner('Testing connection to Supabase...');
    const success = await documentService.testConnection();
    cliService.stopSpinner();
    
    if (success) {
      cliService.success('Successfully connected to Supabase');
    } else {
      cliService.error('Failed to connect to Supabase');
    }
  }
});

cliService.registerCommand({
  name: 'sync',
  description: 'Synchronize database with files on disk',
  action: async () => {
    cliService.startSpinner('Synchronizing files...');
    const result = await documentService.syncFiles();
    cliService.stopSpinner();
    
    if (result.success) {
      cliService.success('Files synchronized successfully');
    } else {
      cliService.warn('Files synchronized with some errors');
    }
    
    console.log(`\nSync Results:`);
    console.log(`- ${result.existCount} files exist on disk`);
    console.log(`- ${result.notExistCount} files no longer exist and were removed from database`);
    console.log(`- ${result.updatedCount} files had their metadata updated`);
    console.log(`- ${result.errorCount} errors occurred during processing`);
  }
});

cliService.registerCommand({
  name: 'find-new',
  description: 'Find and insert new files on disk into the database',
  action: async () => {
    cliService.startSpinner('Finding new files...');
    const result = await documentService.findNewFiles();
    cliService.stopSpinner();
    
    if (result.success) {
      cliService.success('New files found and added successfully');
    } else {
      cliService.warn('New files found with some errors');
    }
    
    console.log(`\nFind New Files Results:`);
    console.log(`- ${result.added} new files added to the database`);
    console.log(`- ${result.errors} errors occurred during processing`);
    console.log(`- ${result.total} total files scanned`);
  }
});

cliService.registerCommand({
  name: 'show-untyped',
  description: 'Show all documentation files without a document type',
  options: [
    {
      name: 'limit',
      shortName: 'l',
      description: 'Maximum number of files to show',
      type: 'number',
      default: 20
    }
  ],
  action: async (args) => {
    const limit = args.limit || 20;
    await documentService.showUntypedFiles(limit);
  }
});

cliService.registerCommand({
  name: 'show-recent',
  description: 'Show the most recent files based on update date',
  options: [
    {
      name: 'limit',
      shortName: 'l',
      description: 'Maximum number of files to show',
      type: 'number',
      default: 20
    }
  ],
  action: async (args) => {
    const limit = args.limit || 20;
    await documentService.showRecentFiles(limit);
  }
});

cliService.registerCommand({
  name: 'classify-recent',
  description: 'Classify the most recent files',
  options: [
    {
      name: 'count',
      shortName: 'c',
      description: 'Number of files to classify',
      type: 'number',
      default: 10
    }
  ],
  action: async (args) => {
    // Check for Claude API key
    if (!environmentService.get('claudeApiKey')) {
      cliService.error('Missing Claude API key. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
      return;
    }
    
    const count = args.count || 10;
    cliService.startSpinner(`Classifying ${count} recent files...`);
    const success = await documentService.classifyDocuments(count, false);
    cliService.stopSpinner();
    
    if (success) {
      cliService.success('Files classified successfully');
    } else {
      cliService.error('Failed to classify files');
    }
  }
});

cliService.registerCommand({
  name: 'classify-untyped',
  description: 'Classify untyped files',
  options: [
    {
      name: 'count',
      shortName: 'c',
      description: 'Number of files to classify',
      type: 'number',
      default: 10
    }
  ],
  action: async (args) => {
    // Check for Claude API key
    if (!environmentService.get('claudeApiKey')) {
      cliService.error('Missing Claude API key. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
      return;
    }
    
    const count = args.count || 10;
    cliService.startSpinner(`Classifying ${count} untyped files...`);
    const success = await documentService.classifyDocuments(count, true);
    cliService.stopSpinner();
    
    if (success) {
      cliService.success('Files classified successfully');
    } else {
      cliService.error('Failed to classify files');
    }
  }
});

cliService.registerCommand({
  name: 'all',
  description: 'Run the complete pipeline (sync, find-new, classify-recent)',
  action: async () => {
    // Check for Claude API key
    if (!environmentService.get('claudeApiKey')) {
      cliService.warn('Missing Claude API key. Classification steps will be skipped.');
    }
    
    // Step 1: Sync files
    cliService.info('Step 1/3: Synchronizing files...');
    const syncResult = await documentService.syncFiles();
    
    if (syncResult.success) {
      cliService.success('Files synchronized successfully');
    } else {
      cliService.warn('Files synchronized with some errors');
    }
    
    // Step 2: Find new files
    cliService.info('Step 2/3: Finding new files...');
    const findResult = await documentService.findNewFiles();
    
    if (findResult.success) {
      cliService.success('New files found and added successfully');
    } else {
      cliService.warn('New files found with some errors');
    }
    
    // Step 3: Classify recent files
    if (environmentService.get('claudeApiKey')) {
      cliService.info('Step 3/3: Classifying recent files...');
      const classifyResult = await documentService.classifyDocuments(5, false);
      
      if (classifyResult) {
        cliService.success('Files classified successfully');
      } else {
        cliService.warn('Files classification completed with some errors');
      }
    } else {
      cliService.info('Step 3/3: Skipping classification (no API key)');
    }
    
    cliService.success('Complete pipeline executed successfully');
  }
});

// Add test-classify-document-types command
cliService.registerCommand({
  name: 'test-classify-document-types',
  description: 'Test document classification with Claude by verifying document types are properly sent and received',
  action: async () => {
    // Check for Claude API key
    if (!environmentService.get('claudeApiKey')) {
      cliService.error('Missing Claude API key. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
      return;
    }
    
    cliService.info('Running document classification test...');
    cliService.info('This will execute the test in test-classify-document-types.sh');
    
    // Execute the test script
    const { execSync } = require('child_process');
    try {
      const scriptPath = `${__dirname}/test-classify-document-types.sh`;
      
      // Make sure the script is executable
      execSync(`chmod +x "${scriptPath}"`);
      
      // Run the script
      execSync(`"${scriptPath}"`, { stdio: 'inherit' });
      
      cliService.success('Test completed successfully');
    } catch (error) {
      cliService.error('Test failed. See output for details.');
      logger.error('Error running test:', error);
    }
  }
});

// Add test-google-doc-classification command
cliService.registerCommand({
  name: 'test-google-doc-classification',
  description: 'Test classifying Google Drive files with Claude without updating the database',
  action: async () => {
    // Check for Claude API key
    if (!environmentService.get('claudeApiKey')) {
      cliService.error('Missing Claude API key. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
      return;
    }
    
    // Check for Google Drive credentials
    if (!environmentService.get('googleCredentialsPath')) {
      cliService.error('Missing Google Drive credentials. Please set GOOGLE_CREDENTIALS_PATH environment variable.');
      return;
    }
    
    cliService.info('Running Google document classification test...');
    cliService.info('This will test classifying 6 Google Drive files without updating the database');
    
    // Execute the test script
    const { execSync } = require('child_process');
    try {
      const scriptPath = `${__dirname}/test-google-doc-classification.sh`;
      
      // Make sure the script is executable
      execSync(`chmod +x "${scriptPath}"`);
      
      // Run the script
      execSync(`"${scriptPath}"`, { stdio: 'inherit' });
      
      cliService.success('Test completed successfully');
    } catch (error) {
      cliService.error('Test failed. See output for details.');
      logger.error('Error running test:', error);
    }
  }
});

// Main function
async function main() {
  try {
    // Check for required environment variables
    const missingVars = environmentService.validateRequiredEnvVars([
      'supabaseUrl',
      'supabaseKey'
    ]);
    
    if (missingVars.length > 0) {
      cliService.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      process.exit(1);
    }
    
    // Parse command-line arguments and execute command
    await cliService.parseAndExecute();
  } catch (error) {
    logger.error('Unhandled error in CLI:', error);
    cliService.error('An error occurred. See logs for details.');
    process.exit(1);
  }
}

// Run the CLI
main();