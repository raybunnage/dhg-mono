#!/usr/bin/env node
/**
 * verify-supabase-deps.js - Ensures Supabase dependencies are available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if Supabase is installed
let hasSupabase = false;
try {
  require.resolve('@supabase/supabase-js');
  hasSupabase = true;
  console.log('✅ @supabase/supabase-js is already installed');
} catch (e) {
  console.log('⚠️ @supabase/supabase-js is not installed');
}

// Install it if needed
if (!hasSupabase) {
  console.log('Installing @supabase/supabase-js...');
  try {
    execSync('npm install --no-save @supabase/supabase-js', { stdio: 'inherit' });
    console.log('✅ Successfully installed @supabase/supabase-js');
  } catch (err) {
    console.error('❌ Failed to install @supabase/supabase-js:', err.message);
    process.exit(1);
  }
}

// Now run a simple connection test if URL and key are available
const url = process.env.SUPABASE_URL || 
            process.env.CLI_SUPABASE_URL || 
            process.env.VITE_SUPABASE_URL;

const key = process.env.SUPABASE_KEY || 
            process.env.CLI_SUPABASE_KEY || 
            process.env.SUPABASE_SERVICE_ROLE_KEY || 
            process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('⚠️ Supabase credentials not found in environment variables');
  console.log('Run source ./scripts/run-with-supabase.sh to set them');
  process.exit(0);
}

console.log(`Testing connection to Supabase at ${url}`);
console.log(`Using key with length: ${key.length} characters`);

// Try a simple connection test
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

// Simple connection test
(async () => {
  try {
    const { data, error, status } = await supabase
      .from('scripts')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      console.log('Status:', status);
      process.exit(1);
    }
    
    console.log('✅ Connection successful! Ready to use Supabase.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error during connection test:', err.message);
    process.exit(1);
  }
})();
