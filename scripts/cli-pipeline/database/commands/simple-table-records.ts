/**
 * Simple Table Records - A simple version of table-records that doesn't use commander.js
 * This is a fallback version for when the normal command doesn't display output
 */

import { databaseService } from '../../../../packages/shared/services/database-service';

// Immediately self-executing async function
(async () => {
  try {
    console.log("=== Database Table Records ===");
    console.log("Fetching all tables...");
    
    // Get tables
    const tables = await databaseService.getTablesWithRecordCounts();
    
    // Sort by name
    tables.sort((a, b) => a.tableName.localeCompare(b.tableName));
    
    // Print header
    console.log("\nTABLE NAME                                    | RECORD COUNT");
    console.log("--------------------------------------------------------");
    
    // Print each table
    for (const table of tables) {
      const count = table.count === -1 ? "ERROR" : table.count.toString();
      console.log(`${table.tableName.padEnd(45)} | ${count}`);
    }
    
    console.log("--------------------------------------------------------");
    console.log(`Total tables: ${tables.length}`);
    
    // Calculate statistics
    const totalRecords = tables.reduce((sum, table) => sum + (table.count > 0 ? table.count : 0), 0);
    console.log(`Total records: ${totalRecords}`);
    
    const emptyTables = tables.filter(t => t.count === 0).length;
    console.log(`Tables with no records: ${emptyTables}`);
    
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
})();