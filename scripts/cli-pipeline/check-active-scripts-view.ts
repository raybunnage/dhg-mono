/**
 * Simple script to check if active_scripts_view exists in the database
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`Loading environment from ${file}`);
    dotenv.config({ path: file });
  }
});

async function checkView() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or key. Please check your environment variables.');
    process.exit(1);
  }
  
  console.log('Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check if view exists by querying it
    console.log('Checking if active_scripts_view exists...');
    const { data, error } = await supabase
      .from('active_scripts_view')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying active_scripts_view:', error);
      console.log('The view likely does not exist or has errors.');
    } else {
      console.log('Success! active_scripts_view exists in the database.');
      console.log('Sample data:', data);
    }
    
    // Try to get view definition using system tables
    console.log('\nAttempting to get view definition...');
    const { data: viewDef, error: viewDefError } = await supabase.rpc(
      'execute_sql', 
      { 
        sql: `
          SELECT table_name, view_definition
          FROM information_schema.views
          WHERE table_schema = 'public'
          AND table_name = 'active_scripts_view';
        `
      }
    );
    
    if (viewDefError) {
      console.error('Error getting view definition:', viewDefError);
    } else {
      console.log('View definition results:', viewDef);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkView().catch(console.error);