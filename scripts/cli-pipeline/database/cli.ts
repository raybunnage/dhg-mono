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
  .name('database')
  .description('CLI tool for monitoring and managing Supabase database')
  .version('1.0.0');

// Import all command modules
import './commands/table-records';
import './commands/empty-tables';
import './commands/database-functions';
import './commands/table-structure';
import './commands/schema-health';

// Process command line arguments
program.parse(process.argv);

// If no command was specified, show help
if (!process.argv.slice(2).length) {
  program.help();
}