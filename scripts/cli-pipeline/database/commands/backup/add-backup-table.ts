import { Command } from 'commander';
import { databaseService } from '../../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';
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

// Save backup configuration
function saveBackupConfig(config: BackupConfig): void {
  const configPath = path.join(__dirname, '../../backup-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

program
  .name('add-backup-table')
  .description('Add a table to the backup configuration')
  .argument('<table>', 'Table name to add to backup configuration')
  .option('--position <position>', 'Position to insert table (default: end)', 'end')
  .option('--force', 'Add table even if it doesn\'t exist in database')
  .action(async (tableName: string, options) => {
    const trackingId = await commandTrackingService.startTracking('database', 'add-backup-table');
    try {
      console.log(chalk.blue(`📝 Adding table "${tableName}" to backup configuration...`));
      
      // Load current configuration
      const config = loadBackupConfig();
      
      // Check if table already exists in config
      if (config.tables.includes(tableName)) {
        console.log(chalk.yellow(`⚠️  Table "${tableName}" is already in the backup configuration`));
        await commandTrackingService.completeTracking(trackingId);
        return;
      }
      
      // Validate that table exists in database (unless --force is used)
      if (!options.force) {
        console.log(chalk.gray('Validating table exists in database...'));
        const existingTables = await databaseService.getTablesWithRecordCounts();
        const tableExists = existingTables.some(t => t.tableName === tableName);
        
        if (!tableExists) {
          throw new Error(`Table "${tableName}" does not exist in the database. Use --force to add anyway.`);
        }
        
        // Show table info
        const tableInfo = existingTables.find(t => t.tableName === tableName);
        if (tableInfo) {
          console.log(chalk.gray(`Table "${tableName}" has ${tableInfo.count} records`));
        }
      }
      
      // Add table to configuration
      if (options.position === 'start' || options.position === 'beginning') {
        config.tables.unshift(tableName);
      } else if (options.position === 'end') {
        config.tables.push(tableName);
      } else {
        // Try to parse as number
        const position = parseInt(options.position);
        if (!isNaN(position) && position >= 0) {
          config.tables.splice(position, 0, tableName);
        } else {
          throw new Error(`Invalid position: ${options.position}. Use 'start', 'end', or a number.`);
        }
      }
      
      // Save updated configuration
      saveBackupConfig(config);
      
      // Show updated configuration
      console.log(chalk.green(`\n✅ Successfully added "${tableName}" to backup configuration`));
      console.log(chalk.cyan('\nUpdated backup table list:'));
      config.tables.forEach((table, index) => {
        const marker = table === tableName ? chalk.green(' ← NEW') : '';
        console.log(chalk.gray(`  ${index + 1}. ${table}${marker}`));
      });
      
      console.log(chalk.gray(`\nTotal tables configured for backup: ${config.tables.length}`));
      
      await commandTrackingService.completeTracking(trackingId, {
        summary: `Added "${tableName}" to backup configuration`
      });
    } catch (error) {
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to add table: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error(chalk.red('Error adding table to backup configuration:'), error);
      process.exit(1);
    }
  });

// Export for use in CLI
export default program;

// Run if called directly
if (require.main === module) {
  program.parse(process.argv);
}