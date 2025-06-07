#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function applyFilterRLSPolicies() {
  console.log('Applying RLS policies for filter tables...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // First, check if we can access the tables
    console.log('1. Testing current access to filter tables...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('filter_user_profiles')
      .select('id')
      .limit(1);
    
    if (profilesError) {
      console.log('❌ Cannot access filter_user_profiles:', profilesError.message);
    } else {
      console.log('✅ Can access filter_user_profiles');
    }
    
    // Apply the RLS policies using service role
    console.log('\n2. Applying RLS policies...');
    
    const queries = [
      // Enable RLS
      `ALTER TABLE filter_user_profiles ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE filter_user_profile_drives ENABLE ROW LEVEL SECURITY`,
      
      // Drop existing policies
      `DROP POLICY IF EXISTS "Allow public read access" ON filter_user_profiles`,
      `DROP POLICY IF EXISTS "Allow public read access" ON filter_user_profile_drives`,
      
      // Create public read policies
      `CREATE POLICY "Allow public read access" ON filter_user_profiles FOR SELECT TO public USING (true)`,
      `CREATE POLICY "Allow public read access" ON filter_user_profile_drives FOR SELECT TO public USING (true)`
    ];
    
    for (const query of queries) {
      console.log(`Executing: ${query.substring(0, 50)}...`);
      const { error } = await supabase.rpc('execute_sql', { query });
      
      if (error) {
        console.error(`❌ Failed: ${error.message}`);
        
        // If execute_sql doesn't exist, we need to use a different approach
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log('\n⚠️  The execute_sql function is not available.');
          console.log('Please run the following SQL directly in the Supabase SQL editor:\n');
          console.log('-- Enable RLS and add public read policies');
          console.log(queries.join(';\n') + ';');
          return;
        }
      } else {
        console.log('✅ Success');
      }
    }
    
    // Test access again
    console.log('\n3. Testing access after applying policies...');
    
    const { data: profilesAfter, error: profilesAfterError, count } = await supabase
      .from('filter_user_profiles')
      .select('*', { count: 'exact' });
    
    if (profilesAfterError) {
      console.log('❌ Still cannot access filter_user_profiles:', profilesAfterError.message);
    } else {
      console.log(`✅ Can now access filter_user_profiles - found ${count} records`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
applyFilterRLSPolicies();