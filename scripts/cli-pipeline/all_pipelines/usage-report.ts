#!/usr/bin/env ts-node
/**
 * CLI Usage Report Generator
 * 
 * Generates a markdown report of CLI command usage across all pipelines.
 * This helps track which commands are used most frequently and when they were last used.
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

// Report generation options
interface ReportOptions {
  // Max number of commands to show per pipeline
  topCommands: number;
  // Number of days to look back for "recent" commands
  recentDays: number;
  // Output file path
  outputPath: string;
  // Whether to include all pipelines or just active ones
  onlyActive: boolean;
  // Whether to include detailed stats about command duration
  includeDetailedStats: boolean;
}

/**
 * Generate CLI usage report
 */
export async function generateUsageReport(options: ReportOptions): Promise<void> {
  console.log('Generating CLI usage report...');
  
  try {
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get pipeline stats
    const { data: pipelineStats, error: pipelineError } = await supabase.rpc(
      'get_cli_command_stats'
    );
    
    if (pipelineError) {
      throw new Error(`Failed to fetch command stats: ${pipelineError.message}`);
    }
    
    if (!pipelineStats || pipelineStats.length === 0) {
      throw new Error('No command tracking data found. Please run some commands first.');
    }
    
    // Calculate the date for "recent" commands
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - options.recentDays);
    
    // Get recent command executions for last used info
    const { data: recentCommands, error: recentError } = await supabase
      .from('cli_command_tracking')
      .select('*')
      .gte('execution_time', recentDate.toISOString())
      .order('execution_time', { ascending: false });
    
    if (recentError) {
      throw new Error(`Failed to fetch recent commands: ${recentError.message}`);
    }
    
    // Group commands by pipeline
    const pipelines: Record<string, any[]> = {};
    
    pipelineStats.forEach((stat: any) => {
      if (!pipelines[stat.pipeline_name]) {
        pipelines[stat.pipeline_name] = [];
      }
      pipelines[stat.pipeline_name].push(stat);
    });
    
    // Filter inactive pipelines if requested
    const activePipelines = Object.keys(pipelines).filter(pipeline => {
      if (!options.onlyActive) return true;
      
      // Check if any commands in this pipeline were used in the recent period
      const hasRecentActivity = pipelineStats.some((stat: any) => 
        stat.pipeline_name === pipeline && 
        new Date(stat.last_execution) >= recentDate
      );
      
      return hasRecentActivity;
    });
    
    // Build the markdown report
    let markdown = `# CLI Command Usage Report\n\n`;
    markdown += `*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n\n`;
    
    // Summary section
    markdown += `## Summary\n\n`;
    
    const totalCommands = pipelineStats.length;
    const totalExecutions = pipelineStats.reduce((sum: number, stat: any) => sum + stat.total_executions, 0);
    const totalSuccessful = pipelineStats.reduce((sum: number, stat: any) => sum + stat.successful_executions, 0);
    const totalFailed = pipelineStats.reduce((sum: number, stat: any) => sum + stat.failed_executions, 0);
    const totalRunning = pipelineStats.reduce((sum: number, stat: any) => sum + stat.running_executions, 0);
    
    markdown += `- Total Pipelines: ${activePipelines.length}${options.onlyActive ? ' (active in last ' + options.recentDays + ' days)' : ''}\n`;
    markdown += `- Total Commands: ${totalCommands}\n`;
    markdown += `- Total Executions: ${totalExecutions}\n`;
    markdown += `- Success Rate: ${(totalSuccessful / (totalExecutions || 1) * 100).toFixed(1)}%\n\n`;
    
    // Most Used Commands section
    markdown += `## Most Used Commands\n\n`;
    
    // Sort all commands by usage count
    const allCommands = pipelineStats.slice();
    allCommands.sort((a: any, b: any) => b.total_executions - a.total_executions);
    
    // Take top N commands
    const topCommandsOverall = allCommands.slice(0, options.topCommands);
    
    markdown += `| Command | Pipeline | Total Uses | Success Rate | Last Used |\n`;
    markdown += `| ------- | -------- | ---------- | ------------ | --------- |\n`;
    
    topCommandsOverall.forEach((stat: any) => {
      const successRate = (stat.successful_executions / (stat.total_executions || 1) * 100).toFixed(1);
      const lastUsed = new Date(stat.last_execution).toLocaleString();
      
      markdown += `| ${stat.command_name} | ${stat.pipeline_name} | ${stat.total_executions} | ${successRate}% | ${lastUsed} |\n`;
    });
    
    markdown += '\n';
    
    // Recently Used Commands section
    markdown += `## Recently Used Commands (Last ${options.recentDays} days)\n\n`;
    
    // Build a map of recent command executions
    const recentExecutionsByCommand: Record<string, any[]> = {};
    
    (recentCommands || []).forEach((cmd: any) => {
      const key = `${cmd.pipeline_name}/${cmd.command_name}`;
      if (!recentExecutionsByCommand[key]) {
        recentExecutionsByCommand[key] = [];
      }
      recentExecutionsByCommand[key].push(cmd);
    });
    
    // Get unique recent commands
    const uniqueRecentCommands = Object.keys(recentExecutionsByCommand).map(key => {
      const [pipeline, command] = key.split('/');
      const executions = recentExecutionsByCommand[key];
      
      return {
        pipeline_name: pipeline,
        command_name: command,
        executions_count: executions.length,
        last_execution: executions[0].execution_time, // First one is most recent due to ordering
      };
    });
    
    uniqueRecentCommands.sort((a, b) => new Date(b.last_execution).getTime() - new Date(a.last_execution).getTime());
    
    // Take top N recent commands
    const topRecentCommands = uniqueRecentCommands.slice(0, options.topCommands);
    
    markdown += `| Command | Pipeline | Times Used | Last Used |\n`;
    markdown += `| ------- | -------- | ---------- | --------- |\n`;
    
    topRecentCommands.forEach((cmd) => {
      const lastUsed = new Date(cmd.last_execution).toLocaleString();
      
      markdown += `| ${cmd.command_name} | ${cmd.pipeline_name} | ${cmd.executions_count} | ${lastUsed} |\n`;
    });
    
    markdown += '\n';
    
    // Usage by Pipeline section
    markdown += `## Usage by Pipeline\n\n`;
    
    // Sort pipelines by total executions
    activePipelines.sort((a, b) => {
      const aExecs = pipelines[a].reduce((sum: number, stat: any) => sum + stat.total_executions, 0);
      const bExecs = pipelines[b].reduce((sum: number, stat: any) => sum + stat.total_executions, 0);
      return bExecs - aExecs; // Sort by most executed first
    });
    
    // For each pipeline, show details
    for (const pipeline of activePipelines) {
      const pipelineCommands = pipelines[pipeline];
      
      // Calculate pipeline stats
      const totalPipelineExecutions = pipelineCommands.reduce((sum: number, stat: any) => sum + stat.total_executions, 0);
      const successfulPipelineExecutions = pipelineCommands.reduce((sum: number, stat: any) => sum + stat.successful_executions, 0);
      const failedPipelineExecutions = pipelineCommands.reduce((sum: number, stat: any) => sum + stat.failed_executions, 0);
      
      markdown += `### ${pipeline}\n\n`;
      markdown += `- Commands: ${pipelineCommands.length}\n`;
      markdown += `- Total Executions: ${totalPipelineExecutions}\n`;
      markdown += `- Success Rate: ${(successfulPipelineExecutions / (totalPipelineExecutions || 1) * 100).toFixed(1)}%\n\n`;
      
      // Sort commands within this pipeline by usage
      pipelineCommands.sort((a: any, b: any) => b.total_executions - a.total_executions);
      
      // Take top N commands for this pipeline
      const topPipelineCommands = pipelineCommands.slice(0, options.topCommands);
      
      markdown += `#### Most Used Commands\n\n`;
      
      markdown += `| Command | Total Uses | Success Rate | Avg Duration | Last Used |\n`;
      markdown += `| ------- | ---------- | ------------ | ------------ | --------- |\n`;
      
      topPipelineCommands.forEach((stat: any) => {
        const successRate = (stat.successful_executions / (stat.total_executions || 1) * 100).toFixed(1);
        const lastUsed = new Date(stat.last_execution).toLocaleString();
        
        let avgDuration = 'N/A';
        if (stat.avg_duration_ms) {
          avgDuration = stat.avg_duration_ms >= 1000
            ? `${(stat.avg_duration_ms / 1000).toFixed(2)}s`
            : `${Math.round(stat.avg_duration_ms)}ms`;
        }
        
        markdown += `| ${stat.command_name} | ${stat.total_executions} | ${successRate}% | ${avgDuration} | ${lastUsed} |\n`;
      });
      
      markdown += '\n';
      
      // If detailed stats are requested, add command execution history for top commands
      if (options.includeDetailedStats) {
        markdown += `#### Command Execution History\n\n`;
        
        for (const stat of topPipelineCommands.slice(0, 3)) { // Only show top 3 to avoid report getting too large
          const cmdKey = `${pipeline}/${stat.command_name}`;
          const executions = recentExecutionsByCommand[cmdKey] || [];
          
          if (executions.length === 0) continue;
          
          markdown += `##### ${stat.command_name}\n\n`;
          
          markdown += `| Date | Status | Duration | Records Affected | Summary |\n`;
          markdown += `| ---- | ------ | -------- | ---------------- | ------- |\n`;
          
          // Only show latest 5 executions
          executions.slice(0, 5).forEach((exec: any) => {
            const execDate = new Date(exec.execution_time).toLocaleString();
            const duration = exec.duration_ms
              ? (exec.duration_ms >= 1000 ? `${(exec.duration_ms / 1000).toFixed(2)}s` : `${exec.duration_ms}ms`)
              : 'N/A';
            const status = exec.status === 'success' ? '✅' : exec.status === 'error' ? '❌' : '⏳';
            const records = exec.records_affected || 'N/A';
            const summary = exec.summary || 'N/A';
            
            markdown += `| ${execDate} | ${status} | ${duration} | ${records} | ${summary.substring(0, 50)}${summary.length > 50 ? '...' : ''} |\n`;
          });
          
          markdown += '\n';
        }
      }
    }
    
    // Write markdown to file
    fs.writeFileSync(options.outputPath, markdown);
    
    console.log(`✅ CLI usage report has been generated at ${options.outputPath}`);
    
  } catch (error) {
    console.error('Error generating CLI usage report:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}