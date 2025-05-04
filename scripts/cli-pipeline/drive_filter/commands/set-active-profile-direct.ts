#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

// Direct version of the set-active-profile command
async function setActiveProfile(profileId: string) {
  console.log(`Setting profile ${profileId} as active...`);
  
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First deactivate all profiles
    console.log('Deactivating all profiles...');
    const { error: deactivateError } = await supabase
      .from('user_filter_profiles')
      .update({ is_active: false })
      .not('id', 'eq', profileId);
      
    if (deactivateError) {
      console.error(`Error deactivating profiles: ${deactivateError.message}`);
      process.exit(1);
    }
    
    // Then activate the specified profile
    console.log(`Activating profile ${profileId}...`);
    const { data, error: activateError } = await supabase
      .from('user_filter_profiles')
      .update({ is_active: true })
      .eq('id', profileId)
      .select()
      .single();
      
    if (activateError) {
      console.error(`Error activating profile: ${activateError.message}`);
      process.exit(1);
    }
    
    if (data) {
      console.log(`✅ Filter profile "${data.name}" set as active`);
    } else {
      console.error('❌ Failed to set profile as active (no data returned)');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Accept profile ID from command line arguments
const profileId = process.argv[2];
if (!profileId) {
  console.error('Error: Profile ID is required');
  console.log('Usage: ts-node set-active-profile-direct.ts <profile-id>');
  process.exit(1);
}

// Run the function
setActiveProfile(profileId);