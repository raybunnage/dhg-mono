#!/bin/bash
# Script to run the status_recommendation migration using the best available Supabase connection
# Tries multiple sources for Supabase connectivity in order of preference:
# 1. CLI packages (packages/cli/src/services/supabase-client.ts)
# 2. scripts/fix/supabase-connect.js
# 3. Direct environment/config file detection

# Set up directory variables
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to the project root directory
cd "$ROOT_DIR" || exit 1

# Define paths to potential Supabase connection modules
CLI_SUPABASE_CLIENT="./packages/cli/dist/services/supabase-client.js"
CLI_SUPABASE_SERVICE="./packages/cli/dist/services/supabase-service.js"
SUPABASE_CONNECT_PATH="./scripts/fix/supabase-connect.js"
SQL_MIGRATION_PATH="./scripts/migrate_status_recommendation.sql"

# Check if SQL migration file exists
if [ ! -f "$SQL_MIGRATION_PATH" ]; then
  echo "Error: SQL migration file $SQL_MIGRATION_PATH not found."
  exit 1
fi

# Create a temporary Node.js script
TEMP_SCRIPT=$(mktemp)

cat > "$TEMP_SCRIPT" << 'EOL'
const fs = require('fs');
const path = require('path');

// Try to find @supabase/supabase-js in various locations
let createClient;
try {
  // First try to require it directly
  const supabase = require('@supabase/supabase-js');
  createClient = supabase.createClient;
  console.log('Loaded @supabase/supabase-js from node_modules');
} catch (e) {
  // If that fails, try to find it in monorepo node_modules
  try {
    const supabase = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));
    createClient = supabase.createClient;
    console.log('Loaded @supabase/supabase-js from project node_modules');
  } catch (e2) {
    // Try to find it in CLI package
    try {
      const pkgPath = path.join(process.cwd(), 'packages/cli/node_modules/@supabase/supabase-js');
      const supabase = require(pkgPath);
      createClient = supabase.createClient;
      console.log('Loaded @supabase/supabase-js from CLI package');
    } catch (e3) {
      // Check if there's a create-client.js we can use as a last resort from the supabase connect script
      try {
        const connectPath = path.join(process.cwd(), 'scripts/fix/supabase-connect.js');
        if (fs.existsSync(connectPath)) {
          // Extract createClient from the file
          const fileContent = fs.readFileSync(connectPath, 'utf8');
          const createClientMatch = fileContent.match(/const\s+{\s*createClient\s*}\s*=\s*require\s*\(\s*['"]@supabase\/supabase-js['"]\s*\)/);
          
          if (createClientMatch) {
            // If we find the import, we know the module is available somewhere
            console.log('Found createClient reference in supabase-connect.js, trying to import dynamically');
            
            // Try node_modules paths in various locations
            const paths = [
              './node_modules',
              '../node_modules',
              '../../node_modules',
              './packages/cli/node_modules'
            ];
            
            let found = false;
            for (const p of paths) {
              try {
                const fullPath = path.join(process.cwd(), p, '@supabase/supabase-js');
                const supabase = require(fullPath);
                createClient = supabase.createClient;
                console.log(`Found @supabase/supabase-js in ${p}`);
                found = true;
                break;
              } catch (err) {
                // Skip silently
              }
            }
            
            if (!found) {
              console.error('Could not locate @supabase/supabase-js though reference exists in code');
              console.error('You can install it with: npm install --no-save @supabase/supabase-js');
              process.exit(1);
            }
          } else {
            console.error('Could not extract createClient from supabase-connect.js');
            console.error('You can install it with: npm install --no-save @supabase/supabase-js');
            process.exit(1);
          }
        } else {
          console.error('Could not load @supabase/supabase-js. Make sure it is installed.');
          console.error('You can install it with: npm install --no-save @supabase/supabase-js');
          process.exit(1);
        }
      } catch (e4) {
        console.error('All attempts to find @supabase/supabase-js failed.');
        console.error('You can install it with: npm install --no-save @supabase/supabase-js');
        process.exit(1);
      }
    }
  }
}

// Log with colored output
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m', // Cyan
    success: '\x1b[32m%s\x1b[0m', // Green
    warning: '\x1b[33m%s\x1b[0m', // Yellow
    error: '\x1b[31m%s\x1b[0m', // Red
  };
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}]`;
  
  if (type === 'error') {
    console.error(colors[type], prefix, message);
  } else if (type === 'warning') {
    console.warn(colors[type], prefix, message);
  } else {
    console.log(colors[type], prefix, message);
  }
}

// Attempt to load the CLI Supabase client if available
async function tryLoadCliSupabaseClient() {
  try {
    const cliClientPath = path.join(process.cwd(), 'packages/cli/dist/services/supabase-client.js');
    const cliServicePath = path.join(process.cwd(), 'packages/cli/dist/services/supabase-service.js');
    
    if (fs.existsSync(cliClientPath) && fs.existsSync(cliServicePath)) {
      log('Found CLI Supabase client modules, attempting to use them...');
      
      try {
        // Try to import the CLI modules
        const SupabaseClientService = require(cliClientPath).SupabaseClientService;
        const clientService = new SupabaseClientService();
        
        // Test if we got a valid client
        if (clientService && typeof clientService.getClient === 'function') {
          const client = clientService.getClient();
          log('Successfully initialized Supabase client using CLI modules', 'success');
          return { success: true, client };
        }
      } catch (e) {
        log(`Error importing CLI modules: ${e.message}`, 'warning');
      }
    }
    return { success: false };
  } catch (error) {
    log(`Failed to load CLI Supabase client: ${error.message}`, 'warning');
    return { success: false };
  }
}

// Attempt to use supabase-connect.js
async function tryLoadSupabaseConnect() {
  try {
    const supabaseConnectPath = path.join(process.cwd(), 'scripts/fix/supabase-connect.js');
    
    if (!fs.existsSync(supabaseConnectPath)) {
      return { success: false };
    }
    
    log('Found supabase-connect.js, attempting to use it...');
    
    // Try to load the module
    const supabaseConnectModule = require(supabaseConnectPath);
    
    // Try to find the getSupabaseCredentials function
    let getSupabaseCredentials;
    
    if (typeof supabaseConnectModule.getSupabaseCredentials === 'function') {
      getSupabaseCredentials = supabaseConnectModule.getSupabaseCredentials;
    } else {
      // Extract the function using regex
      const fileContent = fs.readFileSync(supabaseConnectPath, 'utf8');
      const functionMatch = fileContent.match(/function getSupabaseCredentials\(\) \{[\s\S]*?return \{[^}]*\};\s*\}/);
      
      if (functionMatch) {
        eval('getSupabaseCredentials = ' + functionMatch[0]);
      } else {
        return { success: false };
      }
    }
    
    // Get the credentials
    const credentials = getSupabaseCredentials();
    
    if (credentials && credentials.url && credentials.serviceKey) {
      log('Successfully obtained Supabase credentials from supabase-connect.js', 'success');
      const client = createClient(credentials.url, credentials.serviceKey);
      return { success: true, client };
    }
    
    return { success: false };
  } catch (error) {
    log(`Failed to use supabase-connect.js: ${error.message}`, 'warning');
    return { success: false };
  }
}

// Direct search for Supabase credentials in environment and config files
async function findSupabaseCredentialsDirect() {
  try {
    log('Searching for Supabase credentials in environment and config files...');
    
    // Possible environment variable names
    const urlVarNames = ['SUPABASE_URL', 'VITE_SUPABASE_URL'];
    const keyVarNames = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_KEY',
      'VITE_SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    // Check environment variables first
    let url, serviceKey;
    
    for (const varName of urlVarNames) {
      if (process.env[varName]) {
        url = process.env[varName];
        break;
      }
    }
    
    for (const varName of keyVarNames) {
      if (process.env[varName]) {
        serviceKey = process.env[varName];
        break;
      }
    }
    
    if (url && serviceKey) {
      log('Found Supabase credentials in environment variables', 'success');
      const client = createClient(url, serviceKey);
      return { success: true, client };
    }
    
    // Try reading from .env files
    const envFiles = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env.development'),
      path.join(process.cwd(), '.env')
    ];
    
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        log(`Checking ${envFile} for Supabase credentials...`);
        
        const content = fs.readFileSync(envFile, 'utf8');
        const variables = {};
        
        content.split('\n').forEach(line => {
          if (line.trim() && !line.trim().startsWith('#')) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
              const key = match[1].trim();
              let value = match[2].trim();
              
              // Remove quotes if present
              if ((value.startsWith('"') && value.endsWith('"')) ||
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
              }
              
              variables[key] = value;
            }
          }
        });
        
        // Check for URL and key in this file
        for (const varName of urlVarNames) {
          if (variables[varName] && !url) {
            url = variables[varName];
          }
        }
        
        for (const varName of keyVarNames) {
          if (variables[varName] && !serviceKey) {
            serviceKey = variables[varName];
          }
        }
        
        if (url && serviceKey) {
          log(`Found Supabase credentials in ${envFile}`, 'success');
          const client = createClient(url, serviceKey);
          return { success: true, client };
        }
      }
    }
    
    log('Could not find Supabase credentials in any location', 'error');
    return { success: false };
  } catch (error) {
    log(`Error finding Supabase credentials: ${error.message}`, 'error');
    return { success: false };
  }
}

// Test Supabase connection
async function testConnection(client) {
  try {
    log('Testing Supabase connection...');
    
    // Try to access the documentation_files table
    const { error } = await client
      .from('documentation_files')
      .select('count', { count: 'exact', head: true });
      
    if (error) {
      log(`Error accessing documentation_files table: ${error.message}`, 'error');
      return false;
    }
    
    log('Supabase connection test successful', 'success');
    return true;
  } catch (error) {
    log(`Connection test failed: ${error.message}`, 'error');
    return false;
  }
}

// Execute SQL via a stored procedure that can run raw SQL
async function executeRawSql(client, sql) {
  try {
    const { data, error } = await client.rpc('execute_sql', { 
      sql: sql.trim().endsWith(';') ? sql : sql + ';' 
    });
    
    // Extract and display notices from the data
    if (data && Array.isArray(data)) {
      const notices = data.filter(row => row && typeof row === 'object' && row.notice);
      
      if (notices.length > 0) {
        log("\n========== Migration Notices ==========", 'info');
        notices.forEach(notice => {
          log(notice.notice, 'info');
        });
        log("========================================", 'info');
      }
    }
    
    return { data, error };
  } catch (err) {
    return { error: err };
  }
}

// Execute a SQL statement
async function executeStatement(client, stmt, index, total) {
  // Skip empty statements
  if (!stmt || !stmt.trim()) return { success: true };
  
  try {
    // For UPDATE statements
    if (stmt.toLowerCase().trim().startsWith('update')) {
      log(`\nExecuting update ${index}/${total}: ${stmt.slice(0, 60)}...`, 'info');
      
      // Use the stored procedure to execute raw SQL
      const { error } = await executeRawSql(client, stmt);
      
      if (error) {
        log(`Error executing update: ${error.message}`, 'error');
        return { success: false, error };
      } else {
        log("Update completed successfully.", 'success');
        return { success: true, rowsAffected: 0 }; // We don't get affected rows with this method
      }
    } 
    // If it's a SELECT statement for status count
    else if (stmt.toLowerCase().includes('number of records with status_recommendation')) {
      log(`\nExecuting count query ${index}/${total}: ${stmt.slice(0, 60)}...`, 'info');
      
      const { data, count, error } = await client
        .from('documentation_files')
        .select('*', { count: 'exact', head: true })
        .filter('status_recommendation', 'not.is', null);
      
      if (error) {
        log(`Error executing query: ${error.message}`, 'error');
        return { success: false, error };
      } else {
        const result = [{ 'status_count': `Number of records with status_recommendation: ${count}` }];
        log("Results:", 'success');
        console.table(result);
        return { success: true, data: result };
      }
    } 
    // If it's a SELECT statement for status distribution
    else if (stmt.toLowerCase().includes('status_recommendation') && 
             stmt.toLowerCase().includes('count(*)') && 
             stmt.toLowerCase().includes('percentage')) {
      log(`\nExecuting distribution query ${index}/${total}: ${stmt.slice(0, 60)}...`, 'info');
      
      // First get the total count
      const { count: totalCount, error: countError } = await client
        .from('documentation_files')
        .select('*', { count: 'exact', head: true })
        .filter('status_recommendation', 'not.is', null);
      
      if (countError) {
        log(`Error getting total count: ${countError.message}`, 'error');
        return { success: false, error: countError };
      }
      
      // Then get the distribution
      const { data, error } = await client
        .from('documentation_files')
        .select('status_recommendation')
        .filter('status_recommendation', 'not.is', null);
      
      if (error) {
        log(`Error executing query: ${error.message}`, 'error');
        return { success: false, error };
      } else {
        // Process the results to get the distribution
        const distribution = {};
        data.forEach(row => {
          const status = row.status_recommendation;
          distribution[status] = (distribution[status] || 0) + 1;
        });
        
        // Format the results
        const results = Object.entries(distribution).map(([status, count]) => ({
          status_recommendation: status,
          count,
          percentage: totalCount > 0 ? ((count / totalCount) * 100).toFixed(2) : 0
        }));
        
        // Sort by count in descending order
        results.sort((a, b) => b.count - a.count);
        
        log("Results:", 'success');
        console.table(results);
        return { success: true, data: results };
      }
    }
    // Other statements (fallback to execute_sql RPC)
    else {
      log(`\nExecuting SQL ${index}/${total}: ${stmt.slice(0, 60)}...`, 'info');
      
      const { data, error } = await executeRawSql(client, stmt);
      
      if (error) {
        log(`Error executing SQL: ${error.message}`, 'error');
        return { success: false, error };
      } else {
        log("SQL executed successfully", 'success');
        if (data) {
          console.table(data);
        }
        return { success: true, data };
      }
    }
  } catch (error) {
    log(`Error executing statement: ${error.message}`, 'error');
    return { success: false, error };
  }
}

// Run the migration
async function runMigration() {
  // First try the CLI client
  let clientResult = await tryLoadCliSupabaseClient();
  
  // If that fails, try supabase-connect.js
  if (!clientResult.success) {
    clientResult = await tryLoadSupabaseConnect();
  }
  
  // If that fails too, try direct credentials search
  if (!clientResult.success) {
    clientResult = await findSupabaseCredentialsDirect();
  }
  
  // If we still don't have a client, exit
  if (!clientResult.success) {
    log('Failed to initialize Supabase client using any available method.', 'error');
    process.exit(1);
  }
  
  // Test the connection
  const connectionSuccess = await testConnection(clientResult.client);
  if (!connectionSuccess) {
    log('Failed to connect to Supabase. Check your credentials.', 'error');
    process.exit(1);
  }
  
  const client = clientResult.client;
  
  // Read the SQL file
  const sqlPath = path.join(process.cwd(), 'scripts/migrate_status_recommendation.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  log("Running status_recommendation migration...");
  
  // We'll execute the entire SQL file as a single statement
  log("Executing full stored procedure migration...", 'info');
  // Just use the entire SQL file
  const statements = [sql];
  
  // Execute statements and collect results
  const results = {
    totalStatements: statements.length,
    successCount: 0,
    errorCount: 0,
    totalRowsAffected: 0,
    selectResults: []
  };
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    const result = await executeStatement(client, stmt, i + 1, statements.length);
    
    if (result.success) {
      results.successCount++;
      if (result.rowsAffected) {
        results.totalRowsAffected += result.rowsAffected;
      }
      // Save SELECT query results to show in the summary
      if (result.data && stmt.toLowerCase().trim().startsWith('select')) {
        results.selectResults.push({
          query: stmt.slice(0, 60) + (stmt.length > 60 ? '...' : ''),
          data: result.data
        });
      }
    } else {
      results.errorCount++;
    }
  }
  
  // Print summary
  log("\n========== Migration Summary ==========", 'info');
  log(`Total statements executed: ${results.totalStatements}`, 'info');
  log(`Successful statements: ${results.successCount}`, 'success');
  
  if (results.errorCount > 0) {
    log(`Failed statements: ${results.errorCount}`, 'error');
  }
  
  log(`Total rows affected: ${results.totalRowsAffected}`, 'info');
  
  // Display SELECT query results
  if (results.selectResults.length > 0) {
    log("\n========== Query Results ==========", 'info');
    
    for (const result of results.selectResults) {
      log(`\nResults for: ${result.query}`, 'info');
      console.table(result.data);
    }
  }
  
  log("=======================================", 'info');
  
  if (results.errorCount > 0) {
    log('Migration completed with errors', 'warning');
    return false;
  } else {
    log('Migration completed successfully!', 'success');
    return true;
  }
}

// Main execution
runMigration()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(err => {
    log(`Migration failed: ${err.message}`, 'error');
    process.exit(1);
  });
EOL

# Create a helper function to install Supabase if needed
install_supabase() {
  # First check if we already have it installed globally or in the project
  if npm list @supabase/supabase-js --json > /dev/null 2>&1; then
    echo "✅ @supabase/supabase-js is already installed"
    return 0
  fi
  
  echo "Installing required dependency @supabase/supabase-js..."
  
  # Try npm first
  npm install --no-save @supabase/supabase-js
  
  # Verify installation was successful
  if ! npm list @supabase/supabase-js --json > /dev/null 2>&1; then
    echo "Failed to install with npm. Trying with pnpm..."
    pnpm install --no-save @supabase/supabase-js
    
    # Check if pnpm installation worked
    if ! pnpm list @supabase/supabase-js --json > /dev/null 2>&1; then
      echo "Failed to install with pnpm. Trying to create a local directory..."
      
      # As a last resort, try a local installation
      TEMP_DIR=$(mktemp -d)
      cd "$TEMP_DIR" || exit 1
      
      echo '{"name":"supabase-temp","version":"1.0.0","private":true}' > package.json
      npm install @supabase/supabase-js
      
      if [ -d "node_modules/@supabase/supabase-js" ]; then
        echo "Successfully installed @supabase/supabase-js in temporary directory"
        # Copy the installed module to our script directory
        TARGET_DIR="$SCRIPT_DIR/node_modules/@supabase"
        mkdir -p "$TARGET_DIR"
        cp -r node_modules/@supabase/supabase-js "$TARGET_DIR/"
        
        # Go back to original directory and clean up
        cd - > /dev/null || exit 1
        rm -rf "$TEMP_DIR"
        
        # Export NODE_PATH to include our temporary node_modules
        export NODE_PATH="$SCRIPT_DIR/node_modules:$NODE_PATH"
        return 0
      else
        cd - > /dev/null || exit 1
        rm -rf "$TEMP_DIR"
        echo "❌ All installation methods failed. Please install @supabase/supabase-js manually."
        return 1
      fi
    fi
  fi
  
  echo "✅ @supabase/supabase-js installed successfully"
  return 0
}

# Try to install supabase if needed
install_supabase

# Run the script
echo "Starting status_recommendation migration..."
node "$TEMP_SCRIPT"
STATUS=$?

# Clean up
rm "$TEMP_SCRIPT"

if [ $STATUS -eq 0 ]; then
  echo "✅ Status recommendation migration completed successfully!"
else
  echo "❌ Migration encountered errors. See above for details."
fi

exit $STATUS