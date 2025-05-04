/**
 * Simple Database Functions - A simplified version that doesn't use commander.js
 * This is a fallback version for when the normal command doesn't display output
 */

import { databaseService } from '../../../../packages/shared/services/database-service';

// Immediately self-executing async function
(async () => {
  try {
    console.log("=== Database Functions ===");
    console.log("Fetching all database functions...");
    
    // Get database functions
    const functions = await databaseService.getDatabaseFunctions();
    
    // Log raw functions for debugging
    console.log(`Retrieved ${functions ? functions.length : 0} functions`);
    
    if (!functions || functions.length === 0) {
      console.log("\nNo database functions found.");
    } else {
      // Make sure we have valid data before sorting
      const validFunctions = functions.filter(fn => fn && fn.name);
      console.log(`Found ${validFunctions.length} valid functions with names`);
      
      // Initialize type groups
      const typeGroups: Record<string, number> = {};
      
      // Sort by name - only if we have valid functions
      if (validFunctions.length > 0) {
        validFunctions.sort((a, b) => a.name.localeCompare(b.name));
        
        // Print header
        console.log("\nFUNCTION NAME                               | TYPE       | USAGE");
        console.log("-----------------------------------------------------------------------------");
        
        // Print each function
        for (const fn of validFunctions) {
          const usage = fn.usage || 'N/A';
          const type = fn.type || 'unknown';
          console.log(`${fn.name.padEnd(40)} | ${type.padEnd(10)} | ${usage}`);
          
          // Track type counts as we go
          typeGroups[type] = (typeGroups[type] || 0) + 1;
        }
        
        console.log("-----------------------------------------------------------------------------");
        console.log(`Total functions: ${validFunctions.length}`);
        
        // Only show type groups if we have any functions
        if (Object.keys(typeGroups).length > 0) {
          console.log("\nFunctions by Type:");
          for (const [type, count] of Object.entries(typeGroups)) {
            console.log(`  ${type}: ${count}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
})();