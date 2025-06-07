#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkAuthAuditLog() {
  console.log('Checking auth_audit_log table...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // First, let's check if we can access the table at all
    console.log('1. Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('auth_audit_log')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Cannot access auth_audit_log table:', testError);
      
      // Try with service role by getting from env
      console.log('\n2. Trying with service role key...');
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error('❌ No service role key found in environment');
        return;
      }
      
      // Create admin client using SupabaseClientService with service role
      const supabaseAdmin = SupabaseClientService.getInstance().getClient();
      
      const { data: adminTestData, error: adminTestError } = await supabaseAdmin
        .from('auth_audit_log')
        .select('*')
        .limit(1);
      
      if (adminTestError) {
        console.error('❌ Cannot access with service role either:', adminTestError);
        return;
      }
      
      console.log('✅ Service role access works!');
      
      // Use admin client for remaining queries
      await checkWithClient(supabaseAdmin, 'Service Role');
    } else {
      console.log('✅ Table access successful!');
      await checkWithClient(supabase, 'Regular');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

async function checkWithClient(client: any, clientType: string) {
  console.log(`\nUsing ${clientType} client...\n`);
  
  // Get total count
  console.log('2. Getting total record count...');
  const { count, error: countError } = await client
    .from('auth_audit_log')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Count error:', countError);
  } else {
    console.log(`✅ Total records in table: ${count}`);
  }
  
  // Get all records to see what we have
  console.log('\n3. Fetching all records...');
  const { data: allRecords, error: allError } = await client
    .from('auth_audit_log')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (allError) {
    console.error('❌ Error fetching records:', allError);
    return;
  }
  
  console.log(`✅ Fetched ${allRecords?.length || 0} records`);
  
  if (allRecords && allRecords.length > 0) {
    // Analyze event types
    const eventTypes = new Map<string, number>();
    allRecords.forEach((record: any) => {
      const type = record.event_type || 'undefined';
      eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
    });
    
    console.log('\n4. Event type breakdown:');
    console.log('------------------------');
    Array.from(eventTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count} occurrences`);
      });
    
    // Show sample records
    console.log('\n5. Sample records (last 5):');
    console.log('---------------------------');
    allRecords.slice(0, 5).forEach((record: any, idx: number) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Event Type: ${record.event_type}`);
      console.log(`  User ID: ${record.user_id || 'null'}`);
      console.log(`  Created At: ${record.created_at}`);
      console.log(`  Metadata: ${JSON.stringify(record.metadata || {})}`);
    });
    
    // Check for records in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recent = allRecords.filter((r: any) => 
      new Date(r.created_at) > oneDayAgo
    );
    
    console.log(`\n6. Records in last 24 hours: ${recent.length}`);
    
    // Check for login-related events
    const loginRelated = allRecords.filter((r: any) => {
      const type = (r.event_type || '').toLowerCase();
      return type.includes('login') || type.includes('sign') || type.includes('auth');
    });
    
    console.log(`\n7. Login-related events: ${loginRelated.length}`);
    if (loginRelated.length > 0) {
      const loginTypes = new Set(loginRelated.map((r: any) => r.event_type));
      console.log('   Types:', Array.from(loginTypes).join(', '));
    }
  } else {
    console.log('\n⚠️  No records found in auth_audit_log table');
    console.log('   This table might not be populated yet.');
    console.log('   Login events need to be explicitly logged by the application.');
  }
}

// Run the check
checkAuthAuditLog();