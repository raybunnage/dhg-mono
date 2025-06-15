#!/usr/bin/env ts-node
/**
 * Test database connection and check for execute_sql function
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client.js';

async function testConnection() {
  console.log('🔍 Testing database connection and functions...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test 1: Basic connectivity - try to query a simple table
  console.log('1️⃣ Testing basic connectivity...');
  try {
    const { data, error } = await supabase
      .from('sys_table_prefixes')
      .select('prefix')
      .limit(1);
    
    if (error) {
      console.log('❌ Basic query failed:', error.message);
    } else {
      console.log('✅ Basic connectivity working');
    }
  } catch (e) {
    console.log('❌ Connection error:', e);
  }

  // Test 2: Check if execute_sql function exists
  console.log('\n2️⃣ Checking for execute_sql function...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_query: "SELECT 'test' as result" 
    });
    
    if (error) {
      console.log('❌ execute_sql function error:', error);
      console.log('   Code:', error.code);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
    } else {
      console.log('✅ execute_sql function exists and works');
      console.log('   Result:', data);
    }
  } catch (e) {
    console.log('❌ RPC error:', e);
  }

  // Test 3: Try different parameter names
  console.log('\n3️⃣ Testing alternative parameter names...');
  const paramNames = ['sql_query', 'query', 'sql', 'statement'];
  
  for (const paramName of paramNames) {
    try {
      const params: any = {};
      params[paramName] = "SELECT 'test' as result";
      
      const { error } = await supabase.rpc('execute_sql', params);
      
      if (!error) {
        console.log(`✅ Parameter name '${paramName}' works!`);
        break;
      } else if (error.code !== 'PGRST202') {
        console.log(`⚠️  Parameter '${paramName}': ${error.code}`);
      }
    } catch (e) {
      // Silent fail for parameter testing
    }
  }

  // Test 4: List available RPC functions
  console.log('\n4️⃣ Checking available RPC functions...');
  try {
    const { data, error } = await supabase.rpc('get_table_info');
    
    if (!error) {
      console.log('✅ get_table_info function exists');
    } else {
      console.log('❌ get_table_info error:', error.code);
    }
  } catch (e) {
    console.log('❌ RPC listing error:', e);
  }

  // Test 5: Check for continuous tables
  console.log('\n5️⃣ Checking for continuous improvement tables...');
  const tables = ['continuous_inventory', 'continuous_test_runs', 'continuous_issues'];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error?.code === '42P01' || error?.message?.includes('relation')) {
        console.log(`❌ Table '${table}' does not exist`);
      } else if (!error) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`⚠️  Table '${table}' error: ${error.code}`);
      }
    } catch (e) {
      console.log(`❌ Error checking ${table}:`, e);
    }
  }

  console.log('\n📊 Summary:');
  console.log('- If execute_sql is missing, the migration needs to be run');
  console.log('- If continuous tables are missing, run the Phase 1 migration');
  console.log('- Check Supabase dashboard for manual SQL execution');
}

// Run
testConnection().catch(console.error);