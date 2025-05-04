// Simplified version of table-records to test output
import { databaseService } from '../../../../../packages/shared/services/database-service';
import chalk from 'chalk';
import Table from 'cli-table3';

async function main() {
  console.log("--- STARTING TABLE OUTPUT TEST ---");
  
  try {
    // Get all tables with record counts
    const tables = await databaseService.getTablesWithRecordCounts();
    
    // Show we have the data
    console.log(`Retrieved ${tables.length} tables`);
    
    // Create a table for display
    const table = new Table({
      head: [
        chalk.cyan('Table Name'), 
        chalk.cyan('Record Count')
      ],
      colWidths: [40, 15]
    });
    
    // Add table data - just the first 10 tables
    tables.slice(0, 10).forEach(tableInfo => {
      table.push([
        tableInfo.tableName,
        tableInfo.count === -1 ? chalk.red('ERROR') : tableInfo.count.toString()
      ]);
    });
    
    // Print the table
    console.log("PRINTING TABLE:");
    console.log(table.toString());
    console.log(`Total tables: ${tables.length}`);
    
    // Calculate statistics
    const totalRecords = tables.reduce((sum, table) => {
      return sum + (table.count > 0 ? table.count : 0);
    }, 0);
    
    console.log(`Total records: ${totalRecords}`);
    
    const tablesWithNoRecords = tables.filter(table => table.count === 0).length;
    console.log(`Tables with no records: ${tablesWithNoRecords}`);
    
  } catch (error) {
    console.error('Error listing tables:', error);
  }
  
  console.log("--- END OF TABLE OUTPUT TEST ---");
}

main();