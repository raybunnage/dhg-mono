#!/usr/bin/env ts-node

/**
 * Test script to verify light auth enhanced service audit logging
 * Tests that auth_audit_log entries are created for various auth events
 */

import { lightAuthEnhanced } from '../../../packages/shared/services/light-auth-enhanced-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Test data
const TEST_EMAIL = 'test-audit-' + Date.now() + '@example.com';
const TEST_USER_DATA = {
  email: TEST_EMAIL,
  name: 'Test Audit User',
  profile: {
    profession: 'Software Developer',
    interested_topics: ['Health', 'Technology'],
    industry_sectors: ['Technology'],
    professional_interests: 'Testing audit logging',
    learning_goals: ['Test audit logging functionality'],
    reason_for_learning: 'Automated testing',
    onboarding_completed: true
  }
};

async function testLightAuthAuditLogging() {
  console.log('🧪 Testing Light Auth Enhanced Audit Logging\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  let userId: string | null = null;

  try {
    // Test 1: Failed login (email not on allowlist)
    console.log('📋 Test 1: Failed login attempt (email not on allowlist)');
    const failedLogin = await lightAuthEnhanced.login(TEST_EMAIL);
    console.log('Result:', {
      success: failedLogin.success,
      needsProfile: failedLogin.needsProfile,
      error: failedLogin.error
    });

    // Check if failed login was logged
    await checkRecentAuditLog('login_failed', TEST_EMAIL);

    // Test 2: Register with profile
    console.log('\n📋 Test 2: Register new user with profile');
    const registerResult = await lightAuthEnhanced.registerWithProfile(TEST_USER_DATA);
    console.log('Result:', {
      success: registerResult.success,
      userId: registerResult.user?.id,
      profileComplete: registerResult.profileComplete
    });

    if (registerResult.success && registerResult.user) {
      userId = registerResult.user.id;
      
      // Check if registration was logged
      await checkRecentAuditLog('login', TEST_EMAIL, userId);

      // Test 3: Successful login
      console.log('\n📋 Test 3: Successful login');
      const loginResult = await lightAuthEnhanced.login(TEST_EMAIL);
      console.log('Result:', {
        success: loginResult.success,
        profileComplete: loginResult.profileComplete,
        userId: loginResult.user?.id
      });

      // Check if login was logged
      await checkRecentAuditLog('login', TEST_EMAIL, userId);

      // Test 4: Get user audit logs
      console.log('\n📋 Test 4: Get user audit logs');
      const userLogs = await lightAuthEnhanced.getUserAuditLogs(10);
      console.log(`Found ${userLogs.length} audit logs for user`);
      userLogs.forEach(log => {
        console.log(`  - ${log.event_type} at ${log.created_at}`);
      });

      // Test 5: Get activity summary
      console.log('\n📋 Test 5: Get activity summary');
      const summary = await lightAuthEnhanced.getActivitySummary();
      console.log('Activity Summary:', summary);

      // Test 6: Profile update
      console.log('\n📋 Test 6: Update profile');
      const updatedProfile = {
        ...TEST_USER_DATA.profile,
        profession: 'Senior Software Developer'
      };
      const updateResult = await lightAuthEnhanced.updateProfile(userId, updatedProfile);
      console.log('Profile update result:', updateResult);

      // Note: updateProfile doesn't log to audit, but completeProfile does
      // Let's test completeProfile which does log
      const completeResult = await lightAuthEnhanced.completeProfile(userId, updatedProfile);
      console.log('Profile completion result:', completeResult);

      // Check if profile update was logged
      await checkRecentAuditLog('profile_updated', TEST_EMAIL, userId);

      // Test 7: Logout
      console.log('\n📋 Test 7: Logout');
      await lightAuthEnhanced.logout();
      console.log('Logged out successfully');

      // Check if logout was logged
      await checkRecentAuditLog('logout', TEST_EMAIL, userId);

    } else {
      console.error('❌ Registration failed, skipping remaining tests');
    }

    // Final verification: Query auth_audit_log directly
    console.log('\n📊 Final Verification: Querying auth_audit_log directly');
    const { data: allLogs, error: logsError } = await supabase
      .from('auth_audit_log')
      .select('*')
      .or(`metadata->email.eq.${TEST_EMAIL},user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('Error querying audit logs:', logsError);
    } else {
      console.log(`\nFound ${allLogs?.length || 0} total audit log entries:`);
      allLogs?.forEach(log => {
        console.log(`\n  Event: ${log.event_type}`);
        console.log(`  Time: ${log.created_at}`);
        console.log(`  User ID: ${log.user_id || 'N/A'}`);
        console.log(`  Metadata:`, JSON.stringify(log.metadata, null, 2));
      });
    }

    // Cleanup: Remove test user from auth_allowed_emails
    if (userId) {
      console.log('\n🧹 Cleanup: Removing test user from auth_allowed_emails');
      const { error: cleanupError } = await supabase
        .from('auth_allowed_emails')
        .update({ is_active: false })
        .eq('email', TEST_EMAIL);

      if (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      } else {
        console.log('Test user deactivated');
      }
    }

  } catch (error) {
    console.error('Test error:', error);
  }

  console.log('\n✅ Light Auth Audit Logging Test Complete!');
}

// Helper function to check recent audit logs
async function checkRecentAuditLog(
  expectedEventType: string, 
  email: string, 
  userId?: string | null
): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Wait a moment for the log to be written
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Query for recent logs
  let query = supabase
    .from('auth_audit_log')
    .select('*')
    .eq('event_type', expectedEventType)
    .gte('created_at', new Date(Date.now() - 5000).toISOString()) // Last 5 seconds
    .order('created_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: logs, error } = await query;

  if (error) {
    console.error(`  ❌ Error checking audit log: ${error.message}`);
  } else if (!logs || logs.length === 0) {
    console.log(`  ⚠️  No ${expectedEventType} event found in audit log`);
  } else {
    const log = logs[0];
    console.log(`  ✅ Found ${expectedEventType} event in audit log`);
    console.log(`     - Created: ${log.created_at}`);
    console.log(`     - Auth method: ${log.metadata?.auth_method}`);
    if (log.metadata?.email) {
      console.log(`     - Email: ${log.metadata.email}`);
    }
  }
}

// Run the test
testLightAuthAuditLogging().catch(console.error);