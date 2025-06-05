import { getSupabaseClient } from './packages/cli/src/services/supabase-client';
import fs from 'fs';

async function addFileColumn() {
  console.log('Adding file_size column to documentation_files table...');
  
  const supabase = getSupabaseClient(true);
  
  try {
    // Read SQL file
    const sql = fs.readFileSync('./add-file-size-column.sql', 'utf8');
    console.log('Loaded SQL:', sql);
    
    // For Supabase cloud, the most reliable way is to use the psql command directly
    console.log('To run this SQL directly, copy this command:');
    console.log('----------------------------------------');
    console.log(`psql "${process.env.SUPABASE_DB_URL}" -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
    console.log('----------------------------------------');
    
    // Try to run using RPC - this might work if the function exists
    console.log('Attempting to run SQL through RPC...');
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error('Error running SQL through RPC:', error);
      } else {
        console.log('SQL executed successfully through RPC');
        return;
      }
    } catch (e) {
      console.error('RPC method failed:', e);
    }
    
    console.log('Falling back to REST API...');
    
    // Get access token - needed for some admin operations
    const authHeaders = {};
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      authHeaders['Authorization'] = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
      authHeaders['apikey'] = process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    
    // Try REST API for SQL execution if available
    try {
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ query: sql })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('REST API error:', response.status, errorData);
      } else {
        console.log('SQL executed successfully through REST API');
      }
    } catch (e) {
      console.error('REST API method failed:', e);
    }
    
    console.log('Please use one of these methods to manually apply the SQL:');
    console.log('1. Run the psql command shown above');
    console.log('2. Copy the SQL and run it in the Supabase dashboard SQL editor');
    console.log('3. Apply the migration file using supabase db apply');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

addFileColumn();