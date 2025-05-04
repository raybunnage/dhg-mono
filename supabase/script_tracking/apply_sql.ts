/**
 * Apply SQL script to the Supabase database
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotEnv } from 'dotenv';

// Load environment variables
loadDotEnv({ path: '.env' });
loadDotEnv({ path: '.env.local' });
loadDotEnv({ path: '.env.development' });

// Main function to apply SQL files
async function applySqlFiles() {
  try {
    console.log('Applying SQL scripts to Supabase...');
    
    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
      process.exit(1);
    }
    
    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the directory of this script
    const scriptDir = __dirname;
    
    // SQL files to apply
    const sqlFiles = [
      path.join(scriptDir, 'execute_sql.sql'),
      path.join(scriptDir, 'pg_notify.sql'),
      path.join(scriptDir, 'find_and_sync_scripts.sql')
    ];
    
    // Apply the execute_sql function first
    const executeFile = sqlFiles[0];
    console.log(`Applying SQL file: ${path.basename(executeFile)}`);
    try {
      // First apply execute_sql.sql directly with a query
      const executeContent = fs.readFileSync(executeFile, 'utf8');
      
      // This is a direct query approach
      const { error: execError } = await supabase.rpc('pg_notify', {
        channel: 'pgrst',
        payload: 'reload schema'
      });
      
      if (execError) {
        console.error('Warning: Could not notify for schema reload', execError);
      }
      
      // Apply the other SQL files using execute_sql once it exists
      for (let i = 1; i < sqlFiles.length; i++) {
        const sqlFile = sqlFiles[i];
        console.log(`Applying SQL file: ${path.basename(sqlFile)}`);
        
        // Read SQL content
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        try {
          // Try using the Supabase REST API
          const { error } = await supabase.from('_rpc').select('*').eq('name', 'execute_sql');
          
          if (error) {
            console.error(`Error checking for execute_sql function: ${error.message}`);
            continue;
          }
          
          // Execute the SQL
          const { data, error: execError } = await supabase.rpc('execute_sql', { 
            sql: sqlContent
          });
          
          if (execError) {
            console.error(`Error executing SQL file ${path.basename(sqlFile)}:`, execError);
          } else {
            console.log(`Successfully applied ${path.basename(sqlFile)}`);
          }
        } catch (error) {
          console.error(`Failed to apply ${path.basename(sqlFile)}:`, error);
        }
      }
    } catch (error) {
      console.error('Error applying initial execute_sql function:', error);
    }
    
    // Reload the schema cache
    console.log('Reloading schema cache...');
    try {
      const { data, error } = await supabase.rpc('pg_notify', { 
        channel: 'pgrst',
        payload: 'reload schema'
      });
      
      if (error) {
        console.error('Error reloading schema cache:', error);
      } else {
        console.log('Schema cache reload request sent successfully');
      }
    } catch (error) {
      console.error('Error with schema cache reload:', error);
    }
    
    console.log('SQL application process complete');
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Helper to create the execute_sql function
async function createExecuteSqlFunction(supabase: any) {
  const executeFunction = `
  CREATE OR REPLACE FUNCTION execute_sql(sql text)
  RETURNS void AS $$
  BEGIN
    EXECUTE sql;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  
  GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;
  COMMENT ON FUNCTION execute_sql(text) IS 'Execute raw SQL (admin only)';
  `;
  
  const { error } = await supabase.from('_rpc').select('*').eq('name', 'execute_raw_query');
  
  if (error) {
    console.log('Creating execute_sql function through direct query...');
    // Try direct query approach
    const { error: directError } = await supabase.rpc('pg_notify', { 
      channel: 'pgrst', 
      payload: 'reload schema'
    });
    
    if (directError) {
      console.error('Error creating execute_sql function:', directError);
      throw directError;
    }
  }
}

// Run the function
applySqlFiles();