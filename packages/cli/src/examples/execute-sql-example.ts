/**
 * Execute SQL RPC Function Example
 * -------------------------------
 * This example demonstrates how to use the execute_sql RPC function
 * in Supabase to run arbitrary SQL queries.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate credentials
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Execute an SQL query using the execute_sql RPC function
 * @param sql The SQL query to execute
 * @returns The query results
 */
async function executeSql(sql: string) {
  console.log(`Executing SQL query: ${sql}`);
  
  try {
    // Try different function names that might exist in your Supabase project
    // First try execute_sql
    let response = await supabase.rpc('execute_sql', { sql });
    
    // If that fails, try execute_sql_unsafe
    if (response.error && response.error.message.includes("function execute_sql(")) {
      console.log('Trying alternate function name: execute_sql_unsafe');
      response = await supabase.rpc('execute_sql_unsafe', { sql });
    }
    
    const { data, error } = response;
    
    if (error) {
      throw new Error(`Error executing SQL via RPC: ${error.message}`);
    }
    
    // Log results
    console.log(`Query executed successfully`);
    console.log(`Records returned: ${Array.isArray(data) ? data.length : 0}`);
    
    return data;
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Example: Executing an IN clause query using execute_sql
 * This is especially useful when working with dynamic parameters
 */
async function testInClauseQuery() {
  // Define categories to filter by
  const categories = ['AI', 'Development', 'Integration', 'Operations'];
  
  // Build a parameterized query
  // Note how we properly escape string values for SQL safety
  const categoryList = categories.map(cat => `'${cat.replace(/'/g, "''")}'`).join(', ');
  const sql = `SELECT id, document_type, category FROM document_types WHERE category IN (${categoryList})`;
  
  console.log(`Generated SQL for IN clause: ${sql}`);
  
  // Execute the query
  const results = await executeSql(sql);
  
  // Display results
  if (results && Array.isArray(results)) {
    console.log(`Found ${results.length} document types in categories: ${categories.join(', ')}`);
    
    // Display a summary of results
    console.log('\nResults Summary:');
    results.forEach(doc => {
      console.log(`- ${doc.document_type} (${doc.category})`);
    });
  }
}

// Main function
async function main() {
  try {
    // Example 1: Basic SELECT query
    console.log('\nExample 1: Basic SELECT query');
    const basicQueryResults = await executeSql("SELECT id, document_type, category FROM document_types LIMIT 3");
    
    if (basicQueryResults) {
      console.log('First 3 document types:');
      console.log(JSON.stringify(basicQueryResults, null, 2));
    }
    
    // Example 2: IN clause query
    console.log('\nExample 2: IN clause query');
    await testInClauseQuery();
    
    // Example 3: JOIN query
    console.log('\nExample 3: JOIN query');
    const joinQueryResults = await executeSql(`
      SELECT d.id, d.file_path, d.title, dt.document_type, dt.category 
      FROM documentation_files d
      JOIN document_types dt ON d.document_type_id = dt.id
      WHERE dt.category = 'Development'
      LIMIT 5
    `);
    
    if (joinQueryResults) {
      console.log('Development documentation files:');
      console.log(JSON.stringify(joinQueryResults, null, 2));
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the examples when this file is executed directly
if (require.main === module) {
  main()
    .then(() => console.log('\nAll examples completed'))
    .catch(err => console.error('Error in examples:', err));
}

// Export for use in other modules
export { executeSql, testInClauseQuery };