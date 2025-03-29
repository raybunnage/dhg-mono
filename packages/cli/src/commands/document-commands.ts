import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { documentPipelineService } from '@dhg/shared/services';

/**
 * Command to show recent document files in the database
 */
const showRecentCommand = new Command('show-recent')
  .description('Show recent document files')
  .option('-c, --count <number>', 'Number of files to show', '20')
  .action(async (options) => {
    const count = parseInt(options.count, 10);
    Logger.info(`Showing ${count} recent document files...`);
    
    try {
      await documentPipelineService.showRecentFiles(count);
    } catch (error) {
      Logger.error('Failed to run show-recent command', error);
    }
  });

/**
 * Command to find and insert new document files
 */
const findNewCommand = new Command('find-new')
  .description('Find and insert new document files')
  .action(async () => {
    Logger.info('Finding and inserting new document files...');
    
    try {
      await documentPipelineService.findNewFiles();
    } catch (error) {
      Logger.error('Failed to run find-new command', error);
    }
  });

/**
 * Command to show untyped document files
 */
const showUntypedCommand = new Command('show-untyped')
  .description('Show all documentation files without a document type')
  .action(async () => {
    Logger.info('Showing untyped document files...');
    
    try {
      await documentPipelineService.showUntypedFiles();
    } catch (error) {
      Logger.error('Failed to run show-untyped command', error);
    }
  });

/**
 * Command to classify recent document files
 */
const classifyRecentCommand = new Command('classify-recent')
  .description('Classify the most recent files')
  .option('-c, --count <number>', 'Number of files to process', '20')
  .action(async (options) => {
    const count = parseInt(options.count, 10);
    Logger.info(`Classifying ${count} recent document files...`);
    
    try {
      await documentPipelineService.classifyRecentFiles(count);
    } catch (error) {
      Logger.error('Failed to run classify-recent command', error);
    }
  });

/**
 * Register document commands with the main program
 */
export const registerDocumentCommands = (program: Command): void => {
  // Create a document command group
  const documentCommand = new Command('document')
    .description('Document management commands');
  
  // Add subcommands
  documentCommand.addCommand(showRecentCommand);
  documentCommand.addCommand(findNewCommand);
  documentCommand.addCommand(showUntypedCommand);
  documentCommand.addCommand(classifyRecentCommand);
  
  // Add the document command group to the main program
  program.addCommand(documentCommand);
};