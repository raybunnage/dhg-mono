#!/usr/bin/env ts-node
"use strict";
/**
 * Master Health Check CLI
 *
 * This CLI runs health checks for all pipelines and reports the status of each
 * in a consolidated view. It helps monitor the overall health of the system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const master_health_check_1 = require("./master-health-check");
// Create a new command instance
const program = new commander_1.Command();
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
    await (0, master_health_check_1.runMasterHealthCheck)(options);
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
