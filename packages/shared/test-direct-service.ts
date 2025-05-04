#!/usr/bin/env ts-node
/**
 * Test the Direct Supabase Service
 * 
 * This script tests the direct Supabase service using fetch API
 * instead of the Supabase client library.
 */

import { supabaseDirect } from './services/supabase-direct-service';

async function testDirectService() {
  console.log('=== Testing Direct Supabase Service ===');
  
  // Enable debug mode
  supabaseDirect.enableDebug(true);
  
  // Initialize the service
  supabaseDirect.initialize();
  
  try {
    // Test connection
    console.log('\n--- Testing connection ---');
    const connectionTest = await supabaseDirect.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ Connection test successful!');
      
      // Get documents needing classification
      console.log('\n--- Finding files needing classification ---');
      const docs = await supabaseDirect.getDocumentsNeedingClassification(5);
      
      if (docs.error) {
        console.error('❌ Error getting documents:', docs.error.message);
      } else if (!docs.data || docs.data.length === 0) {
        console.log('No documents found that need classification');
      } else {
        console.log(`✅ Found ${docs.data.length} documents needing classification:`);
        console.table(docs.data.map(file => ({
          id: file.id ? file.id.substring(0, 8) + '...' : 'N/A',
          name: file.name ? (file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name) : 'N/A',
          mime_type: file.mime_type || 'N/A',
          path: file.path ? (file.path.length > 30 ? file.path.substring(0, 30) + '...' : file.path) : 'N/A'
        })));
      }
    } else {
      console.error('❌ Connection test failed:', connectionTest.error);
    }
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Run the test
testDirectService().catch(console.error);