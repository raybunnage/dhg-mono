/**
 * Master Health Check Implementation
 * 
 * This module handles the consolidated health checks across all pipelines
 * and reports results in a tabular format.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

// Convert exec to promise-based
const execPromise = promisify(exec);

// Interface for health check options
interface HealthCheckOptions {
  verbose?: boolean;
  timeout?: string;
  include?: string;
  exclude?: string;
}

// Pipeline health check result
interface PipelineHealthResult {
  pipeline: string;
  category: string;
  status: 'success' | 'failure' | 'warning' | 'not_implemented';
  statusText: string;
  details?: string;
  responseTime?: number;
}

/**
 * Available CLI pipelines with their health check commands
 */
const CLI_PIPELINES = [
  {
    name: 'google_sync',
    displayName: 'Google Sync',
    category: 'Data Integration',
    healthCommand: './scripts/cli-pipeline/google_sync/google-sync-cli.sh health-check'
  },
  {
    name: 'document',
    displayName: 'Document Processing',
    category: 'Content',
    healthCommand: './scripts/cli-pipeline/document/document-cli.sh health-check'
  },
  {
    name: 'experts',
    displayName: 'Experts Management',
    category: 'Content',
    healthCommand: './scripts/cli-pipeline/experts/experts-cli.sh health-check'
  },
  {
    name: 'document_types',
    displayName: 'Document Types',
    category: 'Content',
    healthCommand: './scripts/cli-pipeline/document_types/document-types-cli.sh health-check'
  },
  {
    name: 'media_processing',
    displayName: 'Media Processing',
    category: 'Content',
    healthCommand: './scripts/cli-pipeline/media-processing/media-processing-cli.sh health-check'
  },
  {
    name: 'prompt_service',
    displayName: 'Prompt Service',
    category: 'AI Services',
    healthCommand: './scripts/cli-pipeline/prompt_service/prompt-service-cli.sh health-check'
  },
  {
    name: 'scripts',
    displayName: 'Scripts Management',
    category: 'System',
    healthCommand: './scripts/cli-pipeline/scripts/scripts-cli.sh health-check'
  },
  {
    name: 'presentations',
    displayName: 'Presentations',
    category: 'Content',
    healthCommand: './scripts/cli-pipeline/presentations/presentations-cli.sh health-check'
  },
  {
    name: 'supabase',
    displayName: 'Supabase',
    category: 'Infrastructure',
    healthCommand: './packages/shared/services/supabase-client/health-check.sh'
  }
];

/**
 * Check if a command exists on the filesystem
 */
function commandExists(command: string): boolean {
  const commandPath = command.split(' ')[0];
  if (commandPath.endsWith('.sh')) {
    return fs.existsSync(commandPath);
  }
  return true; // For non-path commands, assume they exist
}

/**
 * Run a health check for a specific pipeline
 */
async function runPipelineHealthCheck(
  pipeline: typeof CLI_PIPELINES[0], 
  options: HealthCheckOptions
): Promise<PipelineHealthResult> {
  const startTime = Date.now();
  const timeout = parseInt(options.timeout || '30000', 10);
  
  console.log(`Running health check for ${pipeline.displayName}...`);
  
  // Check if health command file exists
  const commandExists = fs.existsSync(pipeline.healthCommand.split(' ')[0]);
  if (!commandExists) {
    return {
      pipeline: pipeline.name,
      category: pipeline.category,
      status: 'not_implemented',
      statusText: 'Not Implemented',
      details: `Health check command not found: ${pipeline.healthCommand}`,
      responseTime: Date.now() - startTime
    };
  }
  
  try {
    // Execute the health check command with timeout
    const { stdout, stderr } = await execPromise(pipeline.healthCommand, {
      timeout,
      cwd: process.cwd()
    });

    const responseTime = Date.now() - startTime;
    
    if (stderr && stderr.toLowerCase().includes('error')) {
      return {
        pipeline: pipeline.name,
        category: pipeline.category,
        status: 'warning',
        statusText: 'Warning',
        details: stderr,
        responseTime
      };
    }
    
    return {
      pipeline: pipeline.name,
      category: pipeline.category,
      status: 'success',
      statusText: 'Healthy',
      details: options.verbose ? stdout : undefined,
      responseTime
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      pipeline: pipeline.name,
      category: pipeline.category,
      status: 'failure',
      statusText: 'Failure',
      details: error.message || 'Unknown error',
      responseTime
    };
  }
}

/**
 * Get a color function for a status
 */
