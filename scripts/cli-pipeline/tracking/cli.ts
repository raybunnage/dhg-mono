#!/usr/bin/env node

/**
 * Command Tracking CLI
 * 
 * CLI tool for managing and viewing command execution history
 */
import { Command } from 'commander';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { Logger } from '../../../packages/shared/utils/logger';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();

program
  .name('command-tracking')
  .description('CLI for managing and viewing command execution history')
  .version('1.0.0');

// List recent commands
program
  .command('list')
  .description('List recent command executions')
  .option('-l, --limit <number>', 'Maximum number of records to return', '50')
  .option('-p, --pipeline <name>', 'Filter by pipeline name')
  .option('-s, --status <status>', 'Filter by status (success, error, running)')
  .action(async (options) => {
    try {
      const limit = parseInt(options.limit, 10);
      
      Logger.info(`Fetching recent command executions (limit: ${limit})`);
      
      const commands = await commandTrackingService.getRecentCommands(
        limit,
        options.pipeline,
        options.status as 'success' | 'error' | 'running'
      );
      
      if (commands.length === 0) {
        Logger.info('No command executions found');
        return;
      }
      
      Logger.info(`Found ${commands.length} command executions:`);
      console.log(''); // Empty line for readability
      
      commands.forEach((command, index) => {
        const executionTime = new Date(command.execution_time).toLocaleString();
        const status = command.status === 'success' 
          ? `✅ ${command.status}`
          : command.status === 'error'
            ? `❌ ${command.status}`
            : `⏳ ${command.status}`;
        
        console.log(`[${index + 1}] ${command.pipeline_name}/${command.command_name}`);
        console.log(`    Time: ${executionTime}`);
        console.log(`    Status: ${status}`);
        
        if (command.duration_ms != null) {
          const duration = command.duration_ms >= 1000
            ? `${(command.duration_ms / 1000).toFixed(2)}s`
            : `${command.duration_ms}ms`;
          console.log(`    Duration: ${duration}`);
        }
        
        if (command.records_affected) {
          console.log(`    Records affected: ${command.records_affected}`);
        }
        
        if (command.affected_entity) {
          console.log(`    Entity: ${command.affected_entity}`);
        }
        
        if (command.summary) {
          console.log(`    Summary: ${command.summary}`);
        }
        
        if (command.error_message) {
          console.log(`    Error: ${command.error_message}`);
        }
        
        console.log(''); // Empty line between commands
      });
    } catch (error) {
      Logger.error(`Error listing command executions: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Show command stats
program
  .command('stats')
  .description('Show command execution statistics')
  .action(async () => {
    try {
      Logger.info('Fetching command execution statistics');
      
      const supabase = SupabaseClientService.getInstance().getClient();
      const { data: stats } = await supabase.rpc('get_cli_command_stats');
      
      if (stats.length === 0) {
        Logger.info('No command statistics found');
        return;
      }
      
      Logger.info(`Command execution statistics for ${stats.length} commands:`);
      console.log(''); // Empty line for readability
      
      // Group by pipeline
      const pipelineGroups: Record<string, any[]> = {};
      stats.forEach((stat: any) => {
        if (!pipelineGroups[stat.pipeline_name]) {
          pipelineGroups[stat.pipeline_name] = [];
        }
        pipelineGroups[stat.pipeline_name].push(stat);
      });
      
      // Display stats by pipeline
      Object.entries(pipelineGroups).forEach(([pipeline, pipelineStats]) => {
        console.log(`🔷 Pipeline: ${pipeline} (${pipelineStats.length} commands)`);
        
        pipelineStats.forEach(stat => {
          const lastExecution = new Date(stat.last_execution).toLocaleString();
          const avgDuration = stat.avg_duration_ms >= 1000
            ? `${(stat.avg_duration_ms / 1000).toFixed(2)}s`
            : `${Math.round(stat.avg_duration_ms)}ms`;
          
          console.log(`  • ${stat.command_name}`);
          console.log(`    Total: ${stat.total_executions} | Success: ${stat.successful_executions} | Failed: ${stat.failed_executions} | Running: ${stat.running_executions}`);
          console.log(`    Avg Duration: ${avgDuration} | Last Run: ${lastExecution}`);
        });
        
        console.log(''); // Empty line between pipelines
      });
    } catch (error) {
      Logger.error(`Error fetching command stats: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Init database table
program
  .command('init')
  .description('Initialize the command_history table in the database')
  .action(async () => {
    try {
      const fs = require('fs');
      const path = require('path');
      const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
      
      Logger.info('Initializing command_history table');
      
      // Read the SQL file
      const sqlPath = path.join(__dirname, '../../../packages/shared/services/tracking-service/create-command-history-table.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      // Execute the SQL
      const supabase = SupabaseClientService.getInstance().getClient();
      // Execute the SQL statements one by one
      const statements = sql.split(';').filter((stmt: string) => stmt.trim());
      let hasError = false;
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' });
          
          if (error) {
            Logger.error(`Error executing SQL: ${error.message}`);
            Logger.error(`Statement: ${statement}`);
            hasError = true;
          }
        }
      }
      
      if (hasError) {
        throw new Error(`Failed to execute one or more SQL statements`);
      }
      
      Logger.info('✅ Command history table initialized successfully');
    } catch (error) {
      Logger.error(`Error initializing command history table: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Add test record
program
  .command('health-check')
  .description('Check the health of the command tracking service')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (options) => {
    try {
      Logger.info('Performing command tracking service health check...');
      
      // Check connection to database
      Logger.info('\nChecking Supabase connection...');
      const supabase = SupabaseClientService.getInstance().getClient();
      
      try {
        const { data, error } = await supabase
          .from('cli_command_tracking')
          .select('count', { count: 'exact', head: true });
        
        if (error) {
          throw new Error(`Database query error: ${error.message}`);
        }
        
        Logger.info('✅ Database connection successful');
        Logger.info(`✅ CLI command tracking table accessible (contains entries)`);
        
        // Check RPC function
        try {
          const { data: stats, error: rpcError } = await supabase.rpc('get_cli_command_stats');
          
          if (rpcError) {
            Logger.warn(`⚠️ RPC function check failed: ${rpcError.message}`);
          } else {
            Logger.info('✅ RPC functions working correctly');
          }
        } catch (rpcError) {
          Logger.warn(`⚠️ RPC function check failed: ${rpcError instanceof Error ? rpcError.message : String(rpcError)}`);
        }
        
        // Test tracking function
        Logger.info('\nTesting command tracking functionality...');
        const startTime = new Date();
        const trackingId = await commandTrackingService.startTracking('tracking', 'health-check');
        
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 0,
          affectedEntity: 'health-check',
          summary: 'Health check command executed successfully'
        });
        
        Logger.info('✅ Command tracking functionality working correctly');
        
        // Overall status
        Logger.info('\n📋 Overall Status:');
        Logger.info('✅ Command tracking service is healthy');
        
      } catch (error) {
        Logger.error('❌ Health check failed:', error instanceof Error ? error.message : String(error));
        
        if (options.verbose) {
          console.error('Error details:');
          console.error(error);
        }
        
        process.exit(1);
      }
    } catch (error) {
      Logger.error('Error performing health check:', error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Add a test record to the command_history table')
  .action(async () => {
    try {
      Logger.info('Adding test record to command_history table');
      
      const startTime = new Date();
      const trackingId = await commandTrackingService.startTracking('tracking', 'test');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 1,
        affectedEntity: 'command_history',
        summary: 'Test command executed successfully'
      });
      
      Logger.info('✅ Test record added successfully');
      Logger.info(`Tracking ID: ${trackingId}`);
    } catch (error) {
      Logger.error(`Error adding test record: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse(process.argv);