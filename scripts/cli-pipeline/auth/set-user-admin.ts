#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function setUserAdmin(email: string) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log(`Setting admin role for user: ${email}`);
  
  // Call the database function to set admin role
  const { data, error } = await supabase
    .rpc('set_user_admin_role', { 
      target_email: email,
      is_admin: true
    });
    
  if (error) {
    console.error('Error setting admin role:', error);
    return;
  }
  
  console.log('Admin role set successfully!');
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address');
  console.log('Usage: ts-node set-user-admin.ts <email>');
  process.exit(1);
}

setUserAdmin(email).catch(console.error);