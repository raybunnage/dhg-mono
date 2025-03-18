#!/usr/bin/env ts-node

/**
 * SIMPLE SCRIPT TO COUNT RECORDS IN DOCUMENTATION_FILES TABLE
 * This is a minimal script that just connects and counts records
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config as loadDotEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
console.log('======= DOCUMENTATION FILES COUNT =======');
console.log('Loading environment variables...');

// Read and log all environment variables for debugging
const readEnvFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Reading ${filePath} for debugging...`);
      const content = fs.readFileSync(filePath, 'utf8');
      const envVars = content.split('\n').filter(line => {
        // Filter out comments and empty lines
        return line.trim() && !line.trim().startsWith('#');
      });
      
      // Print each environment variable but hide sensitive values
      envVars.forEach(line => {
        if (line.includes('=')) {
          const [key, value] = line.split('=');
          if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
            console.log(`  ${key}=[REDACTED]`);
          } else {
            console.log(`  ${key}=${value}`);
          }
        }
      });
    } else {
      console.log(`${filePath} does not exist`);
    }
  } catch (error) {
    console.log(`Error reading ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Debug all env files
console.log('\n=== ENV FILES CONTENT ===');
readEnvFile(path.join(process.cwd(), '.env'));
readEnvFile(path.join(process.cwd(), '.env.local'));
readEnvFile(path.join(process.cwd(), '.env.development'));
console.log('=== END ENV FILES ===\n');

// Load the main .env file first as base
console.log('Loading from .env file...');
loadDotEnv();

// Then override with .env.local if it exists
if (fs.existsSync('.env.local')) {
  console.log('Loading from .env.local file with override...');
  loadDotEnv({ path: '.env.local', override: true });
}

// After loading, print all environment variables we're interested in
console.log('\nEnvironment variables after loading:');
console.log(`- SUPABASE_URL: ${process.env.SUPABASE_URL || 'Not set'}`);
console.log(`- CLI_SUPABASE_URL: ${process.env.CLI_SUPABASE_URL || 'Not set'}`);
console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Is set' : 'Not set'}`);
console.log(`- SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'Is set' : 'Not set'}`);

// Make sure we're using CLI_SUPABASE_URL if it exists
if (process.env.CLI_SUPABASE_URL) {
  console.log('Using CLI_SUPABASE_URL instead of SUPABASE_URL');
  process.env.SUPABASE_URL = process.env.CLI_SUPABASE_URL;
  console.log(`- SUPABASE_URL (updated): ${process.env.SUPABASE_URL}`);
}

console.log('');

async function countDocumentationFiles() {
  try {
    // ==== TRY MULTIPLE SERVICE KEYS ====
    console.log('Checking all possible service keys:');
    
    const keys = {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      CLI_SUPABASE_SERVICE_ROLE_KEY: process.env.CLI_SUPABASE_SERVICE_ROLE_KEY,
      CLI_SUPABASE_SERVICE_KEY: process.env.CLI_SUPABASE_SERVICE_KEY
    };
    
    // Log key availability (without showing values)
    Object.entries(keys).forEach(([name, value]) => {
      console.log(`- ${name}: ${value ? 'Available' : 'Not set'}`);
    });
    
    // Try to find a valid key
    let supabaseKey = keys.SUPABASE_SERVICE_ROLE_KEY;
    let keySource = 'SUPABASE_SERVICE_ROLE_KEY';
    
    if (!supabaseKey && keys.SUPABASE_SERVICE_KEY) {
      supabaseKey = keys.SUPABASE_SERVICE_KEY;
      keySource = 'SUPABASE_SERVICE_KEY';
      console.log('Using SUPABASE_SERVICE_KEY as fallback');
    }
    
    if (!supabaseKey && keys.CLI_SUPABASE_SERVICE_ROLE_KEY) {
      supabaseKey = keys.CLI_SUPABASE_SERVICE_ROLE_KEY;
      keySource = 'CLI_SUPABASE_SERVICE_ROLE_KEY';
      console.log('Using CLI_SUPABASE_SERVICE_ROLE_KEY as fallback');
    }
    
    if (!supabaseKey && keys.CLI_SUPABASE_SERVICE_KEY) {
      supabaseKey = keys.CLI_SUPABASE_SERVICE_KEY;
      keySource = 'CLI_SUPABASE_SERVICE_KEY';
      console.log('Using CLI_SUPABASE_SERVICE_KEY as fallback');
    }
    
    // Get the URL (already handled in env loading)
    const supabaseUrl = process.env.SUPABASE_URL;
    
    // Validate credentials
    if (!supabaseUrl || !supabaseKey) {
      console.error('ERROR: Missing Supabase credentials!');
      console.error(`URL: ${supabaseUrl ? 'Set' : 'MISSING'}`);
      console.error(`Service Key: ${supabaseKey ? 'Set' : 'MISSING'}`);
      process.exit(1);
    }
    
    // Verify URL format
    if (!supabaseUrl.startsWith('http')) {
      console.error('ERROR: Invalid Supabase URL format!');
      console.error(`URL value: "${supabaseUrl}"`);
      console.error('The URL should start with http:// or https://');
      process.exit(1);
    }
    
    // Final connection details
    console.log('\nFINAL CONNECTION DETAILS:');
    console.log(`- URL: ${supabaseUrl}`);
    console.log(`- Key Source: ${keySource}`);
    console.log(`- Key Length: ${supabaseKey.length} chars`);
    console.log(`- Key Preview: ${supabaseKey.substring(0, 10)}...`);
    
    // Create Supabase client
    console.log('\nCreating Supabase client...');
    
    // Try with both anon key and service role key
    let connectionSuccess = false;
    let supabase;
    
    try {
      console.log('Attempt 1: Using service role key...');
      supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test the connection
      console.log('Testing connection...');
      const { error: testError } = await supabase.from('documentation_files').select('count', { count: 'exact', head: true });
      
      if (testError) {
        console.error(`Service role key connection failed: ${testError.message}`);
        // Will try anon key next
      } else {
        console.log('Connection with service role key successful!');
        connectionSuccess = true;
      }
    } catch (error) {
      console.error('Error creating Supabase client with service role key:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Try with anon key if service key failed
    if (!connectionSuccess && process.env.SUPABASE_ANON_KEY) {
      try {
        console.log('\nAttempt 2: Trying with anon key instead...');
        supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
        
        // Test the connection
        console.log('Testing connection with anon key...');
        const { error: anonTestError } = await supabase.from('documentation_files').select('count', { count: 'exact', head: true });
        
        if (anonTestError) {
          console.error(`Anon key connection failed: ${anonTestError.message}`);
        } else {
          console.log('Connection with anon key successful!');
          connectionSuccess = true;
        }
      } catch (error) {
        console.error('Error creating Supabase client with anon key:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // If all connection attempts failed, exit
    if (!connectionSuccess || !supabase) {
      console.error('\nFATAL ERROR: All connection attempts failed!');
      console.error('Please check your Supabase URL and keys.');
      process.exit(1);
    }
    
    console.log('\n✅ Connected to Supabase successfully!');
    
    // Try table access
    try {
      // JUST GET THE COUNT of records in documentation_files
      console.log('Counting records in documentation_files table...');
      const { count, error } = await supabase
        .from('documentation_files')
        .select('*', { count: 'exact', head: true });
  
      if (error) {
        console.error(`Error counting records: ${error.message}`);
        
        // Try a different table to see if it's specific to documentation_files
        console.log('\nTrying to access a different table to verify database access...');
        const { error: otherError } = await supabase
          .from('document_types')
          .select('*', { count: 'exact', head: true });
          
        if (otherError) {
          console.error(`Error accessing document_types: ${otherError.message}`);
          console.error('Database access appears to be completely broken.');
        } else {
          console.error('document_types table is accessible, but documentation_files is not.');
          console.error('This suggests documentation_files table might not exist or have permission issues.');
        }
        
        process.exit(1);
      }
  
      console.log('----------------------------------------');
      console.log(`✅ RECORDS FOUND IN DOCUMENTATION_FILES: ${count}`);
      console.log('----------------------------------------');
  
      // Success! Now if we have records, let's just get one to verify the columns
      if (count && count > 0) {
        console.log('Fetching first record to verify structure...');
        const { data, error: recordError } = await supabase
          .from('documentation_files')
          .select('*')
          .limit(1)
          .single();
  
        if (recordError) {
          console.error(`Error fetching sample record: ${recordError.message}`);
        } else if (data) {
          console.log('Sample record columns:');
          Object.keys(data).forEach(key => {
            const value = data[key];
            console.log(`- ${key}: ${typeof value} ${value ? '(has value)' : '(empty)'}`);
          });
          
          // Specifically check for file_path
          if ('file_path' in data) {
            console.log(`\n✅ FILE_PATH COLUMN EXISTS: ${data.file_path ? data.file_path : 'Empty value'}`);
          } else {
            console.log('\n❌ FILE_PATH COLUMN MISSING!');
          }
        }
      }
    } catch (dbError) {
      console.error('Unexpected database error:', dbError instanceof Error ? dbError.message : 'Unknown error');
      process.exit(1);
    }

  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the function
countDocumentationFiles()
  .then(() => console.log('Done!'))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });