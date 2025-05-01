#!/usr/bin/env ts-node
"use strict";
/**
 * Master Health Check CLI
 *
 * This CLI runs health checks for all pipelines and reports the status of each
 * in a consolidated view. It helps monitor the overall health of the system.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const master_health_check_1 = require("./master-health-check");
const usage_report_1 = require("./usage-report");
const classification_rollup_1 = require("./classification-rollup");
const path = __importStar(require("path"));
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
        const outputPath = options.output || path.join(process.cwd(), 'docs/script-reports/cli-usage-report.md');
        await (0, usage_report_1.generateUsageReport)({
            topCommands: parseInt(options.top, 10),
            recentDays: parseInt(options.days, 10),
            outputPath,
            onlyActive: !!options.onlyActive,
            includeDetailedStats: !!options.detailed
        });
    }
    catch (error) {
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
        const outputPath = options.output || path.join(process.cwd(), 'docs/script-reports/subject-classification-rollup.md');
        await (0, classification_rollup_1.generateClassificationRollup)({
            outputPath: outputPath,
            minCount: parseInt(options.minCount, 10),
            format: options.format,
            includeSubjectInfo: options.subjectInfo !== false
        });
    }
    catch (error) {
        console.error('Failed to generate classification rollup report:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program.parse(process.argv);
// If no arguments, show help
if (process.argv.length === 2) {
    program.help();
}
