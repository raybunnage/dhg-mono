#!/usr/bin/env ts-node

/**
 * Verify that light auth is using allowed_emails.id as user_id in auth_audit_log
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function verifyLightAuthUserId() {
  console.log('🔍 Verifying Light Auth User ID Usage\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Step 1: Find a recent light auth event with a user_id
    console.log('📋 Step 1: Finding recent light auth events with user_id');
    const { data: authLogs, error: authError } = await supabase
      .from('auth_audit_log')
      .select('*')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (authError) {
      console.error('Error querying auth logs:', authError);
      return;
    }

    // Filter for light auth events
    const lightAuthLogs = authLogs?.filter(log => 
      log.metadata?.auth_method === 'light_auth_enhanced'
    ) || [];
    
    console.log(`Found ${authLogs?.length || 0} total events with user_id`);
    console.log(`Found ${lightAuthLogs.length} light auth events with user_id\n`);

    if (lightAuthLogs.length > 0) {
      for (const log of lightAuthLogs) {
        console.log(`\n📊 Checking event: ${log.event_type}`);
        console.log(`   Created: ${log.created_at}`);
        console.log(`   User ID: ${log.user_id}`);
        console.log(`   Email: ${log.metadata?.email || 'N/A'}`);

        // Step 2: Check if this user_id exists in allowed_emails
        const { data: allowedEmail, error: emailError } = await supabase
          .from('allowed_emails')
          .select('*')
          .eq('id', log.user_id)
          .single();

        if (emailError) {
          console.log(`   ❌ User ID not found in allowed_emails: ${emailError.message}`);
          
          // Check if it's in auth.users instead
          const { data: authUser, error: authUserError } = await supabase.rpc('execute_sql', {
            sql_query: `SELECT id, email FROM auth.users WHERE id = '${log.user_id}' LIMIT 1;`
          });
          
          if (!authUserError && authUser && authUser.length > 0) {
            console.log(`   ⚠️  User ID found in auth.users (should be in allowed_emails!)`);
            console.log(`      Auth user email: ${authUser[0].email}`);
          }
        } else {
          console.log(`   ✅ User ID correctly matches allowed_emails.id`);
          console.log(`      Allowed email: ${allowedEmail.email}`);
          console.log(`      Name: ${allowedEmail.name}`);
          console.log(`      Added: ${allowedEmail.added_at}`);
        }
      }
    }

    // Step 3: Show a sample of allowed_emails records
    console.log('\n📋 Step 3: Sample of allowed_emails records');
    const { data: sampleEmails, error: sampleError } = await supabase
      .from('allowed_emails')
      .select('id, email, name, added_at')
      .limit(5)
      .order('added_at', { ascending: false });

    if (!sampleError && sampleEmails) {
      console.log('\nRecent allowed_emails entries:');
      sampleEmails.forEach(email => {
        console.log(`  - ID: ${email.id}`);
        console.log(`    Email: ${email.email}`);
        console.log(`    Name: ${email.name || 'N/A'}`);
        console.log('');
      });
    }

    // Step 4: Compare ID formats
    console.log('📋 Step 4: Comparing ID formats');
    if (lightAuthLogs.length > 0 && sampleEmails && sampleEmails.length > 0) {
      const authLogUserId = lightAuthLogs[0].user_id;
      const allowedEmailId = sampleEmails[0].id;
      
      console.log(`\nAuth log user_id format: ${authLogUserId} (length: ${authLogUserId?.length})`);
      console.log(`Allowed email id format: ${allowedEmailId} (length: ${allowedEmailId?.length})`);
      
      // Check if they're UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      console.log(`Auth log user_id is UUID: ${uuidRegex.test(authLogUserId || '')}`);
      console.log(`Allowed email id is UUID: ${uuidRegex.test(allowedEmailId || '')}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Verification Complete!');
}

// Run the verification
verifyLightAuthUserId().catch(console.error);