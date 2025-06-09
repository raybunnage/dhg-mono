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

// Import backup commands
import createBackupCommand from './commands/backup/create-backup-cmd';
import addBackupTableCommand from './commands/backup/add-backup-table-cmd';
import listBackupConfigCommand from './commands/backup/list-backup-config-cmd';

// Import audit commands
import tableAuditCommand from './commands/table-audit-cmd';
import functionAuditCommand from './commands/function-audit-cmd';
import consistencyCheckCommand from './commands/consistency-check-cmd';

// Add commands to program
program.addCommand(tableRecordsCommand);
program.addCommand(emptyTablesCommand);
program.addCommand(databaseFunctionsCommand);
program.addCommand(tableStructureCommand);
program.addCommand(schemaHealthCommand);

// Add backup commands
program.addCommand(createBackupCommand);
program.addCommand(addBackupTableCommand);
program.addCommand(listBackupConfigCommand);

// Add audit commands
program.addCommand(tableAuditCommand);
program.addCommand(functionAuditCommand);
program.addCommand(consistencyCheckCommand);

// Process command line arguments
program.parse(process.argv);

// If no command was specified, show help
if (!process.argv.slice(2).length) {
  program.help();
}