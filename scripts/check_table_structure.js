// Check if status_recommendation column exists in documentation_files table

const path = require('path');
const fs = require('fs');

// Try to load CLI client service
try {
  const cliPath = path.join(process.cwd(), 'packages/cli/dist/services/supabase-client.js');
  if (fs.existsSync(cliPath)) {
    console.log('Using CLI Supabase client...');
    const { SupabaseClientService } = require(cliPath);
    const clientService = new SupabaseClientService();
    const client = clientService.getClient();
    
    if (!client) {
      console.error('Failed to initialize client');
      process.exit(1);
    }
    
    checkTable(client);
  } else {
    console.error('CLI client not found at:', cliPath);
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing:', err);
  process.exit(1);
}

async function checkTable(client) {
  try {
    // Check table columns
    const { data, error } = await client.rpc('execute_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'documentation_files'
        ORDER BY ordinal_position
      `
    });
    
    if (error) {
      console.error('Error checking table structure:', error.message);
      return;
    }
    
    console.log('Table structure for documentation_files:');
    console.log('-'.repeat(60));
    console.log('Column Name'.padEnd(30) + 'Data Type'.padEnd(20) + 'Nullable');
    console.log('-'.repeat(60));
    
    data.forEach(col => {
      console.log(col.column_name.padEnd(30) + col.data_type.padEnd(20) + col.is_nullable);
    });
    
    // Check if status_recommendation column exists
    const hasStatusCol = data.some(col => col.column_name === 'status_recommendation');
    console.log(`\nStatus recommendation column exists: ${hasStatusCol ? 'YES' : 'NO'}`);
    
    if (!hasStatusCol) {
      console.log('\nStatus recommendation column needs to be added to the table.');
      console.log('Suggested SQL:');
      console.log(`
        ALTER TABLE documentation_files
        ADD COLUMN status_recommendation TEXT DEFAULT NULL;
      `);
    }
  } catch (error) {
    console.error('Error in checkTable:', error);
  }
}