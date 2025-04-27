#!/usr/bin/env ts-node
/**
 * Master Health Check CLI
 * 
 * This CLI runs health checks for all pipelines and reports the status of each
 * in a consolidated view. It helps monitor the overall health of the system.
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { runMasterHealthCheck } from './master-health-check';

// Create a new command instance
const program = new Command();

// Setup the program info
program
  .name('all-pipelines-cli')
  .description('Master CLI for running health checks across all pipelines')
  .version('1.0.0');

// Add the master-health-check command
program
  .command('master-health-check')
  .description('Run health checks for all pipelines and report consolidated status')
  .option('-v, --verbose', 'Display detailed output from each health check')
  .option('-t, --timeout <ms>', 'Timeout for individual health check operations in milliseconds', '30000')
  .option('--include <pipelines>', 'Comma-separated list of pipelines to include (default: all)')
  .option('--exclude <pipelines>', 'Comma-separated list of pipelines to exclude')
  .action(async (options) => {
    await runMasterHealthCheck(options);
  });

// Add help command
program
  .command('help')
  .description('Display help information about the All Pipelines CLI')
  .action(() => {
    program.help();
  });

// Parse arguments and run
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}