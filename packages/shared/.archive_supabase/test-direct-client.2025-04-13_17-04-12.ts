#!/usr/bin/env ts-node
/**
 * Simple Supabase Client Test
 * 
 * This test creates a Supabase client with minimal configuration 
 * to see if we can get it working with the new API keys.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

async function testMinimalClient() {
  console.log('=== Testing Minimal Supabase Client ===');
  
  // Get environment variables directly
  const envPath = path.resolve(process.cwd(), '.env.development');
  if (!fs.existsSync(envPath)) {
    console.error('Environment file not found!');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Extract URL and keys
  const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
  const anonMatch = envContent.match(/SUPABASE_ANON_KEY=(.+)/);
  const serviceMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  
  if (!urlMatch || (!anonMatch && !serviceMatch)) {
    console.error('Missing required Supabase credentials in environment file');
    return;
  }
  
  const supabaseUrl = urlMatch[1].trim();
  const anonKey = anonMatch ? anonMatch[1].trim() : '';
  const serviceKey = serviceMatch ? serviceMatch[1].trim() : '';
  
  console.log(`URL: ${supabaseUrl.substring(0, 15)}...`);
  console.log(`ANON Key: ${anonKey.substring(0, 5)}...${anonKey.substring(anonKey.length - 5)}`);
  console.log(`SERVICE Key: ${serviceKey.substring(0, 5)}...${serviceKey.substring(serviceKey.length - 5)}`);
  
  // Test with ANON key
  console.log('\n=== Testing with ANON Key ===');
  await testWithKey(supabaseUrl, anonKey);
  
  // Test with SERVICE key
  console.log('\n=== Testing with SERVICE Key ===');
  await testWithKey(supabaseUrl, serviceKey);
}

async function testWithKey(url: string, key: string) {
  try {
    // Create client with minimal configuration
    console.log('Creating client...');
    const client = createClient(url, key);
    
    // Try a simple query
    console.log('Testing query...');
    const { data, error } = await client
      .from('document_types')
      .select('document_type')
      .limit(3);
    
    if (error) {
      console.error('❌ Query failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Query successful!');
      console.table(data);
    }
    
    // Try direct fetch for comparison
    console.log('\nTesting with direct fetch for comparison...');
    const response = await fetch(`${url}/rest/v1/document_types?select=document_type&limit=3`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const fetchData = await response.json();
      console.log('✅ Direct fetch successful!');
      console.table(fetchData);
      
      // Debug headers used by the client library
      console.log('\nFor debugging, here are the actual headers used by the client library:');
      // @ts-ignore - This is for debugging purposes
      const clientHeaders = client.rest.headers;
      console.log(clientHeaders);
    } else {
      console.error(`❌ Direct fetch failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the test
testMinimalClient().catch(console.error);