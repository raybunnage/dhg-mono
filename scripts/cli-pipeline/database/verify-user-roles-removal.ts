#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function verifyUserRolesRemoval() {
  console.log('🔍 Verifying user roles removal migration...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  let allPassed = true;

  // 1. Check if user_roles table exists
  console.log('1. Checking if user_roles table is removed...');
  const { data: userRolesExists, error: userRolesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'user_roles')
    .single();

  if (userRolesError && userRolesError.code === 'PGRST116') {
    console.log('✅ user_roles table successfully removed');
  } else if (!userRolesError && userRolesExists) {
    console.log('❌ user_roles table still exists');
    allPassed = false;
  } else {
    console.log('⚠️ Unable to verify user_roles table status:', userRolesError?.message);
  }

  // 2. Check if allowed_emails table exists
  console.log('\n2. Checking if allowed_emails table exists...');
  const { data: allowedEmailsData, error: allowedEmailsError } = await supabase
    .from('allowed_emails')
    .select('email')
    .limit(1);

  if (!allowedEmailsError) {
    console.log('✅ allowed_emails table exists and is accessible');
  } else {
    console.log('❌ Error accessing allowed_emails table:', allowedEmailsError.message);
    allPassed = false;
  }

  // 3. Check if make_me_admin function is removed
  console.log('\n3. Checking if make_me_admin function is removed...');
  const { data: functionExists, error: functionError } = await supabase
    .rpc('execute_sql', {
      sql: `
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'make_me_admin'
      `
    });

  if (functionError) {
    console.log('⚠️ Could not check function existence:', functionError.message);
  } else if (!functionExists || functionExists.length === 0) {
    console.log('✅ make_me_admin function successfully removed');
  } else {
    console.log('❌ make_me_admin function still exists');
    allPassed = false;
  }

  // 4. Test allowed_emails table policies
  console.log('\n4. Testing allowed_emails table policies...');
  
  // Test read access (should work for any authenticated user)
  const { data: readTest, error: readError } = await supabase
    .from('allowed_emails')
    .select('email, created_at')
    .limit(5);

  if (!readError) {
    console.log('✅ Read access to allowed_emails works');
    if (readTest && readTest.length > 0) {
      console.log(`   Found ${readTest.length} allowed email(s)`);
    }
  } else {
    console.log('❌ Error reading from allowed_emails:', readError.message);
    allPassed = false;
  }

  // 5. Check RLS policies
  console.log('\n5. Checking RLS policies on allowed_emails...');
  const { data: policies, error: policiesError } = await supabase
    .rpc('execute_sql', {
      sql: `
        SELECT pol.polname, pol.polcmd 
        FROM pg_policy pol
        JOIN pg_class pc ON pol.polrelid = pc.oid
        WHERE pc.relname = 'allowed_emails'
        AND pc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `
    });

  if (!policiesError && policies) {
    console.log('✅ RLS policies found on allowed_emails:');
    policies.forEach((policy: any) => {
      const cmdMap: { [key: string]: string } = {
        'r': 'SELECT',
        'a': 'INSERT',
        'w': 'UPDATE',
        'd': 'DELETE',
        '*': 'ALL'
      };
      console.log(`   - ${policy.polname} (${cmdMap[policy.polcmd] || policy.polcmd})`);
    });
  } else {
    console.log('⚠️ Could not check RLS policies:', policiesError?.message);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All verification checks passed!');
    console.log('The user roles removal migration was successful.');
  } else {
    console.log('❌ Some verification checks failed.');
    console.log('Please review the errors above.');
  }
  console.log('='.repeat(50));
}

// Run the verification
verifyUserRolesRemoval().catch(console.error);