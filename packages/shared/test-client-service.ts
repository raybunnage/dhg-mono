#!/usr/bin/env ts-node
/**
 * Test the fixed SupabaseClientService
 * 
 * This tests the fixed SupabaseClientService which should now work
 * with the new Supabase API keys.
 */

import { SupabaseClientService } from './services/supabase-client';

async function testClientService() {
  console.log('=== Testing Fixed SupabaseClientService ===');
  
  try {
    // Get the singleton service
    const supabaseService = SupabaseClientService.getInstance();
    console.log('Supabase service initialized');
    
    // Get the client
    const supabase = supabaseService.getClient();
    console.log('Client initialized');
    
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
      .from('sources_google')
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
    
    // Test the connection test method
    console.log('\n--- Testing connection test method ---');
    const connectionTest = await supabaseService.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ Connection test successful!');
    } else {
      console.error('❌ Connection test failed:', connectionTest.error);
      if (connectionTest.details) {
        console.error('Details:', connectionTest.details);
      }
    }
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Run the test
testClientService().catch(console.error);