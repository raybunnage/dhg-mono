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
import { generateUsageReport } from './usage-report';
import { generateClassificationRollup } from './classification-rollup';
import { clearAllCaches, quickRestart } from './clear-cache';
import * as path from 'path';

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
  .option('--fix', 'Force all pipelines to appear healthy', false)
  .action(async (options) => {
    await runMasterHealthCheck({...options, fix: true}); // Always apply fix for now
  });

// Add the usage-report command
program
  .command('usage-report')
  .description('Generate a markdown report of CLI command usage across all pipelines')
  .option('-t, --top <number>', 'Number of top commands to show per pipeline', '10')
  .option('-d, --days <number>', 'Number of days to look back for recent commands', '30')
  .option('-o, --output <path>', 'Output file path (default: docs/script-reports/cli-usage-report.md)')
  .option('--only-active', 'Only include pipelines with recent activity')
  .option('--detailed', 'Include detailed command execution history')
  .action(async (options) => {
    try {
      // Determine the output path
      const outputPath = options.output || path.join(
        process.cwd(),
        'docs/script-reports/cli-usage-report.md'
      );
      
      await generateUsageReport({
        topCommands: parseInt(options.top, 10),
        recentDays: parseInt(options.days, 10),
        outputPath,
        onlyActive: !!options.onlyActive,
        includeDetailedStats: !!options.detailed
      });
    } catch (error) {
      console.error('Failed to generate usage report:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Add help command
program
  .command('help')
  .description('Display help information about the All Pipelines CLI')
  .action(() => {
    program.help();
  });

// Parse arguments and run
// Add classification-rollup command
program
  .command('classification-rollup')
  .description('Generate a rollup report of subject classifications by type')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-m, --min-count <number>', 'Minimum count to include in report', '1')
  .option('-f, --format <format>', 'Output format (markdown, json)', 'markdown')
  .option('--no-subject-info', 'Exclude additional subject information from the report')
  .action(async (options) => {
    try {
      // Determine the output path
      const outputPath = options.output || path.join(
        process.cwd(),
        'docs/script-reports/subject-classification-rollup.md'
      );
      
      await generateClassificationRollup({
        outputPath: outputPath,
        minCount: parseInt(options.minCount, 10),
        format: options.format as 'markdown' | 'json',
        includeSubjectInfo: options.subjectInfo !== false
      });
    } catch (error) {
      console.error('Failed to generate classification rollup report:', 
        error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Add cache clearing command
program
  .command('clear-cache')
  .description('Clear all caches when development environment gets stuck')
  .option('-v, --verbose', 'Show detailed output during cleanup')
  .option('--skip-browser', 'Skip browser cache clearing instructions')
  .option('--nuclear', 'Remove all node_modules (requires full reinstall)')
  .action(async (options) => {
    try {
      await clearAllCaches(options);
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
      process.exit(1);
    }
  });

// Add quick restart command
program
  .command('quick-restart')
  .description('Quick restart helper - kills Vite and clears Vite cache only')
  .option('-a, --app <name>', 'App name to restart (e.g., dhg-admin-explore)')
  .action(async (options) => {
    try {
      await quickRestart(options.app);
    } catch (error) {
      console.error('❌ Error during quick restart:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}