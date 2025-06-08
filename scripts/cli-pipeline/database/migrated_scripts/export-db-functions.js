#!/usr/bin/env node
/**
 * Export Database Functions
 * 
 * This script exports all PostgreSQL functions from the database to a JSON file.
 * It requires the export_all_functions_to_json() function to be installed in the database.
 * 
 * Usage:
 *   node export-db-functions.js [output-path]
 * 
 * Example:
 *   node export-db-functions.js ../supabase/functions.json
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

// Get output path from command line or use default
const outputPath = process.argv[2] || path.join(__dirname, '..', 'supabase', 'functions.json');

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

async function exportFunctions() {
  try {
    console.log('Fetching database functions...');
    
    // Call the function to get all functions as JSON
    const { data, error } = await supabase.rpc('export_all_functions_to_json');
    
    if (error) {
      console.error('Error fetching functions:', error);
      console.error('Make sure the export_all_functions_to_json() function is installed in your database.');
      console.error('You can install it by running the migration: 20250615000000_create_export_functions_utility.sql');
      return;
    }
    
    // Format the JSON with indentation for readability
    const formattedJson = JSON.stringify(data, null, 2);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the JSON to a file
    fs.writeFileSync(outputPath, formattedJson);
    
    const functionCount = Array.isArray(data) ? data.length : 'unknown number of';
    console.log(`Successfully exported ${functionCount} functions to ${outputPath}`);
    
    // Verify the file was created and has content
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const fileSizeKB = Math.round(stats.size / 1024);
      console.log(`Output file created: ${outputPath} (${fileSizeKB} KB)`);
      
      // Check if the file has meaningful content
      if (stats.size < 10) {
        console.warn('Warning: Output file is very small, it may not contain valid data.');
      } else {
        console.log('File verification successful. The export completed successfully.');
      }
    } else {
      console.error('Error: Failed to create output file.');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the export
exportFunctions(); 