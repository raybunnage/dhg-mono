#!/usr/bin/env ts-node
/**
 * Direct Fetch Test for Supabase
 * 
 * This script tests the most basic direct fetch to Supabase
 * without any libraries or services.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

async function testDirectFetch() {
  console.log('=== Testing Direct Fetch to Supabase ===');
  
  // Load environment variables directly from .env.development
  const envPath = path.resolve(process.cwd(), '.env.development');
  console.log(`Loading environment directly from: ${envPath}`);
  
  // Read the file contents directly
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('Environment file loaded successfully');
  
  // Parse the .env file manually to avoid any potential issues with dotenv
  const envVars: Record<string, string> = {};
  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) return;
    
    // Parse key/value pairs
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key.trim()] = value.trim();
    }
  });
  
  // Get Supabase URL and keys
  const supabaseUrl = envVars['SUPABASE_URL'];
  const supabaseAnonKey = envVars['SUPABASE_ANON_KEY'];
  const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
  
  // Print masked keys
  console.log(`Found Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'missing'}`);
  console.log(`ANON Key: ${supabaseAnonKey ? 
    `${supabaseAnonKey.substring(0, 5)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 5)} (${supabaseAnonKey.length} chars)` : 
    'missing'}`);
  console.log(`SERVICE Key: ${supabaseServiceKey ? 
    `${supabaseServiceKey.substring(0, 5)}...${supabaseServiceKey.substring(supabaseServiceKey.length - 5)} (${supabaseServiceKey.length} chars)` : 
    'missing'}`);
  
  // Try ANON key
  if (supabaseUrl && supabaseAnonKey) {
    console.log('\n=== Testing with ANON Key ===');
    
    // Try a simple count query
    const url = `${supabaseUrl}/rest/v1/sources_google?select=count`;
    console.log(`Making request to: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      // Log all headers
      console.log('Response headers:');
      response.headers.forEach((value, name) => {
        console.log(`${name}: ${value}`);
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Success! Data:', data);
      } else {
        console.error('❌ Request failed');
        try {
          const errorText = await response.text();
          console.error('Error body:', errorText);
        } catch (e) {
          console.error('Could not read error body');
        }
      }
    } catch (error: any) {
      console.error('Fetch error:', error.message);
    }
  }
  
  // Try SERVICE ROLE key
  if (supabaseUrl && supabaseServiceKey) {
    console.log('\n=== Testing with SERVICE ROLE Key ===');
    
    // Try a simple count query
    const url = `${supabaseUrl}/rest/v1/sources_google?select=count`;
    console.log(`Making request to: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      // Log all headers
      console.log('Response headers:');
      response.headers.forEach((value, name) => {
        console.log(`${name}: ${value}`);
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Success! Data:', data);
      } else {
        console.error('❌ Request failed');
        try {
          const errorText = await response.text();
          console.error('Error body:', errorText);
        } catch (e) {
          console.error('Could not read error body');
        }
      }
    } catch (error: any) {
      console.error('Fetch error:', error.message);
    }
  }
  
  // Final summary
  console.log('\n=== Summary ===');
  console.log(`
If you're still seeing 401 Unauthorized errors for both keys:
1. The API keys may be invalid or expired - try generating new ones in the Supabase dashboard
2. There may be an issue with the authorization headers - double-check their format
3. Your IP address might be blocked - try from a different network
4. The project might be paused or disabled - check the Supabase dashboard
5. There might be a regional issue - try a different location or VPN
  `);
}

// Run the test
testDirectFetch().catch(console.error);