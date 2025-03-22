#\!/bin/bash
# Script to run verification of the status_recommendation migration

# Set up directory variables
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VERIFY_SQL_PATH="$SCRIPT_DIR/verify_migration.sql"

# Change to the project root directory
cd "$ROOT_DIR" || exit 1

# Create a temporary Node.js script to run the verification
TEMP_SCRIPT=$(mktemp)

cat > "$TEMP_SCRIPT" << 'EOLJS'
const fs = require('fs');
const path = require('path');

// Look for CLI client
try {
  const cliClientPath = path.join(process.cwd(), 'packages/cli/dist/services/supabase-client.js');
  
  if (fs.existsSync(cliClientPath)) {
    console.log('Using CLI Supabase client modules...');
    const { SupabaseClientService } = require(cliClientPath);
    const clientService = new SupabaseClientService();
    const client = clientService.getClient();
    
    if (client) {
      console.log('Successfully initialized Supabase client');
      
      // Read the verification SQL
      const sqlPath = path.join(process.cwd(), 'scripts/verify_migration.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      
      // Split into individual statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      console.log(`Found ${statements.length} SQL statements to execute`);
      
      // Execute each statement separately and collect results
      const executeStatements = async () => {
        const results = [];
        
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          console.log(`Executing statement ${i+1}/${statements.length}...`);
          
          try {
            const { data, error } = await client.rpc('execute_sql', { sql: stmt + ';' });
            
            if (error) {
              console.error(`Error executing statement ${i+1}: ${error.message}`);
            } else {
              results[i] = data;
            }
          } catch (err) {
            console.error(`Exception executing statement ${i+1}: ${err.message}`);
          }
        }
        
        return results;
      };
      
      // Execute all statements and process results
      executeStatements().then(data => {
        if (!data || data.length === 0) {
          console.error('No results returned from SQL execution');
          return;
        }
        
        // Process the results from multiple queries
        if (data && Array.isArray(data)) {
          console.log('\n===== Migration Verification Results =====\n');
          
          // First part: Display counts from the various locations
          console.log('Status recommendation locations:');
          
          for (let i = 0; i < 5; i++) {
            if (data[i] && data[i].length > 0) {
              const row = data[i][0];
              console.log(`- ${row.location}: ${row.count}`);
            }
          }
          
          console.log('');
          
          // Second part: Total records with status and records needing migration 
          if (data[5] && data[5].length > 0) {
            console.log(`- ${data[5][0].metric}: ${data[5][0].count}`);
          }
          
          if (data[6] && data[6].length > 0) {
            console.log(`- ${data[6][0].metric}: ${data[6][0].count}`);
          }
          
          // Check if any updates were needed
          const neededMigration = data[6] && data[6].length > 0 && data[6][0].count > 0;
          
          // If we needed migration, we'll have results at the end for post-migration counts
          if (neededMigration) {
            console.log('\nMigration was performed to fix missing status_recommendation values');
            
            // Show results after migration
            if (data[11] && data[11].length > 0) {
              console.log(`- ${data[11][0].metric}: ${data[11][0].count}`);
            }
            
            if (data[12] && data[12].length > 0) {
              console.log(`- ${data[12][0].metric}: ${data[12][0].count}`);
            }
          } else {
            console.log('\nNo migration needed, all records are up to date.');
          }
          
          console.log('\n=========================================');
        } else {
          console.log('No data returned from verification SQL');
        }
      });
    } else {
      console.error('Failed to get Supabase client from CLI modules');
      process.exit(1);
    }
  } else {
    console.error('Could not find CLI client modules');
    process.exit(1);
  }
} catch (err) {
  console.error('Error in verification script:', err);
  process.exit(1);
}
EOLJS

# Run the script
node "$TEMP_SCRIPT"

# Clean up
rm "$TEMP_SCRIPT"
