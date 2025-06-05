import { Command } from 'commander';
import { databaseService } from '../../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service/command-tracking-service';
import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

interface BackupConfig {
  tables: string[];
  defaultOptions: {
    includeStructure: boolean;
    includeData: boolean;
    includeIndexes: boolean;
    includeConstraints: boolean;
  };
}

// Load backup configuration
function loadBackupConfig(): BackupConfig {
  const configPath = path.join(__dirname, '../../backup-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Backup configuration file not found. Please create backup-config.json');
  }
  
  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent) as BackupConfig;
}

program
  .name('list-backup-config')
  .description('Show the current backup configuration')
  .option('--validate', 'Validate that configured tables exist in database')
  .option('--show-backups', 'Show existing backups for each configured table')
  .action(async (options) => {
    const trackingId = await commandTrackingService.startTracking('database', 'list-backup-config');
    try {
      console.log(chalk.blue('📋 Backup Configuration\n'));
      
      // Load configuration
      const config = loadBackupConfig();
      
      // Show default options
      console.log(chalk.cyan('Default Options:'));
      console.log(chalk.gray(`  Include Structure: ${config.defaultOptions.includeStructure ? '✓' : '✗'}`));
      console.log(chalk.gray(`  Include Data: ${config.defaultOptions.includeData ? '✓' : '✗'}`));
      console.log(chalk.gray(`  Include Indexes: ${config.defaultOptions.includeIndexes ? '✓' : '✗'}`));
      console.log(chalk.gray(`  Include Constraints: ${config.defaultOptions.includeConstraints ? '✓' : '✗'}`));
      console.log();
      
      // Create table for configured tables
      const configTable = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('Table Name'),
          ...(options.validate ? [chalk.cyan('Status'), chalk.cyan('Records')] : []),
          ...(options.showBackups ? [chalk.cyan('Latest Backup'), chalk.cyan('Total Backups')] : [])
        ],
        colWidths: [5, 30, ...(options.validate ? [15, 15] : []), ...(options.showBackups ? [20, 15] : [])]
      });
      
      // Get database info if needed
      let existingTables: { tableName: string; count: number }[] = [];
      let backupTables: { tableName: string; count: number }[] = [];
      
      if (options.validate || options.showBackups) {
        existingTables = await databaseService.getTablesWithRecordCounts();
      }
      
      if (options.showBackups) {
        // Get all backup tables
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data: allTables } = await supabase.rpc('execute_sql', {
          sql_query: `
            SELECT 
              schemaname || '.' || tablename as full_table_name,
              tablename
            FROM pg_tables
            WHERE schemaname = 'backup'
            ORDER BY tablename;
          `
        });
        
        if (allTables && Array.isArray(allTables)) {
          for (const table of allTables) {
            const { data: countResult } = await supabase.rpc('execute_sql', {
              sql_query: `SELECT COUNT(*) as count FROM ${table.full_table_name}`
            });
            backupTables.push({
              tableName: table.tablename,
              count: countResult?.[0]?.count || 0
            });
          }
        }
      }
      
      // Process each configured table
      for (let i = 0; i < config.tables.length; i++) {
        const tableName = config.tables[i];
        const row: (string | number)[] = [(i + 1).toString(), tableName];
        
        // Validate if requested
        if (options.validate) {
          const tableInfo = existingTables.find(t => t.tableName === tableName);
          if (tableInfo) {
            row.push(chalk.green('✓ Exists'));
            row.push(tableInfo.count.toString());
          } else {
            row.push(chalk.red('✗ Not found'));
            row.push('-');
          }
        }
        
        // Show backups if requested
        if (options.showBackups) {
          // Find backups for this table
          const tableBackups = backupTables
            .filter(t => t.tableName.startsWith(`${tableName}_`))
            .sort((a, b) => b.tableName.localeCompare(a.tableName)); // Sort by date descending
          
          if (tableBackups.length > 0) {
            const latestBackup = tableBackups[0];
            const dateMatch = latestBackup.tableName.match(/_(\d{8})$/);
            const dateStr = dateMatch ? dateMatch[1] : 'Unknown';
            row.push(dateStr);
            row.push(tableBackups.length.toString());
          } else {
            row.push(chalk.gray('None'));
            row.push('0');
          }
        }
        
        configTable.push(row);
      }
      
      // Display table
      console.log(chalk.cyan('Configured Tables for Backup:'));
      console.log(configTable.toString());
      
      // Summary
      console.log(chalk.gray(`\nTotal tables configured: ${config.tables.length}`));
      
      if (options.validate) {
        const validTables = config.tables.filter(t => 
          existingTables.some(et => et.tableName === t)
        ).length;
        const invalidTables = config.tables.length - validTables;
        
        if (invalidTables > 0) {
          console.log(chalk.yellow(`⚠️  ${invalidTables} table(s) not found in database`));
        } else {
          console.log(chalk.green('✅ All configured tables exist in database'));
        }
      }
      
      if (options.showBackups) {
        const totalBackups = backupTables.length;
        console.log(chalk.gray(`Total backup tables in backup schema: ${totalBackups}`));
      }
      
      // Show config file location
      console.log(chalk.gray(`\nConfiguration file: ${path.join(__dirname, '../../backup-config.json')}`));
      
      await commandTrackingService.completeTracking(trackingId, {
        summary: 'Listed backup configuration'
      });
    } catch (error) {
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to list backup configuration: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error(chalk.red('Error listing backup configuration:'), error);
      process.exit(1);
    }
  });

// Export for use in CLI
export default program;

// Run if called directly
if (require.main === module) {
  program.parse(process.argv);
}