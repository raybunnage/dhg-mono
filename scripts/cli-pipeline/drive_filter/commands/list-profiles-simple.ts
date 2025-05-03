#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

// Simple script to list all profiles for development
async function listProfiles() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const { data: profiles, error } = await supabase
      .from('user_filter_profiles')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error listing profiles:', error);
      process.exit(1);
    }
    
    console.log('Filter Profiles:');
    console.log('===============');
    
    if (!profiles || profiles.length === 0) {
      console.log('No profiles found');
      process.exit(0);
    }
    
    // Print header
    console.log('ID                                   | Name                 | Description                      | Active');
    console.log('------------------------------------ | -------------------- | -------------------------------- | ------');
    
    // Print each profile
    profiles.forEach(profile => {
      const id = profile.id.padEnd(36, ' ');
      const name = (profile.name || '').padEnd(20, ' ');
      const description = (profile.description || '').padEnd(32, ' ');
      const active = profile.is_active ? '✓' : '';
      
      console.log(`${id} | ${name} | ${description} | ${active}`);
    });
    
    console.log(`\nTotal profiles: ${profiles.length}`);
    
    // Show active profile
    const activeProfile = profiles.find(p => p.is_active);
    if (activeProfile) {
      console.log(`Active profile: ${activeProfile.name} (${activeProfile.id})`);
    } else {
      console.log('No active profile set');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the function directly
listProfiles();