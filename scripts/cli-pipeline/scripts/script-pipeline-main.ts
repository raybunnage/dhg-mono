/**
 * Script Pipeline Main
 * 
 * TypeScript implementation of the script pipeline command-line interface.
 * Replaces the previous shell script implementation with a service-based approach.
 */
import { scriptPipelineService } from '../shared/services/script-pipeline-service';
import { cliService } from '../shared/services/cli-service';
import { Command } from '../shared/interfaces/types';
import { nodeLogger as logger } from '@shared/services/logger/logger-node';
import { environmentService } from '../shared/services/environment-service';

// Register commands
function registerCommands(): void {
  // Sync command
  cliService.registerCommand({
    name: 'sync',
    description: 'Synchronize database with files on disk',
    action: async () => {
      try {
        // First try the direct sync approach, which is more reliable
        const path = require('path');
        const { execSync } = require('child_process');
        
        const scriptPath = path.join(__dirname, 'sync-scripts.sh');
        cliService.info(`Running direct sync script: ${scriptPath}`);
        
        try {
          execSync(`bash "${scriptPath}"`, { 
            encoding: 'utf8',
            stdio: 'inherit'
          });
          cliService.success('Direct script sync completed successfully');
          return;
        } catch (directError) {
          cliService.warn(`Direct sync failed, falling back to service method: ${directError}`);
        }
      } catch (setupError) {
        cliService.warn(`Error setting up direct sync: ${setupError}`);
      }
      
      // Fall back to the service method if direct approach fails
      const result = await scriptPipelineService.syncScripts();
      if (result === 0) {
        cliService.success('Script sync completed successfully');
      } else {
        cliService.error('Script sync failed');
      }
    }
  });
  
  // Find new command
  cliService.registerCommand({
    name: 'find-new',
    description: 'Find and insert new script files on disk into the database',
    action: async () => {
      const result = await scriptPipelineService.findNewScripts();
      if (result === 0) {
        cliService.success('New script discovery completed successfully');
      } else {
        cliService.error('Failed to find new scripts');
      }
    }
  });
  
  // Show untyped command
  cliService.registerCommand({
    name: 'show-untyped',
    description: 'Show all script files without a script type',
    action: async () => {
      await scriptPipelineService.showUntypedScripts();
    }
  });
  
  // Show recent command
  cliService.registerCommand({
    name: 'show-recent',
    description: 'Show the 20 most recent script files based on update date',
    action: async () => {
      await scriptPipelineService.showRecentScripts();
    }
  });
  
  // Classify recent command
  cliService.registerCommand({
    name: 'classify-recent',
    description: 'Classify the 20 most recent script files',
    options: [
      {
        name: 'count',
        shortName: 'c',
        description: 'Number of scripts to process',
        type: 'number',
        default: 20
      }
    ],
    action: async (args) => {
      const count = args.count as number;
      
      cliService.info(`Classifying ${count} recent scripts...`);
      
      // Check for Claude API key
      if (!environmentService.get('claudeApiKey')) {
        cliService.error('No Claude API key found. Classification requires a valid Claude API key.');
        return;
      }
      
      const result = await scriptPipelineService.classifyRecentScripts(count);
      if (result === 0) {
        cliService.success('Script classification completed successfully');
      } else {
        cliService.error('Script classification failed');
      }
    }
  });
  
  // Classify untyped command
  cliService.registerCommand({
    name: 'classify-untyped',
    description: 'Classify untyped script files, optionally specify number to process',
    options: [
      {
        name: 'count',
        shortName: 'c',
        description: 'Number of scripts to process',
        type: 'number',
        default: 10
      }
    ],
    action: async (args) => {
      const count = args.count as number;
      
      cliService.info(`Classifying ${count} untyped scripts...`);
      
      // Check for Claude API key
      if (!environmentService.get('claudeApiKey')) {
        cliService.error('No Claude API key found. Classification requires a valid Claude API key.');
        return;
      }
      
      const result = await scriptPipelineService.classifyUntypedScripts(count);
      if (result === 0) {
        cliService.success('Script classification completed successfully');
      } else {
        cliService.error('Script classification failed');
      }
    }
  });
  
  // Generate summary command
  cliService.registerCommand({
    name: 'generate-summary',
    description: 'Generate a summary report of scripts',
    options: [
      {
        name: 'count',
        shortName: 'c',
        description: 'Number of scripts to include',
        type: 'number',
        default: 50
      },
      {
        name: 'all',
        shortName: 'a',
        description: 'Include all scripts',
        type: 'boolean',
        default: false
      },
      {
        name: 'include-deleted',
        shortName: 'd',
        description: 'Include deleted files',
        type: 'boolean',
        default: false
      },
      {
        name: 'file',
        shortName: 'f',
        description: 'Write to file instead of console output',
        type: 'boolean',
        default: false
      }
    ],
    action: async (args) => {
      // If "all" flag is set, use -1 for count
      const count = args.all ? -1 : (args.count as number);
      const includeDeleted = args['include-deleted'] as boolean;
      const writeToFile = args.file as boolean;
      
      cliService.info(`Generating summary for ${count === -1 ? 'all' : count} scripts (include deleted: ${includeDeleted}, write to file: ${writeToFile})...`);
      
      const result = await scriptPipelineService.generateSummary(count, includeDeleted, writeToFile);
      if (result === 0) {
        if (writeToFile) {
          cliService.success('Summary report file generated successfully');
        } else {
          cliService.success('Summary report displayed successfully');
        }
      } else {
        cliService.error('Failed to generate summary report');
      }
    }
  });
  
  // All command
  cliService.registerCommand({
    name: 'all',
    description: 'Run the complete pipeline (sync, find-new, classify-recent)',
    action: async () => {
      cliService.info('Running complete script pipeline...');
      
      const result = await scriptPipelineService.runCompletePipeline();
      if (result === 0) {
        cliService.success('Complete pipeline executed successfully');
      } else {
        cliService.warn('Pipeline completed with some errors');
      }
    }
  });
}

// Main function
async function main(): Promise<void> {
  try {
    // Register commands
    registerCommands();
    
    // Parse command-line arguments and execute command
    await cliService.parseAndExecute();
  } catch (error) {
    logger.error('Error running script pipeline', error);
    process.exit(1);
  } finally {
    // Clean up
    cliService.closePrompt();
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});