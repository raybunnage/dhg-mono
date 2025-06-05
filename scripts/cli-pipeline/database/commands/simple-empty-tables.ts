/**
 * Simple Empty Tables - A simple version of empty-tables that doesn't use commander.js
 * This is a fallback version for when the normal command doesn't display output
 */

import { databaseService } from '../../../../packages/shared/services/database-service';

// Immediately self-executing async function
(async () => {
  try {
    console.log("=== Empty Database Tables ===");
    console.log("Fetching tables with no records...");
    
    // Get empty tables
    const emptyTables = await databaseService.getEmptyTables();
    
    // Sort by name
    emptyTables.sort((a, b) => a.localeCompare(b));
    
    if (emptyTables.length === 0) {
      console.log("\nNo empty tables found in the database.");
    } else {
      // Print header
      console.log("\nEMPTY TABLES");
      console.log("----------------------------------------------------------");
      
      // Print each table
      for (const tableName of emptyTables) {
        console.log(tableName);
      }
      
      console.log("----------------------------------------------------------");
      console.log(`Total empty tables: ${emptyTables.length}`);
    }
    
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
})();