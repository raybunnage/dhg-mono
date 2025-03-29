import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { scriptPipelineService } from '../services/script-pipeline-service';

/**
 * Command to synchronize database with script files on disk
 */
const syncScriptsCommand = new Command('sync')
  .description('Synchronize database with script files on disk')
  .action(async () => {
    Logger.info('Syncing script files with database...');
    
    try {
      await scriptPipelineService.syncScripts();
    } catch (error) {
      Logger.error('Failed to run sync command', error);
    }
  });

/**
 * Command to find and insert new script files
 */
const findNewScriptsCommand = new Command('find-new')
  .description('Find and insert new script files')
  .action(async () => {
    Logger.info('Finding and inserting new script files...');
    
    try {
      await scriptPipelineService.findNewScripts();
    } catch (error) {
      Logger.error('Failed to run find-new command', error);
    }
  });

/**
 * Command to show untyped script files
 */
const showUntypedScriptsCommand = new Command('show-untyped')
  .description('Show all script files without a script type')
  .action(async () => {
    Logger.info('Showing untyped script files...');
    
    try {
      await scriptPipelineService.showUntypedScripts();
    } catch (error) {
      Logger.error('Failed to run show-untyped command', error);
    }
  });

/**
 * Command to show recent script files
 */
const showRecentScriptsCommand = new Command('show-recent')
  .description('Show recent script files')
  .action(async () => {
    Logger.info('Showing recent script files...');
    
    try {
      await scriptPipelineService.showRecentScripts();
    } catch (error) {
      Logger.error('Failed to run show-recent command', error);
    }
  });

/**
 * Command to classify recent script files
 */
const classifyRecentScriptsCommand = new Command('classify-recent')
  .description('Classify the most recent script files')
  .action(async () => {
    Logger.info('Classifying recent script files...');
    
    try {
      await scriptPipelineService.classifyRecentScripts();
    } catch (error) {
      Logger.error('Failed to run classify-recent command', error);
    }
  });

/**
 * Command to classify untyped script files
 */
const classifyUntypedScriptsCommand = new Command('classify-untyped')
  .description('Classify untyped script files')
  .option('-c, --count <number>', 'Number of files to process', '10')
  .action(async (options) => {
    const count = parseInt(options.count, 10);
    Logger.info(`Classifying ${count} untyped script files...`);
    
    try {
      await scriptPipelineService.classifyUntypedScripts(count);
    } catch (error) {
      Logger.error('Failed to run classify-untyped command', error);
    }
  });

/**
 * Command to clean script analysis results
 */
const cleanScriptResultsCommand = new Command('clean-results')
  .description('Clean script analysis results')
  .action(async () => {
    Logger.info('Cleaning script analysis results...');
    
    try {
      await scriptPipelineService.cleanScriptResults();
    } catch (error) {
      Logger.error('Failed to run clean-results command', error);
    }
  });

/**
 * Command to generate a summary report of scripts
 */
const generateSummaryCommand = new Command('generate-summary')
  .description('Generate a summary report of scripts')
  .option('-c, --count <number>', 'Number of scripts to include', '50')
  .option('-i, --include-deleted', 'Include deleted scripts', false)
  .action(async (options) => {
    let count: number;
    if (options.count === 'all') {
      count = -1;
    } else {
      count = parseInt(options.count, 10);
    }
    
    const includeDeleted = options.includeDeleted || false;
    
    Logger.info(`Generating summary for ${count === -1 ? 'all' : count} scripts (include deleted: ${includeDeleted})...`);
    
    try {
      await scriptPipelineService.generateSummary(count, includeDeleted);
    } catch (error) {
      Logger.error('Failed to run generate-summary command', error);
    }
  });

/**
 * Command to run the complete script pipeline
 */
const runCompleteCommand = new Command('all')
  .description('Run the complete script pipeline')
  .action(async () => {
    Logger.info('Running complete script pipeline...');
    
    try {
      await scriptPipelineService.runCompletePipeline();
    } catch (error) {
      Logger.error('Failed to run complete pipeline', error);
    }
  });

/**
 * Register script commands with the main program
 */
export const registerScriptCommands = (program: Command): void => {
  // Create a script command group
  const scriptCommand = new Command('script')
    .description('Script management commands');
  
  // Add subcommands
  scriptCommand.addCommand(syncScriptsCommand);
  scriptCommand.addCommand(findNewScriptsCommand);
  scriptCommand.addCommand(showUntypedScriptsCommand);
  scriptCommand.addCommand(showRecentScriptsCommand);
  scriptCommand.addCommand(classifyRecentScriptsCommand);
  scriptCommand.addCommand(classifyUntypedScriptsCommand);
  scriptCommand.addCommand(cleanScriptResultsCommand);
  scriptCommand.addCommand(generateSummaryCommand);
  scriptCommand.addCommand(runCompleteCommand);
  
  // Add the script command group to the main program
  program.addCommand(scriptCommand);
};