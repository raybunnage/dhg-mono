#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkFilterTables() {
  console.log('🔍 Checking filter tables...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // 1. Check filter_user_profiles table
    console.log('1. Checking filter_user_profiles table:');
    console.log('----------------------------------------');
    
    const { data: profiles, error: profilesError, count } = await supabase
      .from('filter_user_profiles')
      .select('*', { count: 'exact' });
    
    if (profilesError) {
      console.error('❌ Error querying filter_user_profiles:', profilesError);
    } else {
      console.log(`✅ Found ${count} profiles in filter_user_profiles`);
      if (profiles && profiles.length > 0) {
        console.log('\nProfiles:');
        profiles.forEach((profile: any) => {
          console.log(`  - ${profile.name} (${profile.id})`);
          console.log(`    Active: ${profile.is_active}, Public: ${profile.is_public}`);
          console.log(`    Description: ${profile.description || 'N/A'}`);
          console.log('');
        });
      }
    }
    
    // 2. Check filter_user_profile_drives table
    console.log('\n2. Checking filter_user_profile_drives table:');
    console.log('---------------------------------------------');
    
    const { data: drives, error: drivesError, count: drivesCount } = await supabase
      .from('filter_user_profile_drives')
      .select('*', { count: 'exact' });
    
    if (drivesError) {
      console.error('❌ Error querying filter_user_profile_drives:', drivesError);
    } else {
      console.log(`✅ Found ${drivesCount} drive mappings`);
      
      // Group by profile
      if (drives && drives.length > 0) {
        const drivesByProfile = drives.reduce((acc: any, drive: any) => {
          if (!acc[drive.profile_id]) acc[drive.profile_id] = [];
          acc[drive.profile_id].push(drive);
          return acc;
        }, {});
        
        console.log('\nDrive mappings by profile:');
        Object.entries(drivesByProfile).forEach(([profileId, profileDrives]: [string, any]) => {
          const profile = profiles?.find((p: any) => p.id === profileId);
          console.log(`\n  Profile: ${profile?.name || 'Unknown'} (${profileId})`);
          profileDrives.forEach((drive: any) => {
            console.log(`    - Drive ID: ${drive.root_drive_id}`);
            console.log(`      Include children: ${drive.include_children}`);
          });
        });
      }
    }
    
    // 3. Test RLS policies
    console.log('\n\n3. Testing RLS policies:');
    console.log('------------------------');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log(`Current user: ${user ? user.email : 'Anonymous/No user'}`);
    
    // Test if we can read without auth
    console.log('\nTesting anonymous read access...');
    const { data: anonRead, error: anonError } = await supabase
      .from('filter_user_profiles')
      .select('id, name')
      .limit(1);
    
    if (anonError) {
      console.log('❌ Anonymous read failed (expected if RLS is restrictive):', anonError.message);
    } else {
      console.log('✅ Anonymous read succeeded - found', anonRead?.length || 0, 'records');
    }
    
    // 4. Check for public profiles specifically
    console.log('\n4. Checking for public profiles:');
    console.log('--------------------------------');
    
    const { data: publicProfiles, error: publicError } = await supabase
      .from('filter_user_profiles')
      .select('*')
      .eq('is_public', true);
    
    if (publicError) {
      console.error('❌ Error querying public profiles:', publicError);
    } else {
      console.log(`✅ Found ${publicProfiles?.length || 0} public profiles`);
      publicProfiles?.forEach((profile: any) => {
        console.log(`  - ${profile.name} (Active: ${profile.is_active})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkFilterTables().catch(console.error);