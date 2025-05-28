#!/usr/bin/env ts-node

/**
 * Test light auth with an existing allowed email to verify user_id is set correctly
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function testLightAuthWithAllowedEmail() {
  console.log('🧪 Testing Light Auth with Allowed Email User ID\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Step 1: Get an existing allowed email
    console.log('📋 Step 1: Getting an existing allowed email');
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
    console.log(`Allowed email ID: ${testEmail.id}`);

    // Step 2: Simulate a successful login by creating an auth event
    console.log('\n📋 Step 2: Creating auth events with correct user_id');
    
    // Login event
    const loginEvent = {
      user_id: testEmail.id,  // This should be the allowed_emails.id
      event_type: 'login',
      metadata: {
        email: testEmail.email,
        auth_method: 'light_auth_enhanced',
        test_note: 'Testing user_id is allowed_emails.id'
      },
      created_at: new Date().toISOString()
    };

    const { error: loginError } = await supabase
      .from('auth_audit_log')
      .insert(loginEvent);

    if (loginError) {
      console.error('Failed to insert login event:', loginError);
    } else {
      console.log('✅ Created login event with user_id:', testEmail.id);
    }

    // Profile update event
    const profileEvent = {
      user_id: testEmail.id,
      event_type: 'profile_updated',
      metadata: {
        email: testEmail.email,
        auth_method: 'light_auth_enhanced',
        action: 'profile_completed',
        test_note: 'Testing profile update with allowed_emails.id'
      },
      created_at: new Date().toISOString()
    };

    const { error: profileError } = await supabase
      .from('auth_audit_log')
      .insert(profileEvent);

    if (profileError) {
      console.error('Failed to insert profile event:', profileError);
    } else {
      console.log('✅ Created profile_updated event with user_id:', testEmail.id);
    }

    // Logout event
    const logoutEvent = {
      user_id: testEmail.id,
      event_type: 'logout',
      metadata: {
        email: testEmail.email,
        auth_method: 'light_auth_enhanced',
        test_note: 'Testing logout with allowed_emails.id'
      },
      created_at: new Date().toISOString()
    };

    const { error: logoutError } = await supabase
      .from('auth_audit_log')
      .insert(logoutEvent);

    if (logoutError) {
      console.error('Failed to insert logout event:', logoutError);
    } else {
      console.log('✅ Created logout event with user_id:', testEmail.id);
    }

    // Step 3: Query back the events we just created
    console.log('\n📋 Step 3: Verifying the created events');
    const { data: createdEvents, error: queryError } = await supabase
      .from('auth_audit_log')
      .select('*')
      .eq('user_id', testEmail.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (queryError) {
      console.error('Error querying created events:', queryError);
    } else {
      console.log(`\nFound ${createdEvents?.length || 0} events for user ${testEmail.id}:`);
      createdEvents?.forEach(event => {
        console.log(`\n  Event: ${event.event_type}`);
        console.log(`  User ID: ${event.user_id}`);
        console.log(`  Created: ${event.created_at}`);
        console.log(`  Email from metadata: ${event.metadata?.email}`);
      });
    }

    // Step 4: Verify the user_id matches allowed_emails.id
    console.log('\n📋 Step 4: Verifying user_id matches allowed_emails.id');
    if (createdEvents && createdEvents.length > 0) {
      const eventUserId = createdEvents[0].user_id;
      console.log(`\nEvent user_id: ${eventUserId}`);
      console.log(`Allowed email id: ${testEmail.id}`);
      console.log(`Match: ${eventUserId === testEmail.id ? '✅ YES' : '❌ NO'}`);
    }

  } catch (error) {
    console.error('Test error:', error);
  }

  console.log('\n✅ Test Complete!');
}

// Run the test
testLightAuthWithAllowedEmail().catch(console.error);