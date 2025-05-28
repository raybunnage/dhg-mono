#!/usr/bin/env ts-node

/**
 * Check RLS policies for user_profiles_v2 table
 * 
 * This script checks the Row Level Security policies for the user_profiles_v2 table
 * and tests if a specific user can insert/update records
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkRLSPolicies() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('Usage: ts-node check-user-profiles-rls.ts <user-id>');
    console.log('Example: ts-node check-user-profiles-rls.ts ab0d7f02-d977-4850-9d94-ce13feae53d4');
    return;
  }

  console.log(`Checking RLS policies for user ID: ${userId}`);
  
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check if user exists in auth_allowed_emails
    console.log('\n1. Checking if user exists in auth_allowed_emails table...');
    const { data: allowedEmail, error: allowedError } = await supabase
      .from('auth_allowed_emails')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (allowedError) {
      console.error('Error checking auth_allowed_emails:', allowedError);
    } else {
      console.log('User found in auth_allowed_emails:', allowedEmail);
    }
    
    // Check existing profile
    console.log('\n2. Checking if profile already exists...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles_v2')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking profile:', profileError);
    } else if (profile) {
      console.log('Profile exists:', profile);
    } else {
      console.log('No profile found for this user');
    }
    
    // Get RLS policies
    console.log('\n3. Checking RLS policies for user_profiles_v2...');
    const { data: policies, error: policyError } = await supabase
      .rpc('get_table_policies', { table_name: 'user_profiles_v2' });
    
    if (policyError) {
      console.error('Error getting policies:', policyError);
      
      // Try alternative query
      const { data: altPolicies, error: altError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'user_profiles_v2');
      
      if (!altError && altPolicies) {
        console.log('Found policies:', altPolicies);
      }
    } else {
      console.log('RLS Policies:', policies);
    }
    
    // Test insert capability
    console.log('\n4. Testing insert capability...');
    const testData = {
      id: userId,
      profession: 'Test',
      learning_goals: ['Test Goal'],
      reason_for_learning: 'Test Reason',
      interested_topics: ['Test Topic']
    };
    
    const { error: insertError } = await supabase
      .from('user_profiles_v2')
      .insert(testData);
    
    if (insertError) {
      console.error('Insert test failed:', insertError);
      console.log('\nThis indicates an RLS policy is blocking the insert.');
      console.log('The user_profiles_v2 table likely requires:');
      console.log('- User must be authenticated');
      console.log('- User can only insert their own profile (id must match auth.uid())');
      console.log('- Or user must have specific role/permission');
    } else {
      console.log('Insert test successful - user has permission');
      
      // Clean up test data
      await supabase
        .from('user_profiles_v2')
        .delete()
        .eq('id', userId)
        .eq('profession', 'Test');
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

// Run the check
checkRLSPolicies();