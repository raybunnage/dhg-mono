import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';

const program = new Command();

program
  .name('empty-tables')
  .description('List tables and views with no records')
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
        filteredTables = filteredTables.filter(table => pattern.test(table.tableName));
      }
      
      // Ignore tables matching pattern
      if (options.ignorePattern) {
        const ignorePattern = new RegExp(options.ignorePattern, 'i');
        filteredTables = filteredTables.filter(table => !ignorePattern.test(table.tableName));
      }
      
      // Sort results by type then table name
      filteredTables.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.tableName.localeCompare(b.tableName);
      });
      
      // Display results
      if (filteredTables.length === 0) {
        console.log(chalk.green('No empty tables or views found.'));
      } else {
        console.log(chalk.yellow(`Found ${filteredTables.length} empty tables and views:`));
        console.log('');
        
        let currentType = '';
        let index = 1;
        
        filteredTables.forEach((table) => {
          // Show section header when type changes
          if (table.type !== currentType) {
            currentType = table.type;
            console.log(chalk.blue(`\n${table.type}s:`));
            console.log(chalk.blue('='.repeat(table.type.length + 2)));
          }
          
          console.log(`${index}. ${table.tableName}`);
          index++;
        });
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: filteredTables.length,
        summary: `Found ${filteredTables.length} empty tables and views`
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