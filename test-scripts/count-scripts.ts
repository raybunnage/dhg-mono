/**
 * Count Scripts
 * 
 * Simple script to count the number of records in the scripts table
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load environment variables
function loadEnv() {
  const rootDir = path.resolve(__dirname, '../');
  
  // Try loading from multiple env files
  const envFiles = [
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env.development')
  ];
  
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`Loading environment from ${file}`);
      dotenv.config({ path: file });
    }
  });
}

// Initialize Supabase client
function initSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase URL or key. Check your environment variables.');
  }
  
  return createClient(url, key);
}

async function countScripts() {
  console.log('Counting records in scripts table...');
  
  // Load environment variables
  loadEnv();
  
  // Initialize Supabase client
  const supabase = initSupabase();
  
  // Count records in the scripts table
  const { count, error } = await supabase
    .from('scripts')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error counting records:', error);
    process.exit(1);
  }
  
  console.log(`Total records in scripts table: ${count}`);
  
  // Check if we have at least 133 records
  if (count && count >= 133) {
    console.log('✅ Verification PASSED: At least 133 records found');
  } else {
    console.log(`❌ Verification FAILED: Expected at least 133 records, found ${count || 0}`);
  }
}

// Run the script
countScripts()
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });