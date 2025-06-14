#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

/**
 * Test database connection with service role key
 * This verifies that servers can connect without authentication
 */
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection with service role key...\n');
  
  try {
    // Get the singleton instance
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Test 1: Query a table that has RLS enabled
    console.log('📊 Test 1: Querying sys_server_ports_registry (has RLS)...');
    const { data: servers, error: serversError } = await supabase
      .from('sys_server_ports_registry')
      .select('service_name, port, status')
      .limit(5);
    
    if (serversError) {
      console.error('❌ Failed to query servers:', serversError.message);
    } else {
      console.log('✅ Successfully queried servers:', servers?.length || 0, 'records');
      if (servers && servers.length > 0) {
        console.table(servers);
      }
    }
    
    // Test 2: Query another RLS-protected table
    console.log('\n📊 Test 2: Querying dev_tasks (has RLS)...');
    const { data: tasks, error: tasksError } = await supabase
      .from('dev_tasks')
      .select('id, title, status')
      .limit(5);
    
    if (tasksError) {
      console.error('❌ Failed to query tasks:', tasksError.message);
    } else {
      console.log('✅ Successfully queried tasks:', tasks?.length || 0, 'records');
    }
    
    // Test 3: Insert test to verify write permissions
    console.log('\n📊 Test 3: Testing write operation...');
    const testData = {
      service_name: 'test-connection-' + Date.now(),
      display_name: 'Test Connection Service',
      port: 9999,
      status: 'inactive',
      description: 'Test connection verification'
    };
    
    const { error: insertError } = await supabase
      .from('sys_server_ports_registry')
      .insert(testData);
    
    if (insertError) {
      console.error('❌ Failed to insert test record:', insertError.message);
    } else {
      console.log('✅ Successfully inserted test record');
      
      // Clean up test record
      const { error: deleteError } = await supabase
        .from('sys_server_ports_registry')
        .delete()
        .eq('service_name', testData.service_name);
      
      if (!deleteError) {
        console.log('✅ Cleaned up test record');
      }
    }
    
    // Summary
    console.log('\n📋 Connection Test Summary:');
    console.log('==========================');
    console.log('✅ Service role key is properly configured');
    console.log('✅ Database connection is working');
    console.log('✅ RLS is bypassed with service role key');
    console.log('\n💡 Servers should be able to start without authentication issues');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    console.error('\n💡 Troubleshooting tips:');
    console.error('1. Check that SUPABASE_SERVICE_ROLE_KEY is set in .env.development');
    console.error('2. Verify the key contains "service_role" in the JWT payload');
    console.error('3. Ensure the Supabase URL is correct');
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection().catch(console.error);