/**
 * Simple Supabase RPC Test
 * -----------------------
 * This script tests for available RPC functions in your Supabase project.
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
 * Test if an RPC function exists and is callable
 */
async function testRpcFunction(functionName: string, params: any = {}) {
  console.log(`Testing RPC function "${functionName}"...`);
  
  try {
    const { data, error } = await supabase.rpc(functionName, params);
    
    if (error) {
      if (error.message.includes(`function ${functionName}(`) || 
          error.message.includes('does not exist')) {
        console.log(`❌ Function "${functionName}" does not exist in your Supabase project.`);
        return false;
      } else {
        console.log(`⚠️ Function "${functionName}" exists but returned an error: ${error.message}`);
        return true;
      }
    }
    
    console.log(`✅ Function "${functionName}" exists and is callable!`);
    console.log('Result:', data);
    return true;
  } catch (err) {
    console.error('Error testing function:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * List known functions in your database by querying the pg_proc catalog
 */
async function listAvailableFunctions() {
  console.log('\nAttempting to list available functions in your database...');
  
  try {
    // Try using a basic SQL query directly
    const { data, error } = await supabase.from('pg_proc')
      .select('proname')
      .eq('pronamespace', 'public');
    
    if (error) {
      console.log('❌ Could not directly query pg_proc. This is normal as it requires special permissions.');
      
      // Try another approach - querying for function registry
      const { data: functions, error: funcError } = await supabase.from('function_registry')
        .select('name, description, location')
        .limit(10);
      
      if (funcError) {
        console.log('❌ Could not find function_registry table.');
      } else if (functions && functions.length > 0) {
        console.log('✅ Found functions in function_registry table:');
        functions.forEach(f => {
          console.log(`- ${f.name}: ${f.description}`);
        });
      } else {
        console.log('No functions found in the function_registry table.');
      }
    } else if (data && data.length > 0) {
      console.log('✅ Found functions in database:');
      data.forEach((fn: any) => {
        console.log(`- ${fn.proname}`);
      });
    } else {
      console.log('No functions found.');
    }
  } catch (err) {
    console.error('Error listing functions:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Test the application to see if it can make a simple query
 */
async function testBasicQuery() {
  console.log('\nTesting basic database query capabilities...');
  
  try {
    // Try a simple query to make sure database access works
    const { data, error } = await supabase.from('document_types')
      .select('document_type, category')
      .limit(3);
    
    if (error) {
      console.log(`❌ Basic query failed: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Basic query succeeded! Found ${data?.length || 0} document types.`);
    if (data && data.length > 0) {
      console.log('Sample data:', data);
    }
    return true;
  } catch (err) {
    console.error('Error testing basic query:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Print instructions for creating the execute_sql function
 */
function printInstructions() {
  console.log('\n=== Instructions for Adding execute_sql RPC Function ===');
  console.log(`
To add the execute_sql RPC function to your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to the "SQL Editor"
3. Create a new query
4. Paste the following SQL code:

CREATE OR REPLACE FUNCTION public.execute_sql(sql text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Execute the SQL and get the results as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing query: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.execute_sql IS 'Executes arbitrary SQL and returns results as JSONB';

5. Run the query
6. Test the function with the examples in this repository
`);
}

/**
 * Main function
 */
async function main() {
  console.log('Testing Supabase RPC capabilities...');
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  // Test basic query first
  const basicQueryWorks = await testBasicQuery();
  
  if (!basicQueryWorks) {
    console.log('❌ Cannot connect to database. Please check your credentials.');
    return;
  }
  
  // Test specific RPC functions
  await testRpcFunction('execute_sql', { sql: 'SELECT 1 as test' });
  
  // List available functions
  await listAvailableFunctions();
  
  // Print instructions for adding the execute_sql function
  printInstructions();
}

// Run the main function
main()
  .then(() => console.log('\nTests completed.'))
  .catch(err => console.error('Error running tests:', err));