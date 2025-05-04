// This script helps debug database query issues by tracing exactly what happens
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
  process.exit(1);
}

console.log('Debug: Creating Supabase client...');
console.log(`URL: ${supabaseUrl.substring(0, 12)}...`);
console.log(`Key: ${supabaseKey.substring(0, 5)}...`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueryExecution() {
  console.log('\n=== Testing Query Execution ===');
  try {
    // First, get a sample script ID
    console.log('Step 1: Fetching a sample script ID...');
    const { data: scriptsData, error: scriptsError } = await supabase
      .from('scripts')
      .select('id')
      .limit(1)
      .single();
      
    if (scriptsError) {
      console.error('Error fetching scripts:', scriptsError);
      return;
    }
    
    if (!scriptsData || !scriptsData.id) {
      console.log('No scripts found in the database.');
      return;
    }
    
    const scriptId = scriptsData.id;
    console.log(`Found sample script ID: ${scriptId}`);
    
    // Execute using different methods
    
    // 1. Direct table query
    console.log('\nMethod 1: Direct table query');
    const queryText1 = `SELECT metadata FROM scripts WHERE id = '${scriptId}'`;
    console.log(`Query: ${queryText1}`);
    
    try {
      const { data: data1, error: error1 } = await supabase
        .from('scripts')
        .select('metadata')
        .eq('id', scriptId)
        .single();
        
      if (error1) {
        console.error('Direct query error:', error1);
      } else {
        console.log('Direct query result:', JSON.stringify(data1, null, 2));
      }
    } catch (err) {
      console.error('Exception in direct query:', err);
    }
    
    // 2. Execute SQL RPC
    console.log('\nMethod 2: execute_sql RPC');
    const queryText2 = `SELECT metadata FROM scripts WHERE id = '${scriptId}'`;
    console.log(`Query: ${queryText2}`);
    
    try {
      const { data: data2, error: error2 } = await supabase
        .rpc('execute_sql', { sql: queryText2 });
        
      if (error2) {
        console.error('RPC error:', error2);
      } else {
        console.log('RPC result:', JSON.stringify(data2, null, 2));
      }
    } catch (err) {
      console.error('Exception in RPC:', err);
    }
    
    // 3. SQL with parameter placeholder
    console.log('\nMethod 3: SQL with parameter replacement');
    const queryText3 = `SELECT metadata FROM scripts WHERE id = :script_id`;
    console.log(`Original query: ${queryText3}`);
    
    const modifiedQuery = queryText3.replace(/:script_id/g, `'${scriptId}'`);
    console.log(`Modified query: ${modifiedQuery}`);
    
    try {
      const { data: data3, error: error3 } = await supabase
        .rpc('execute_sql', { sql: modifiedQuery });
        
      if (error3) {
        console.error('Parameter replacement error:', error3);
      } else {
        console.log('Parameter replacement result:', JSON.stringify(data3, null, 2));
      }
    } catch (err) {
      console.error('Exception in parameter replacement:', err);
    }
    
    // 4. Buggy example - try without quotes
    console.log('\nMethod 4: SQL with parameter replacement but no quotes');
    const queryText4 = `SELECT metadata FROM scripts WHERE id = :script_id`;
    console.log(`Original query: ${queryText4}`);
    
    const badModifiedQuery = queryText4.replace(/:script_id/g, scriptId); // No quotes!
    console.log(`Bad modified query: ${badModifiedQuery}`);
    
    try {
      const { data: data4, error: error4 } = await supabase
        .rpc('execute_sql', { sql: badModifiedQuery });
        
      if (error4) {
        console.error('Bad parameter replacement error:', error4);
      } else {
        console.log('Bad parameter replacement result:', JSON.stringify(data4, null, 2));
      }
    } catch (err) {
      console.error('Exception in bad parameter replacement:', err);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testQueryExecution()
  .then(() => console.log('\nTest completed.'))
  .catch(err => console.error('Fatal error:', err));