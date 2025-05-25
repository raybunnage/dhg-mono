#!/usr/bin/env ts-node

/**
 * Simple test to verify auth_audit_log entries are being created
 * Focuses on testing the audit logging functionality directly
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function testAuthAuditLogSimple() {
  console.log('🧪 Testing Auth Audit Log Functionality\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Test 1: Insert a test auth event directly
    console.log('📋 Test 1: Insert test auth event directly');
    const testEvent = {
      user_id: null,
      event_type: 'login_failed',
      metadata: {
        email: 'test-direct@example.com',
        auth_method: 'test_script',
        reason: 'Testing audit log functionality'
      },
      created_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('auth_audit_log')
      .insert(testEvent);

    if (insertError) {
      console.error('❌ Failed to insert test event:', insertError);
    } else {
      console.log('✅ Successfully inserted test event');
    }

    // Test 2: Query recent auth events
    console.log('\n📋 Test 2: Query recent auth events');
    const { data: recentEvents, error: queryError } = await supabase
      .from('auth_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (queryError) {
      console.error('❌ Failed to query events:', queryError);
    } else {
      console.log(`✅ Found ${recentEvents?.length || 0} recent events`);
      
      // Show events from light auth
      const lightAuthEvents = recentEvents?.filter(
        event => event.metadata?.auth_method === 'light_auth_enhanced'
      );
      
      console.log(`\n📊 Light Auth Events: ${lightAuthEvents?.length || 0}`);
      lightAuthEvents?.forEach(event => {
        console.log(`  - ${event.event_type} at ${event.created_at}`);
        console.log(`    Email: ${event.metadata?.email || 'N/A'}`);
      });
    }

    // Test 3: Check table structure
    console.log('\n📋 Test 3: Check auth_audit_log table structure');
    const { data: columns, error: schemaError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'auth_audit_log'
        ORDER BY ordinal_position;
      `
    });

    if (schemaError) {
      console.error('❌ Failed to check table structure:', schemaError);
    } else {
      console.log('✅ Table structure:');
      columns?.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Test 4: Check RLS policies
    console.log('\n📋 Test 4: Check RLS policies on auth_audit_log');
    const { data: policies, error: policyError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT pol.polname, pol.polcmd, pol.polroles::text
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
        WHERE nsp.nspname = 'public' 
        AND cls.relname = 'auth_audit_log';
      `
    });

    if (policyError) {
      console.error('❌ Failed to check policies:', policyError);
    } else {
      console.log(`✅ Found ${policies?.length || 0} RLS policies`);
      policies?.forEach((pol: any) => {
        console.log(`  - ${pol.polname}: ${pol.polcmd}`);
      });
    }

  } catch (error) {
    console.error('Test error:', error);
  }

  console.log('\n✅ Auth Audit Log Test Complete!');
}

// Run the test
testAuthAuditLogSimple().catch(console.error);