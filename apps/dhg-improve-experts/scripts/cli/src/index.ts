#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommands } from './commands';
import { Logger, LogLevel } from './utils/logger';
import config from './utils/config';

// Set up logger
Logger.setLevel(config.logLevel);

// Create commander program
const program = new Command();

// Configure program
program
  .name('ai-workflow')
  .description('AI workflow tools for document processing')
  .version('1.0.0');

// Register all commands
registerCommands(program);

// Add global options
program
  .option('-v, --verbose', 'Enable verbose logging')
  .hook('preAction', (thisCommand) => {
    // Set log level based on verbose flag
    if (thisCommand.opts().verbose) {
      Logger.setLevel(LogLevel.DEBUG);
      Logger.debug('Verbose logging enabled');
    }
  });

// Parse arguments and execute
program.parse();