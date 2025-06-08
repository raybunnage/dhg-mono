#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { FilterService } from '../../../packages/shared/services/filter-service/filter-service';

async function createSampleFilters() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const filterService = new FilterService(supabase);

    console.log('Creating sample filter profiles...\n');

    // First, let's get some sample root_drive_ids from the database
    const { data: sampleSources, error: sourcesError } = await supabase
      .from('google_sources')
      .select('root_drive_id, path')
      .not('root_drive_id', 'is', null)
      .limit(100);

    if (sourcesError) {
      console.error('Error fetching sample sources:', sourcesError);
      return;
    }

    // Get unique root_drive_ids
    const uniqueDriveIds = [...new Set(sampleSources?.map(s => s.root_drive_id) || [])];
    console.log(`Found ${uniqueDriveIds.length} unique root_drive_ids\n`);

    if (uniqueDriveIds.length === 0) {
      console.log('No root_drive_ids found in google_sources table.');
      console.log('Make sure you have synced files from Google Drive first.');
      return;
    }

    // Display the first few drive IDs
    console.log('Sample root_drive_ids:');
    uniqueDriveIds.slice(0, 5).forEach((id, idx) => {
      console.log(`  ${idx + 1}. ${id}`);
    });
    console.log('');

    // Create a default filter profile with the first drive ID
    const defaultProfile = await filterService.createProfile({
      name: 'Default Audio Collection',
      description: 'Main audio file collection',
      is_active: true
    });

    if (defaultProfile) {
      console.log(`✅ Created profile: ${defaultProfile.name} (ID: ${defaultProfile.id})`);
      
      // Add the first drive ID to this profile
      if (uniqueDriveIds.length > 0) {
        const success = await filterService.addDrivesToProfile(defaultProfile.id, [uniqueDriveIds[0]]);
        if (success) {
          console.log(`   Added drive ID: ${uniqueDriveIds[0]}`);
        }
      }
    }

    // Create additional sample profiles if we have more drive IDs
    if (uniqueDriveIds.length > 1) {
      const specialProfile = await filterService.createProfile({
        name: 'Special Topics',
        description: 'Focused collection of special topic audio files',
        is_active: false
      });

      if (specialProfile && uniqueDriveIds.length > 1) {
        console.log(`✅ Created profile: ${specialProfile.name} (ID: ${specialProfile.id})`);
        const success = await filterService.addDrivesToProfile(specialProfile.id, [uniqueDriveIds[1]]);
        if (success) {
          console.log(`   Added drive ID: ${uniqueDriveIds[1]}`);
        }
      }
    }

    // List all profiles
    console.log('\nAll filter profiles:');
    const allProfiles = await filterService.listProfiles();
    allProfiles.forEach(profile => {
      console.log(`  - ${profile.name} ${profile.is_active ? '(Active)' : ''}`);
    });

  } catch (error) {
    console.error('Error creating sample filters:', error);
  }
}

// Run the script
createSampleFilters();