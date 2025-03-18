/**
 * Supabase RPC Function Example
 * ----------------------------
 * This example demonstrates how to call RPC functions in Supabase
 * including the execute_sql function which allows running arbitrary SQL queries.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
 * Example 1: Basic RPC function call
 * This demonstrates how to call an RPC function with a single parameter
 */
async function executeBasicRpcExample() {
  console.log('Example 1: Basic RPC function call');
  
  try {
    // Call a simple RPC function that returns the current timestamp
    // Note: This assumes you have a function called get_current_timestamp in your Supabase project
    const { data, error } = await supabase.rpc('get_current_timestamp');
    
    if (error) {
      throw new Error(`Error executing RPC: ${error.message}`);
    }
    
    console.log('Result:', data);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Example 2: Using the execute_sql RPC function
 * This demonstrates how to execute SQL queries using the execute_sql RPC function
 */
async function executeCustomSqlQuery(sql: string) {
  console.log(`Example 2: Using execute_sql RPC function`);
  console.log(`SQL Query: ${sql}`);
  
  try {
    // Call the execute_sql RPC function with the SQL parameter
    const { data, error } = await supabase.rpc('execute_sql', { sql });
    
    if (error) {
      throw new Error(`Error executing SQL via RPC: ${error.message}`);
    }
    
    console.log(`Records returned: ${Array.isArray(data) ? data.length : 0}`);
    console.log('Result:', JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Example 3: Using RPC functions with multiple parameters
 * This demonstrates how to call RPC functions that accept multiple parameters
 */
async function executeMultiParamRpc() {
  console.log('Example 3: RPC function with multiple parameters');
  
  try {
    // Example calling a hypothetical function that retrieves documentation files by type
    // Note: This assumes you have a get_documentation_by_type function in your Supabase project
    const { data, error } = await supabase.rpc('get_documentation_by_type', {
      type_category: 'Development',
      limit_count: 5,
      include_deleted: false
    });
    
    if (error) {
      throw new Error(`Error executing multi-param RPC: ${error.message}`);
    }
    
    console.log(`Records returned: ${Array.isArray(data) ? data.length : 0}`);
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Example 4: Creating a dynamic IN clause query with execute_sql
 * This demonstrates how to execute a query with an IN clause using execute_sql
 */
async function executeDynamicInClauseQuery(categories: string[]) {
  console.log('Example 4: Dynamic IN clause query with execute_sql');
  
  try {
    // Safely build the SQL query with proper parameter formatting
    const categoryList = categories.map(cat => `'${cat.replace(/'/g, "''")}'`).join(', ');
    const sql = `SELECT id, document_type, category FROM document_types WHERE category IN (${categoryList})`;
    
    console.log(`Generated SQL: ${sql}`);
    
    // Execute the query using the execute_sql RPC function
    return await executeCustomSqlQuery(sql);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Execute all examples
async function runAllExamples() {
  try {
    // Example 1: Basic RPC function call
    await executeBasicRpcExample();
    console.log('\n');
    
    // Example 2: Execute SQL query via RPC
    const sqlQuery = "SELECT id, document_type, category FROM document_types LIMIT 5";
    await executeCustomSqlQuery(sqlQuery);
    console.log('\n');
    
    // Example 3: RPC with multiple parameters
    await executeMultiParamRpc();
    console.log('\n');
    
    // Example 4: Dynamic IN clause query
    const categories = ['AI', 'Development', 'Integration', 'Operations'];
    await executeDynamicInClauseQuery(categories);
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run the examples when this file is executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => console.log('All examples completed'))
    .catch(err => console.error('Error in examples:', err));
}

// Export functions for use in other modules
export {
  executeBasicRpcExample,
  executeCustomSqlQuery,
  executeMultiParamRpc,
  executeDynamicInClauseQuery
};