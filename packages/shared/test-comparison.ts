#!/usr/bin/env ts-node
/**
 * Compare different Supabase client approaches
 * 
 * This script compares different approaches to connecting to Supabase
 * to help identify why the client library isn't working with the new API keys.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from './services/supabase-client';

async function compareApproaches() {
  console.log('=== Comparing Different Supabase Connection Approaches ===');
  
  // Get credentials from env file directly
  const envPath = path.resolve(process.cwd(), '.env.development');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Extract URL and keys
  const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
  const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  const anonKeyMatch = envContent.match(/SUPABASE_ANON_KEY=(.+)/);
  
  const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
  const serviceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : '';
  const anonKey = anonKeyMatch ? anonKeyMatch[1].trim() : '';
  
  console.log(`URL: ${supabaseUrl.substring(0, 15)}...`);
  console.log(`SERVICE KEY: ${serviceKey.substring(0, 5)}...${serviceKey.substring(serviceKey.length - 5)}`);
  console.log(`ANON KEY: ${anonKey.substring(0, 5)}...${anonKey.substring(anonKey.length - 5)}`);
  
  // Approach 1: Direct fetch (already proven to work)
  console.log('\n=== Approach 1: Direct fetch ===');
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/document_types?select=document_type&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Direct fetch successful!');
      console.log('Response:', data);
      
      // Show headers for debugging
      console.log('Headers sent:');
      console.log({
        'apikey': `${serviceKey.substring(0, 5)}...`,
        'Authorization': `Bearer ${serviceKey.substring(0, 5)}...`
      });
    } else {
      console.error(`❌ Direct fetch failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error with direct fetch:', error);
  }
  
  // Approach 2: Simple client library
  console.log('\n=== Approach 2: Simple client library ===');
  try {
    const simpleClient = createClient(supabaseUrl, serviceKey);
    
    const { data, error } = await simpleClient
      .from('document_types')
      .select('document_type')
      .limit(1);
    
    if (error) {
      console.error('❌ Simple client failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Simple client successful!');
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('Error with simple client:', error);
  }
  
  // Approach 3: SupabaseClientService
  console.log('\n=== Approach 3: SupabaseClientService ===');
  try {
    const supabaseService = SupabaseClientService.getInstance();
    const client = supabaseService.getClient();
    
    const { data, error } = await client
      .from('document_types')
      .select('document_type')
      .limit(1);
    
    if (error) {
      console.error('❌ SupabaseClientService failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ SupabaseClientService successful!');
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('Error with SupabaseClientService:', error);
  }
  
  // Final comparison summary
  console.log('\n=== Summary ===');
  console.log('If direct fetch works but the client library doesn\'t, the issue is likely with:');
  console.log('1. How the client library formats authentication headers');
  console.log('2. Special characters in the API key that need handling');
  console.log('3. A mismatch between the client library version and the Supabase API version');
}

// Run the comparison
compareApproaches().catch(console.error);