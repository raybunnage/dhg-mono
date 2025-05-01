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

console.log(`Testing connection to Supabase...`);

// Try to require SupabaseClientService first
let SupabaseClientService;
try {
  // Try different paths to find the client service
  const paths = [
    '../../../packages/shared/services/supabase-client',
    '../../packages/shared/services/supabase-client',
    '../packages/shared/services/supabase-client',
    './packages/shared/services/supabase-client'
  ];
  
  for (const servicePath of paths) {
    try {
      SupabaseClientService = require(servicePath).SupabaseClientService;
      console.log(`✅ Found SupabaseClientService at: ${servicePath}`);
      break;
    } catch (e) {
      // Continue trying other paths
    }
  }
  
  if (!SupabaseClientService) {
    throw new Error('SupabaseClientService not found in any expected paths');
  }
} catch (err) {
  console.warn('⚠️ Could not load SupabaseClientService:', err.message);
  console.log('Falling back to direct client creation...');
  
  // Use direct client as fallback
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, key);
  
  // Simple connection test with direct client
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
  
  return;
}

// Use the SupabaseClientService for the connection test
(async () => {
  try {
    // Get singleton instance
    const supabaseService = SupabaseClientService.getInstance();
    
    // Test the connection
    const connectionResult = await supabaseService.testConnection();
    
    if (!connectionResult.success) {
      console.error('❌ Connection test failed:', connectionResult.error);
      process.exit(1);
    }
    
    // Get the client and test a simple query
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('scripts')
      .select('count', { count: 'exact', head: true });
      
    if (error) {
      console.error('❌ Query test failed:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Connection successful! Ready to use Supabase.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error during connection test:', err.message);
    process.exit(1);
  }
})();
