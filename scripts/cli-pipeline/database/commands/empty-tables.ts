import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';

const program = new Command();

program
  .name('empty-tables')
  .description('List tables with no records')
  .option('-f, --filter <pattern>', 'Filter table names by pattern (e.g., "backup")')
  .option('-i, --ignore-pattern <pattern>', 'Ignore tables matching pattern (e.g., "_backup")')
  .action(async (options) => {
    const trackingId = await commandTrackingService.startTracking('database', 'empty-tables');
    try {
      // Get all empty tables
      const emptyTables = await databaseService.getEmptyTables();
      
      // Filter tables based on options
      let filteredTables = emptyTables;
      
      // Filter by table name pattern
      if (options.filter) {
        const pattern = new RegExp(options.filter, 'i');
        filteredTables = filteredTables.filter(tableName => pattern.test(tableName));
      }
      
      // Ignore tables matching pattern
      if (options.ignorePattern) {
        const ignorePattern = new RegExp(options.ignorePattern, 'i');
        filteredTables = filteredTables.filter(tableName => !ignorePattern.test(tableName));
      }
      
      // Sort results by table name
      filteredTables.sort();
      
      // Display results
      if (filteredTables.length === 0) {
        console.log(chalk.green('No empty tables found.'));
      } else {
        console.log(chalk.yellow(`Found ${filteredTables.length} empty tables:`));
        console.log('');
        
        filteredTables.forEach((tableName, index) => {
          console.log(`${index + 1}. ${tableName}`);
        });
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: filteredTables.length,
        summary: `Found ${filteredTables.length} empty tables`
      });
    } catch (error) {
      console.error(chalk.red('Error listing empty tables:'), error);
      
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to list empty tables: ${error instanceof Error ? error.message : String(error)}`
      );
      
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

export default program;