import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Exit if no credentials
if (\!supabaseUrl || \!supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// Create Supabase client
const client = createClient(supabaseUrl, supabaseKey);

// Test query from the test-in-query-prompt.md file
const queryText = "SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')";

async function testExecuteSqlRpc() {
  console.log('Testing execute_sql RPC function');
  console.log(`Query: ${queryText}`);
  
  try {
    // Call the RPC function
    const { data, error } = await client.rpc('execute_sql', { sql: queryText });
    
    if (error) {
      console.error('Error executing RPC function:', error);
      return;
    }
    
    console.log('Successfully executed query via RPC function');
    console.log(`Records found: ${Array.isArray(data) ? data.length : 0}`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Exception executing RPC function:', err);
  }
}

testExecuteSqlRpc();