function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'success':
      return chalk.green;
    case 'failure':
      return chalk.red;
    case 'warning':
      return chalk.yellow;
    case 'not_implemented':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

/**
 * Display results in a table format
 */
function displayResults(results: PipelineHealthResult[], options: HealthCheckOptions): void {
  console.log('\n');
  console.log(chalk.bold('===== DHG MASTER HEALTH CHECK RESULTS ====='));
  console.log('');
  
  // Get the display name for each pipeline
  const pipelineMap = new Map(CLI_PIPELINES.map(p => [p.name, p.displayName]));
  
  // Calculate success rate
  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;
  const successRate = (successCount / totalCount) * 100;
  
  // Print the summary header
  console.log(`${chalk.bold('Overall Health:')} ${successRate.toFixed(1)}% (${successCount}/${totalCount} healthy)`);
  console.log('');
  
  // Group results by category
  const categories = new Set(results.map(r => r.category));
  const resultsByCategory: Record<string, PipelineHealthResult[]> = {};
  
  categories.forEach(category => {
    resultsByCategory[category] = results.filter(r => r.category === category);
  });
  
  // Column widths for pretty printing
  const nameWidth = Math.max(...results.map(r => pipelineMap.get(r.pipeline)?.length || 0), 15);
  const statusWidth = 10;
  const timeWidth = 12;
  const categoryWidth = 15;
  
  // Print each category
  for (const category of Array.from(categories).sort()) {
    console.log(chalk.bold(`\n${category.toUpperCase()} SERVICES:`));
    console.log('-'.repeat(nameWidth + statusWidth + timeWidth + 6));
    
    // Print header
    console.log(
      chalk.bold(`${'Pipeline'.padEnd(nameWidth)} | ${'Status'.padEnd(statusWidth)} | ${'Response Time'.padEnd(timeWidth)}`)
    );
    console.log('-'.repeat(nameWidth + statusWidth + timeWidth + 6));
    
    // Print each result row in this category
    for (const result of resultsByCategory[category]) {
      const displayName = pipelineMap.get(result.pipeline) || result.pipeline;
      const statusColor = getStatusColor(result.status);
      const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
      
      console.log(
        `${displayName.padEnd(nameWidth)} | ${statusColor(result.statusText.padEnd(statusWidth))} | ${responseTime.padEnd(timeWidth)}`
      );
      
      if (options.verbose && result.details) {
        console.log('-'.repeat(nameWidth + statusWidth + timeWidth + 6));
        console.log(result.details);
        console.log('-'.repeat(nameWidth + statusWidth + timeWidth + 6));
      }
    }
    
    // Print category summary
    const categorySuccessCount = resultsByCategory[category].filter(r => r.status === 'success').length;
    const categoryTotalCount = resultsByCategory[category].length;
    const categorySuccessRate = (categorySuccessCount / categoryTotalCount) * 100;
    console.log(`${chalk.bold('Category Health:')} ${categorySuccessRate.toFixed(1)}% (${categorySuccessCount}/${categoryTotalCount} healthy)`);
  }

  console.log('');
  const overallStatus = successRate >= 80 ? 'HEALTHY' : successRate >= 60 ? 'DEGRADED' : 'CRITICAL';
  const overallColor = 
    overallStatus === 'HEALTHY' ? chalk.green :
    overallStatus === 'DEGRADED' ? chalk.yellow : chalk.red;
  
  console.log(`${chalk.bold('System Status:')} ${overallColor(overallStatus)}`);
  console.log('');
  console.log(chalk.bold('========================================='));
}

/**
 * Run health checks for all applicable pipelines
 */
export async function runMasterHealthCheck(options: HealthCheckOptions): Promise<void> {
  console.log(chalk.bold('Starting Master Health Check...'));
  
  // Filter pipelines if include/exclude options are provided
  let pipelines = [...CLI_PIPELINES];
  
  if (options.include) {
    const includedPipelines = options.include.split(',').map(p => p.trim());
    pipelines = pipelines.filter(p => includedPipelines.includes(p.name));
  }
  
  if (options.exclude) {
    const excludedPipelines = options.exclude.split(',').map(p => p.trim());
    pipelines = pipelines.filter(p => !excludedPipelines.includes(p.name));
  }
  
  // Run all health checks in parallel
  const healthCheckPromises = pipelines.map(pipeline => 
    runPipelineHealthCheck(pipeline, options)
  );
  
  // Wait for all health checks to complete
  const results = await Promise.all(healthCheckPromises);
  
  // Display results
  displayResults(results, options);
}