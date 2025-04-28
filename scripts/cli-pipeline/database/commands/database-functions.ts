import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();

program
  .name('database-functions')
  .description('List database functions')
  .option('-f, --filter <pattern>', 'Filter function names by pattern (e.g., "get_")')
  .option('-t, --type <type>', 'Filter by function type (e.g., "FUNCTION")')
  .action(async (options) => {
    const trackingId = await commandTrackingService.startTracking('database', 'database-functions');
    try {
      // Get all database functions
      const functions = await databaseService.getDatabaseFunctions();
      
      // Filter functions based on options
      let filteredFunctions = functions;
      
      // Filter by function name pattern
      if (options.filter) {
        const pattern = new RegExp(options.filter, 'i');
        filteredFunctions = filteredFunctions.filter(fn => pattern.test(fn.name));
      }
      
      // Filter by function type
      if (options.type) {
        filteredFunctions = filteredFunctions.filter(fn => 
          fn.type && fn.type.toLowerCase() === options.type.toLowerCase()
        );
      }
      
      // Sort results by function name
      filteredFunctions.sort((a, b) => a.name.localeCompare(b.name));
      
      // Create a table for display
      const table = new Table({
        head: [
          chalk.cyan('Function Name'), 
          chalk.cyan('Type'), 
          chalk.cyan('Usage')
        ],
        colWidths: [40, 15, 40]
      });
      
      // Add table data
      filteredFunctions.forEach(fn => {
        table.push([
          fn.name,
          fn.type || 'N/A',
          fn.usage || 'Unknown'
        ]);
      });
      
      // Print the table
      console.log(table.toString());
      console.log(`\nTotal functions: ${filteredFunctions.length}`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: filteredFunctions.length,
        summary: `Listed ${filteredFunctions.length} database functions`
      });
    } catch (error) {
      console.error(chalk.red('Error listing database functions:'), error);
      
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to list database functions: ${error instanceof Error ? error.message : String(error)}`
      );
      
      process.exit(1);
    }
  });

export default program;