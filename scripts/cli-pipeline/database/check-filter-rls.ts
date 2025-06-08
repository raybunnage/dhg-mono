#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkFilterRLS() {
  console.log('🔍 Checking RLS policies on filter tables...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check RLS policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies_for_table', { table_name: 'filter_user_profiles' });
    
    if (policiesError) {
      console.log('Could not fetch RLS policies directly. Checking table permissions...');
    } else {
      console.log('RLS Policies for filter_user_profiles:', policies);
    }
    
    // Test with anon key (what browser uses)
    console.log('\n1. Testing with anon key (browser simulation):');
    console.log('----------------------------------------');
    
    // Create a client with just the anon key to simulate browser
    const { createClient } = require('@supabase/supabase-js');
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY! // Browser apps use anon key, not service role
    );
    
    const { data: anonData, error: anonError } = await anonClient
      .from('filter_user_profiles')
      .select('*');
    
    if (anonError) {
      console.error('❌ Anon key query failed:', anonError);
    } else {
      console.log(`✅ Anon key query succeeded! Found ${anonData?.length || 0} records`);
      if (anonData && anonData.length > 0) {
        console.log('First record:', anonData[0]);
      }
    }
    
    // Test with service role (what CLI uses)
    console.log('\n2. Testing with service role key (CLI simulation):');
    console.log('------------------------------------------------');
    
    const { data: serviceData, error: serviceError } = await supabase
      .from('filter_user_profiles')
      .select('*');
    
    if (serviceError) {
      console.error('❌ Service role query failed:', serviceError);
    } else {
      console.log(`✅ Service role query succeeded! Found ${serviceData?.length || 0} records`);
    }
    
    // Check if RLS is enabled
    console.log('\n3. Checking RLS status:');
    console.log('----------------------');
    
    // Try to query pg_policies
    const { data: rlsCheck, error: rlsError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'filter_user_profiles')
      .single();
    
    if (rlsError) {
      console.log('Could not query pg_policies table directly');
      
      // Alternative: Try to check with a raw SQL query
      const { data: sqlCheck, error: sqlError } = await supabase.rpc('check_rls_enabled', {
        table_name: 'filter_user_profiles'
      });
      
      if (sqlError) {
        console.log('RLS status unknown - likely enabled with restrictive policies');
      } else {
        console.log('RLS status from SQL:', sqlCheck);
      }
    } else {
      console.log('RLS policies found:', rlsCheck);
    }
    
    // Compare results
    console.log('\n4. Summary:');
    console.log('-----------');
    console.log(`Anon key (browser) can see: ${anonData?.length || 0} records`);
    console.log(`Service role (CLI) can see: ${serviceData?.length || 0} records`);
    
    if ((serviceData?.length || 0) > 0 && (anonData?.length || 0) === 0) {
      console.log('\n⚠️  ISSUE FOUND: RLS is blocking browser access!');
      console.log('The filter_user_profiles table has Row Level Security that prevents anonymous/browser access.');
      console.log('This is why the browser app sees no data while CLI commands work fine.');
      console.log('\nSOLUTION: We need to add a policy that allows public read access to filter profiles.');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkFilterRLS().catch(console.error);