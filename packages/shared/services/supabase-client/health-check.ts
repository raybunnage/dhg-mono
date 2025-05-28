#!/usr/bin/env ts-node
/**
 * Supabase health check utility
 * 
 * This script checks the health of the Supabase connection and services.
 */

import { SupabaseClientService } from '../supabase-client';

async function runHealthCheck() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Get client instance
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check if we can connect to Supabase
    console.log('Checking connection to Supabase...');
    const { data: healthCheck, error: healthCheckError } = await supabase
      .from('health_check')
      .select('*')
      .limit(1);
    
    if (healthCheckError) {
      if (healthCheckError.code === 'PGRST116') {
        console.log('✅ Connected to Supabase successfully');
        console.log('⚠️ Note: health_check table does not exist, but connection is working');
      } else {
        console.error('❌ Failed to connect to Supabase:', healthCheckError.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Connected to Supabase successfully');
    }
    
    // Check if we can query standard tables
    const tables = [
      'google_sources',
      'experts',
      'google_expert_documents',
      'document_types',
      'presentations',
      'prompts'
    ];
    
    let failedTables = 0;
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count(*)', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ Failed to query ${table}: ${error.message || 'Unknown error'}`);
          failedTables++;
        } else {
          // Cast data safely to handle various response types
          const count = data && typeof data === 'object' && 'count' in data 
            ? data.count 
            : Array.isArray(data) 
              ? data.length 
              : 'unknown';
          console.log(`✅ Successfully queried ${table} (count: ${count})`);
        }
      } catch (err) {
        console.error(`❌ Error querying ${table}:`, err);
        failedTables++;
      }
    }
    
    if (failedTables > 0) {
      console.log(`⚠️ ${failedTables} of ${tables.length} tables failed queries`);
    } else {
      console.log('✅ All standard tables are accessible');
    }
    
    // Final health check status
    if (failedTables > tables.length / 2) {
      console.log('❌ Supabase health check FAILED: Multiple critical tables inaccessible');
      process.exit(1);
    } else if (failedTables > 0) {
      console.log('⚠️ Supabase health check WARNING: Some tables inaccessible');
      process.exit(0);
    } else {
      console.log('✅ Supabase health check PASSED: All systems operational');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Supabase health check failed with error:', error);
    process.exit(1);
  }
}

// Run the health check
runHealthCheck().catch(error => {
  console.error('❌ Unexpected error in health check:', error);
  process.exit(1);
});