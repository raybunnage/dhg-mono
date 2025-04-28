#!/usr/bin/env ts-node
import { Command } from 'commander';
import path from 'path';

// Initialize dotenv
require('dotenv').config({
  path: path.resolve(process.cwd(), '.env.development'),
});

// Create the CLI program
const program = new Command();

program
  .name('database-cli')
  .description('CLI tool for monitoring and managing Supabase database')
  .version('1.0.0');

// Import command modules
import tableRecordsCommand from './commands/table-records';
import emptyTablesCommand from './commands/empty-tables';
import databaseFunctionsCommand from './commands/database-functions';
import tableStructureCommand from './commands/table-structure';
import schemaHealthCommand from './commands/schema-health';

// Add commands to program
program.addCommand(tableRecordsCommand);
program.addCommand(emptyTablesCommand);
program.addCommand(databaseFunctionsCommand);
program.addCommand(tableStructureCommand);
program.addCommand(schemaHealthCommand);

// Process command line arguments
program.parse(process.argv);

// If no command was specified, show help
if (!process.argv.slice(2).length) {
  program.help();
}