#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface AllowedEmail {
  id: string;
  email: string;
  auth_user_id: string | null;
  metadata: any;
}

interface AuthUser {
  id: string;
  email: string;
}

async function syncAuthUserIds() {
  console.log('🔄 Starting sync of auth_user_id fields in auth_allowed_emails table...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Get all allowed emails
    const { data: allowedEmails, error: allowedError } = await supabase
      .from('auth_allowed_emails')
      .select('id, email, auth_user_id, metadata')
      .order('email');
    
    if (allowedError) {
      console.error('❌ Error fetching allowed emails:', allowedError);
      return;
    }
    
    // Step 2: Get all auth users using auth.getUser() for service role
    // Note: Direct access to auth.users table requires service role key
    // We'll use the admin API to list users instead
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    if (!allowedEmails || !authUsers) {
      console.log('No data found to process.');
      return;
    }
    
    // Create email to user ID map
    const emailToUserId = new Map<string, string>();
    authUsers.forEach(user => {
      if (user.email) {
        emailToUserId.set(user.email.toLowerCase(), user.id);
      }
    });
    
    // Process each allowed email
    let updatedCount = 0;
    let alreadySetCount = 0;
    let noMatchCount = 0;
    
    console.log('Processing allowed emails:\n');
    
    for (const allowedEmail of allowedEmails) {
      const email = allowedEmail.email.toLowerCase();
      const authUserId = emailToUserId.get(email);
      
      if (authUserId) {
        if (allowedEmail.auth_user_id === null) {
          // Update the auth_user_id
          const { error: updateError } = await supabase
            .from('auth_allowed_emails')
            .update({ 
              auth_user_id: authUserId,
              updated_at: new Date().toISOString()
            })
            .eq('id', allowedEmail.id);
          
          if (updateError) {
            console.error(`❌ Error updating ${email}:`, updateError);
          } else {
            console.log(`✅ Updated ${email} with auth_user_id: ${authUserId}`);
            updatedCount++;
          }
        } else {
          console.log(`ℹ️  ${email} already has auth_user_id: ${allowedEmail.auth_user_id}`);
          alreadySetCount++;
        }
      } else {
        console.log(`⚠️  ${email} - No matching auth.users record found`);
        noMatchCount++;
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updatedCount} records`);
    console.log(`ℹ️  Already set: ${alreadySetCount} records`);
    console.log(`⚠️  No match: ${noMatchCount} records`);
    console.log(`📋 Total processed: ${allowedEmails.length} records`);
    
    // Check for orphaned auth users
    const allowedEmailSet = new Set(allowedEmails.map(e => e.email.toLowerCase()));
    const orphanedUsers = authUsers.filter(user => 
      user.email && !allowedEmailSet.has(user.email.toLowerCase())
    );
    
    if (orphanedUsers.length > 0) {
      console.log(`\n⚠️  Found ${orphanedUsers.length} auth.users without allowed_emails entries:`);
      orphanedUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  syncAuthUserIds();
}

export { syncAuthUserIds };