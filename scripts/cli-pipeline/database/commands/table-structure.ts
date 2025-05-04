import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();

program
  .name('table-structure')
  .description('Get detailed information about a table structure')
  .argument('<table-name>', 'Name of the table to analyze')
  .option('-f, --format <format>', 'Output format (json or table)', 'table')
  .option('--no-color', 'Disable colored output')
  .action(async (tableName: string, options: { format?: string; color?: boolean }) => {
    const trackingId = await commandTrackingService.startTracking('database', 'table-structure');
    try {
      // Get the table structure
      const tableStructure = await databaseService.getTableStructure(tableName);
      
      if (options.format === 'json') {
        // Output as JSON
        console.log(JSON.stringify(tableStructure, null, 2));
      } else {
        // Output as tables
        
        // Columns table
        const columnsTable = new Table({
          head: [
            chalk.cyan('Column Name'),
            chalk.cyan('Data Type'),
            chalk.cyan('Nullable'),
            chalk.cyan('Default')
          ]
        });
        
        if (Array.isArray(tableStructure.columns)) {
          tableStructure.columns.forEach((column: any) => {
            columnsTable.push([
              column.column_name,
              column.data_type,
              column.is_nullable === 'YES' 
                ? chalk.yellow('YES') 
                : chalk.green('NO'),
              column.column_default || '-'
            ]);
          });
          
          console.log(chalk.bold('\nCOLUMNS:'));
          console.log(columnsTable.toString());
        } else if (Array.isArray(tableStructure)) {
          // Handle the case where we get a flat array from an RPC function
          tableStructure.forEach((col: any) => {
            columnsTable.push([
              col.column_name,
              col.data_type,
              col.is_nullable === 'YES' 
                ? chalk.yellow('YES') 
                : chalk.green('NO'),
              col.column_default || '-'
            ]);
          });
          
          console.log(chalk.bold('\nCOLUMNS:'));
          console.log(columnsTable.toString());
        }
        
        // Constraints table
        if (tableStructure.constraints && Array.isArray(tableStructure.constraints)) {
          const constraintsTable = new Table({
            head: [
              chalk.cyan('Constraint Name'),
              chalk.cyan('Type'),
              chalk.cyan('Column(s)')
            ]
          });
          
          tableStructure.constraints.forEach((constraint: any) => {
            let columns = '';
            if (constraint.information_schema_key_column_usage) {
              columns = constraint.information_schema_key_column_usage
                .map((col: any) => col.column_name)
                .join(', ');
            }
            
            constraintsTable.push([
              constraint.constraint_name,
              constraint.constraint_type,
              columns
            ]);
          });
          
          console.log(chalk.bold('\nCONSTRAINTS:'));
          console.log(constraintsTable.toString());
        }
        
        // Indexes table
        if (tableStructure.indexes && Array.isArray(tableStructure.indexes)) {
          const indexesTable = new Table({
            head: [
              chalk.cyan('Index Name'),
              chalk.cyan('Definition')
            ]
          });
          
          tableStructure.indexes.forEach((index: any) => {
            indexesTable.push([
              index.indexname,
              index.indexdef
            ]);
          });
          
          console.log(chalk.bold('\nINDEXES:'));
          console.log(indexesTable.toString());
        }
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        summary: `Retrieved structure for table ${tableName}`
      });
    } catch (error) {
      console.error(chalk.red(`Error getting structure for table ${tableName}:`), error);
      
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to get table structure: ${error instanceof Error ? error.message : String(error)}`
      );
      
      process.exit(1);
    }
  });

export default program;