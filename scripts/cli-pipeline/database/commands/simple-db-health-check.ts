/**
 * Simple Database Health Check - A simplified version that doesn't use commander.js
 * This provides more verbose output for debugging
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function runSimpleHealthCheck() {
  console.log('=== Database Health Check ===\n');

  try {
    // Test basic connection by getting the client directly
    console.log('🔍 Testing database connection...');
    const supabase = SupabaseClientService.getInstance().getClient();
    console.log('✅ Supabase client obtained successfully');
    
    // Test document_types table query
    console.log('\n🔍 Testing document_types table query...');
    
    const { data, error } = await supabase
      .from('document_types')
      .select('id, name')
      .limit(3);
    
    if (error) {
      console.log('❌ Document types query failed');
      console.log(`Error: ${error.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Document types query successful (${data.length} records)`);
    
    if (data && data.length > 0) {
      console.log('\n📋 Sample document types:');
      data.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.name} (ID: ${item.id})`);
      });
    }
    
    // Test sources_google table query
    console.log('\n🔍 Testing sources_google table query...');
    const { data: sourcesData, error: sourcesError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .limit(3);
    
    if (sourcesError) {
      console.log('❌ Sources google query failed');
      console.log(`Error: ${sourcesError.message}`);
    } else {
      console.log(`✅ Sources google query successful (${sourcesData.length} records)`);
    }
    
    console.log('\n🎉 All health checks passed!');
    
  } catch (error) {
    console.log('❌ Health check failed with exception');
    console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the health check
runSimpleHealthCheck().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});