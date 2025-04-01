import { createClient } from '@supabase/supabase-js';
import { config as loadDotEnv } from 'dotenv';

// Load environment variables
loadDotEnv({ path: '.env.local' });
loadDotEnv({ path: '.env.development' });

/**
 * Simple script to refresh the Supabase schema cache
 */
async function refreshSchemaCache() {
  try {
    console.log('Refreshing Supabase schema cache...');
    
    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
      process.exit(1);
    }
    
    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Execute the pg_notify function to reload the schema
    console.log('Executing pg_notify command to reload schema...');
    try {
      const { data, error } = await supabase.rpc('pg_notify', { 
        channel: 'pgrst',
        payload: 'reload schema'
      });
      
      if (error) {
        console.error('Error executing pg_notify RPC:', error);
      } else {
        console.log('Schema cache refresh request sent successfully');
      }
    } catch (error) {
      console.error('Error with pg_notify RPC:', error);
    }
    
    // Wait a moment for the cache to refresh
    console.log('Waiting 3 seconds for cache to refresh...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Validate the cache by querying a documentation_files record
    console.log('Testing documentation_files query...');
    const { data, error } = await supabase
      .from('documentation_files')
      .select('id, file_path, metadata')
      .limit(1);
      
    if (error) {
      console.error('Error testing documentation_files query:', error);
    } else {
      console.log('Successfully queried documentation_files table');
      console.log(`Found ${data.length} records`);
      
      if (data && data.length > 0) {
        console.log('Sample record metadata:', data[0].metadata);
      }
    }
    
    console.log('Schema cache refresh process complete');
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the function
refreshSchemaCache();