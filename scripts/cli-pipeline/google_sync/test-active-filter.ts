#!/usr/bin/env ts-node

import { getActiveFilterProfile } from './get-active-filter-profile';

async function testActiveFilter() {
  console.log('Testing active filter profile retrieval...\n');
  
  try {
    const activeFilter = await getActiveFilterProfile();
    
    if (activeFilter) {
      console.log('✅ Active filter profile found:');
      console.log(`   Profile Name: ${activeFilter.profile.name}`);
      console.log(`   Profile ID: ${activeFilter.profile.id}`);
      console.log(`   Is Active: ${activeFilter.profile.is_active}`);
      console.log(`   Root Drive ID: ${activeFilter.rootDriveId || 'None'}`);
      
      if (activeFilter.rootDriveId) {
        console.log('\n🔍 The sync command will filter on this root_drive_id');
      } else {
        console.log('\n⚠️  No root_drive_id associated with this profile');
      }
    } else {
      console.log('❌ No active filter profile found');
      console.log('   The sync command will use the default folder');
    }
  } catch (error) {
    console.error('Error testing active filter:', error);
  }
  
  process.exit(0);
}

testActiveFilter();