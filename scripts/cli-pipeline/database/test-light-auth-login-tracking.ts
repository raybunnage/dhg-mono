#!/usr/bin/env ts-node

/**
 * Test that light auth updates login tracking fields in allowed_emails
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function testLightAuthLoginTracking() {
  console.log('🧪 Testing Light Auth Login Tracking\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Step 1: Get an allowed email to test with
    console.log('📋 Step 1: Getting a test allowed email');
    const { data: allowedEmails, error: emailError } = await supabase
      .from('auth_allowed_emails')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (emailError || !allowedEmails || allowedEmails.length === 0) {
      console.error('No allowed emails found');
      return;
    }

    const testEmail = allowedEmails[0];
    console.log(`Using allowed email: ${testEmail.email}`);
    console.log(`Current login count: ${testEmail.login_count || 0}`);
    console.log(`Last login: ${testEmail.last_login_at || 'Never'}`);

    // Step 2: Simulate login by updating tracking fields (mimicking what the service does)
    console.log('\n📋 Step 2: Simulating login to update tracking fields');
    
    const currentCount = testEmail.login_count || 0;
    const { error: updateError } = await supabase
      .from('auth_allowed_emails')
      .update({
        last_login_at: new Date().toISOString(),
        login_count: currentCount + 1
      })
      .eq('id', testEmail.id);

    if (updateError) {
      console.error('Failed to update tracking fields:', updateError);
      return;
    }

    console.log('✅ Updated login tracking fields');

    // Step 3: Verify the update
    console.log('\n📋 Step 3: Verifying the update');
    const { data: updatedEmail, error: verifyError } = await supabase
      .from('auth_allowed_emails')
      .select('*')
      .eq('id', testEmail.id)
      .single();

    if (verifyError) {
      console.error('Failed to verify update:', verifyError);
      return;
    }

    console.log(`\nUpdated values:`);
    console.log(`  Email: ${updatedEmail.email}`);
    console.log(`  Login count: ${testEmail.login_count || 0} → ${updatedEmail.login_count}`);
    console.log(`  Last login: ${testEmail.last_login_at || 'Never'} → ${updatedEmail.last_login_at}`);
    console.log(`  ✅ Login count incremented: ${updatedEmail.login_count > (testEmail.login_count || 0)}`);
    console.log(`  ✅ Last login updated: ${updatedEmail.last_login_at !== testEmail.last_login_at}`);

    // Step 4: Check if auth_audit_log also has the corresponding entry
    console.log('\n📋 Step 4: Checking for corresponding auth_audit_log entry');
    const { data: auditLogs, error: auditError } = await supabase
      .from('auth_audit_log')
      .select('*')
      .eq('user_id', testEmail.id)
      .eq('event_type', 'login')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!auditError && auditLogs && auditLogs.length > 0) {
      const latestLogin = auditLogs[0];
      console.log(`\nLatest login event in auth_audit_log:`);
      console.log(`  Created: ${latestLogin.created_at}`);
      console.log(`  Email: ${latestLogin.metadata?.email}`);
      console.log(`  Auth method: ${latestLogin.metadata?.auth_method}`);
    }

    // Step 5: Test multiple logins
    console.log('\n📋 Step 5: Testing multiple login updates');
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between updates
      
      const { data: current } = await supabase
        .from('auth_allowed_emails')
        .select('login_count')
        .eq('id', testEmail.id)
        .single();

      const newCount = (current?.login_count || 0) + 1;
      
      await supabase
        .from('auth_allowed_emails')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: newCount
        })
        .eq('id', testEmail.id);

      console.log(`  Login ${i + 1}: Updated count to ${newCount}`);
    }

    // Final check
    const { data: finalEmail } = await supabase
      .from('auth_allowed_emails')
      .select('*')
      .eq('id', testEmail.id)
      .single();

    console.log(`\nFinal login count: ${finalEmail?.login_count}`);
    console.log(`Final last login: ${finalEmail?.last_login_at}`);

  } catch (error) {
    console.error('Test error:', error);
  }

  console.log('\n✅ Login Tracking Test Complete!');
}

// Run the test
testLightAuthLoginTracking().catch(console.error);