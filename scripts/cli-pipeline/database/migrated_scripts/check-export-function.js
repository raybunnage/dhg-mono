#!/usr/bin/env node
/**
 * Check Export Function
 * 
 * This script checks if the export_all_functions_to_json function is installed in the database.
 * 
 * Usage:
 *   node check-export-function.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Suppress Node.js warnings about Punycode deprecation
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('Punycode')) {
    // Ignore Punycode deprecation warnings
    return;
  }
  // Log all other warnings
  console.warn(warning.name, warning.message);
});

// Try to load environment variables from multiple locations
function loadEnvVariables() {
  // First try root .env
  require('dotenv').config();
  
  // Then try app-specific .env files if needed
  const appEnvPaths = [
    path.join(__dirname, '..', 'apps', 'dhg-improve-experts', '.env'),
    path.join(__dirname, '..', 'apps', 'dhg-hub-lovable', '.env'),
    path.join(__dirname, '..', 'apps', 'dhg-a', '.env'),
    path.join(__dirname, '..', 'apps', 'dhg-b', '.env')
  ];
  
  // Only load app env if we don't have the variables yet
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    for (const envPath of appEnvPaths) {
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
          console.log(`Loaded environment variables from ${envPath}`);
          break;
        }
      }
    }
  }
}

// Load environment variables
loadEnvVariables();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set in .env file');
  console.error('Please add these variables to one of the following files:');
  console.error('  - /Users/raybunnage/Documents/github/dhg-mono/.env (root .env)');
  console.error('  - /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/.env');
  console.error('  - /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-hub-lovable/.env');
  console.error('  - Or any other app .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExportFunction() {
  try {
    console.log('Checking if export_all_functions_to_json function is installed...');
    
    // Query to check if the function exists
    const { data, error } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'export_all_functions_to_json')
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Table doesn't exist or not accessible
        console.log('Cannot directly check for function existence due to permissions.');
        console.log('Trying to call the function instead...');
        
        // Try to call the function
        const { data: funcData, error: funcError } = await supabase.rpc('export_all_functions_to_json');
        
        if (funcError) {
          console.error('Error: The export_all_functions_to_json function is not installed or accessible.');
          console.error('You need to run the migration to install it:');
          console.error('  pnpm db:migrate');
          return false;
        } else {
          console.log('Success! The export_all_functions_to_json function is installed and working.');
          return true;
        }
      } else {
        console.error('Error checking function existence:', error);
        return false;
      }
    }
    
    if (data) {
      console.log('Success! The export_all_functions_to_json function is installed.');
      return true;
    } else {
      console.error('Error: The export_all_functions_to_json function is not installed.');
      console.error('You need to run the migration to install it:');
      console.error('  pnpm db:migrate');
      return false;
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    return false;
  }
}

// Run the check
checkExportFunction(); 