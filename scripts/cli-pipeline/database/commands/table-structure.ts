import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';

const program = new Command();

program
  .name('table-structure')
  .description('Get detailed information about a table structure')
  .argument('<table-name>', 'Name of the table to analyze')
  .option('-f, --format <format>', 'Output format (json or table)', 'table')
  .action(async (tableName: string, options: { format?: string }) => {
    const trackingId = await commandTrackingService.startTracking('database', 'table-structure');
    try {
      console.log(`=== Table Structure: ${tableName} ===\n`);
      
      // Get the table structure
      const tableStructure = await databaseService.getTableStructure(tableName);
      
      if (options.format === 'json') {
        // Output as JSON
        console.log(JSON.stringify(tableStructure, null, 2));
      } else {
        // Output as simple text tables
        
        // Handle columns
        const columns = Array.isArray(tableStructure.columns) 
          ? tableStructure.columns 
          : Array.isArray(tableStructure) 
            ? tableStructure 
            : [];
        
        if (columns.length > 0) {
          console.log("COLUMNS:");
          console.log("--------");
          console.log("Column Name                    | Data Type          | Nullable | Default");
          console.log("----------------------------------------------------------------------");
          
          columns.forEach((column: any) => {
            const columnName = (column.column_name || '').padEnd(30);
            const dataType = (column.data_type || '').padEnd(18);
            const nullable = (column.is_nullable === 'YES' ? 'YES' : 'NO').padEnd(8);
            const defaultVal = column.column_default || '-';
            
            console.log(`${columnName} | ${dataType} | ${nullable} | ${defaultVal}`);
          });
          console.log("");
        }
        
        // Handle constraints
        if (tableStructure.constraints && Array.isArray(tableStructure.constraints) && tableStructure.constraints.length > 0) {
          console.log("CONSTRAINTS:");
          console.log("-----------");
          console.log("Constraint Name                | Type               | Column(s)");
          console.log("----------------------------------------------------------------------");
          
          tableStructure.constraints.forEach((constraint: any) => {
            let columns = '';
            if (constraint.information_schema_key_column_usage) {
              columns = constraint.information_schema_key_column_usage
                .map((col: any) => col.column_name)
                .join(', ');
            }
            
            const constraintName = (constraint.constraint_name || '').padEnd(30);
            const constraintType = (constraint.constraint_type || '').padEnd(18);
            
            console.log(`${constraintName} | ${constraintType} | ${columns}`);
          });
          console.log("");
        }
        
        // Handle indexes
        if (tableStructure.indexes && Array.isArray(tableStructure.indexes) && tableStructure.indexes.length > 0) {
          console.log("INDEXES:");
          console.log("-------");
          tableStructure.indexes.forEach((index: any) => {
            console.log(`${index.indexname}:`);
            console.log(`  ${index.indexdef}`);
          });
          console.log("");
        }
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        summary: `Retrieved structure for table ${tableName}`
      });
    } catch (error) {
      console.error(`Error getting structure for table ${tableName}:`, error);
      
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to get table structure: ${error instanceof Error ? error.message : String(error)}`
      );
      
      process.exit(1);
    }
  });

// Parse command line arguments if this is the main module
if (require.main === module) {
  program.parse(process.argv);
}

export default program;