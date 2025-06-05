#!/usr/bin/env ts-node
/**
 * Test the Supabase client service
 * 
 * This uses the singleton SupabaseClientService directly with a simpler approach
 * that has been proven to work in the minimal test.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function testClientService() {
  console.log('=== Testing Supabase Client Service ===');
  
  try {
    // Get environment variables directly, since we know this approach works
    const envPath = path.resolve(process.cwd(), '.env.development');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract URL and SERVICE_ROLE key
    const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
    const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    
    if (!urlMatch || !serviceKeyMatch) {
      console.error('Missing required Supabase credentials in .env.development');
      return;
    }
    
    const supabaseUrl = urlMatch[1].trim();
    const supabaseKey = serviceKeyMatch[1].trim();
    
    console.log(`Using URL: ${supabaseUrl.substring(0, 15)}...`);
    console.log(`Using SERVICE KEY: ${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}`);
    
    // Create the client directly
    console.log('\nCreating client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try a simple query
    console.log('\n--- Querying document_types table ---');
    const { data, error } = await supabase
      .from('document_types')
      .select('document_type, category')
      .eq('category', 'Documentation')
      .limit(5);
    
    if (error) {
      console.error('❌ Error querying document_types:', error.message);
      console.error('Error details:', error);
    } else {
      console.log(`✅ Query successful! Found ${data.length} document types:`);
      console.table(data);
    }
    
    // Try another query
    console.log('\n--- Querying sources_google table ---');
    const { data: filesData, error: filesError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .is('document_type_id', null)
      .is('is_deleted', false)
      .limit(5);
    
    if (filesError) {
      console.error('❌ Error querying sources_google:', filesError.message);
    } else {
      console.log(`✅ Query successful! Found ${filesData.length} files:`);
      console.table(filesData);
    }
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Run the test
testClientService().catch(console.error);