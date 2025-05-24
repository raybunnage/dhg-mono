#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkAuthMigrationObjects() {
  const supabase = SupabaseClientService.getInstance().getClient();

  console.log('Checking for existing auth migration objects...\n');

  // Check for tables
  console.log('=== CHECKING TABLES ===');
  const tablesToCheck = ['allowed_emails', 'access_requests', 'user_roles'];
  
  for (const tableName of tablesToCheck) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0); // We just want to check if table exists, not fetch data

    if (error) {
      if (error.code === '42P01') {
        console.log(`❌ Table '${tableName}' does not exist`);
      } else {
        console.log(`⚠️  Table '${tableName}' - Error: ${error.message}`);
      }
    } else {
      console.log(`✅ Table '${tableName}' exists`);
    }
  }

  // Check for functions
  console.log('\n=== CHECKING FUNCTIONS ===');
  const functionsToCheck = [
    'is_email_allowed',
    'submit_access_request',
    'add_allowed_email',
    'approve_access_request',
    'deny_access_request'
  ];

  const { data: functions, error: funcError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (${functionsToCheck.map(f => `'${f}'`).join(', ')})
      AND routine_type = 'FUNCTION'
    `
  });

  if (funcError) {
    console.log('Error checking functions:', funcError.message);
  } else if (functions && functions.length > 0) {
    const existingFunctions = functions.map((f: any) => f.routine_name);
    functionsToCheck.forEach(funcName => {
      if (existingFunctions.includes(funcName)) {
        console.log(`✅ Function '${funcName}' exists`);
      } else {
        console.log(`❌ Function '${funcName}' does not exist`);
      }
    });
  } else {
    functionsToCheck.forEach(funcName => {
      console.log(`❌ Function '${funcName}' does not exist`);
    });
  }

  // Check for views
  console.log('\n=== CHECKING VIEWS ===');
  const viewsToCheck = ['pending_access_requests', 'professional_profiles'];

  const { data: views, error: viewError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name IN (${viewsToCheck.map(v => `'${v}'`).join(', ')})
    `
  });

  if (viewError) {
    console.log('Error checking views:', viewError.message);
  } else if (views && views.length > 0) {
    const existingViews = views.map((v: any) => v.table_name);
    viewsToCheck.forEach(viewName => {
      if (existingViews.includes(viewName)) {
        console.log(`✅ View '${viewName}' exists`);
      } else {
        console.log(`❌ View '${viewName}' does not exist`);
      }
    });
  } else {
    viewsToCheck.forEach(viewName => {
      console.log(`❌ View '${viewName}' does not exist`);
    });
  }

  // Additional check for RLS policies
  console.log('\n=== CHECKING RLS POLICIES ===');
  const { data: policies, error: policyError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename IN (${tablesToCheck.map(t => `'${t}'`).join(', ')})
    `
  });

  if (policyError) {
    console.log('Error checking RLS policies:', policyError.message);
  } else if (policies && policies.length > 0) {
    console.log('\nExisting RLS policies:');
    policies.forEach((p: any) => {
      console.log(`✅ Policy '${p.policyname}' on table '${p.tablename}' for ${p.cmd}`);
    });
  } else {
    console.log('No RLS policies found for these tables');
  }

  // Check if auth schema exists
  console.log('\n=== CHECKING AUTH SCHEMA ACCESS ===');
  const { data: authCheck, error: authError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
      ) as auth_accessible
    `
  });

  if (authError) {
    console.log('⚠️  Cannot check auth schema:', authError.message);
  } else if (authCheck && authCheck.length > 0) {
    if (authCheck[0].auth_accessible) {
      console.log('✅ Auth schema is accessible');
    } else {
      console.log('❌ Auth schema is not accessible');
    }
  }
}

// Run the check
checkAuthMigrationObjects().catch(console.error);