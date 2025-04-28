import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();

program
  .name('table-records')
  .description('List tables with record counts')
  .option('-m, --min-count <number>', 'Only show tables with at least this many records', parseInt)
  .option('-s, --sort', 'Sort results by record count (descending)', false)
  .option('-r, --reverse', 'Reverse the sort order', false)
  .option('-f, --filter <pattern>', 'Filter table names by pattern (e.g., "document")')
  .action(async (options) => {
    const trackingId = await commandTrackingService.startTracking('database', 'table-records');
    try {
      // Get all tables with record counts
      const tables = await databaseService.getTablesWithRecordCounts();
      
      // Filter tables based on options
      let filteredTables = tables;
      
      // Filter by minimum count
      if (options.minCount !== undefined && !isNaN(options.minCount)) {
        filteredTables = filteredTables.filter(table => table.count >= options.minCount);
      }
      
      // Filter by table name pattern
      if (options.filter) {
        const pattern = new RegExp(options.filter, 'i');
        filteredTables = filteredTables.filter(table => pattern.test(table.tableName));
      }
      
      // Sort results
      if (options.sort) {
        filteredTables.sort((a, b) => {
          return options.reverse ? a.count - b.count : b.count - a.count;
        });
      } else {
        // Default sort by table name
        filteredTables.sort((a, b) => {
          return options.reverse 
            ? b.tableName.localeCompare(a.tableName) 
            : a.tableName.localeCompare(b.tableName);
        });
      }
      
      // Create a table for display
      const table = new Table({
        head: [
          chalk.cyan('Table Name'), 
          chalk.cyan('Record Count')
        ],
        colWidths: [40, 15]
      });
      
      // Add table data
      filteredTables.forEach(tableInfo => {
        table.push([
          tableInfo.tableName,
          tableInfo.count === -1 ? chalk.red('ERROR') : tableInfo.count.toString()
        ]);
      });
      
      // Print the table
      console.log(table.toString());
      console.log(`\nTotal tables: ${filteredTables.length}`);
      
      // Calculate statistics
      const totalRecords = filteredTables.reduce((sum, table) => {
        return sum + (table.count > 0 ? table.count : 0);
      }, 0);
      
      console.log(`Total records: ${totalRecords}`);
      
      const tablesWithNoRecords = filteredTables.filter(table => table.count === 0).length;
      console.log(`Tables with no records: ${tablesWithNoRecords}`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: filteredTables.length,
        summary: `Listed ${filteredTables.length} tables with record counts`
      });
    } catch (error) {
      console.error(chalk.red('Error listing tables:'), error);
      
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to list tables: ${error instanceof Error ? error.message : String(error)}`
      );
      
      process.exit(1);
    }
  });

export default program;