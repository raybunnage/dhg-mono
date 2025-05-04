import { supabase } from './supabase-adapter';

// Types for filter service that match what's in the database
export interface FilterProfile {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FilterProfileDrive {
  id: string;
  profile_id: string;
  root_drive_id: string;
  include_children?: boolean | null;
}

// Filter service implementation
class FilterService {
  // Cache for profile drives
  private profileDrivesCache: Map<string, string[]> = new Map();
  
  // List all available filter profiles
  async listProfiles(): Promise<FilterProfile[]> {
    try {
      console.log('FilterServiceAdapter: Fetching profiles from database with simplified query');
      
      // Use exactly the same query that works in Supabase
      const { data, error } = await supabase
        .from('user_filter_profiles')
        .select('id, name, is_active')
        .order('name');
      
      if (error) {
        console.error('FilterServiceAdapter: Error fetching filter profiles:', error);
        console.error('FilterServiceAdapter: Error details:', JSON.stringify(error, null, 2));
        return [];
      }
      
      console.log('FilterServiceAdapter: Found', data?.length || 0, 'profiles');
      
      if (data && data.length > 0) {
        console.log('FilterServiceAdapter: First profile fields:', Object.keys(data[0]).join(', '));
        console.log('FilterServiceAdapter: Profile names:', data.map(p => p.name).join(', '));
        console.log('FilterServiceAdapter: Profile IDs:', data.map(p => p.id).join(', '));
        
        data.forEach(profile => {
          console.log(`FilterServiceAdapter: Profile ${profile.id}: Name=${profile.name}, IsActive=${profile.is_active}`);
        });
        
        // Convert to our interface
        const profiles: FilterProfile[] = data.map(p => ({
          id: p.id,
          name: p.name,
          is_active: p.is_active || false
        }));
        
        return profiles;
      }
      
      return [];
    } catch (err) {
      console.error('FilterServiceAdapter: Error in listProfiles:', err);
      if (err instanceof Error) {
        console.error('FilterServiceAdapter: Error details:', err.message);
        console.error('FilterServiceAdapter: Error stack:', err.stack);
      }
      return [];
    }
  }
  
  // Get the currently active filter profile
  async loadActiveProfile(): Promise<FilterProfile | null> {
    try {
      console.log('FilterServiceAdapter: Fetching active profile with simplified query');
      
      const { data, error } = await supabase
        .from('user_filter_profiles')
        .select('id, name, is_active')
        .eq('is_active', true)
        .limit(1);
      
      if (error) {
        console.error('FilterServiceAdapter: Error fetching active filter profile:', error);
        console.error('FilterServiceAdapter: Error details:', JSON.stringify(error, null, 2));
        return null;
      }
      
      if (data && data.length > 0) {
        console.log('FilterServiceAdapter: Found active profile with ID:', data[0].id);
        console.log(`FilterServiceAdapter: Active profile ${data[0].id}: Name=${data[0].name}`);
        
        // Convert to our interface
        const profile: FilterProfile = {
          id: data[0].id,
          name: data[0].name,
          is_active: true
        };
        
        // Preload drive IDs for this profile
        await this.getProfileDriveIds(profile.id);
        
        return profile;
      } else {
        console.log('FilterServiceAdapter: No active profile found');
        return null;
      }
    } catch (err) {
      console.error('FilterServiceAdapter: Error in loadActiveProfile:', err);
      if (err instanceof Error) {
        console.error('FilterServiceAdapter: Error details:', err.message);
        console.error('FilterServiceAdapter: Error stack:', err.stack);
      }
      return null;
    }
  }
  
  // Set a profile as active (deactivates all others)
  async setActiveProfile(profileId: string): Promise<boolean> {
    try {
      console.log(`FilterServiceAdapter: Setting profile ${profileId} as active`);
      
      // First deactivate all profiles
      const { error: deactivateError } = await supabase
        .from('user_filter_profiles')
        .update({ is_active: false })
        .not('id', 'is', null);
      
      if (deactivateError) {
        console.error('Error deactivating profiles:', deactivateError);
        return false;
      }
      
      // Then activate the selected profile
      const { error: activateError } = await supabase
        .from('user_filter_profiles')
        .update({ is_active: true })
        .eq('id', profileId);
      
      if (activateError) {
        console.error('Error activating profile:', activateError);
        return false;
      }
      
      // Preload drive IDs for this profile
      await this.getProfileDriveIds(profileId);
      
      return true;
    } catch (err) {
      console.error('Error in setActiveProfile:', err);
      return false;
    }
  }
  
  // Get all drive IDs associated with a profile
  async getProfileDriveIds(profileId: string): Promise<string[]> {
    try {
      // Check cache first
      if (this.profileDrivesCache.has(profileId)) {
        console.log(`FilterServiceAdapter: Using cached drives for profile ${profileId}`);
        return this.profileDrivesCache.get(profileId) || [];
      }
      
      console.log(`FilterServiceAdapter: Fetching drives for profile ${profileId}`);
      
      // First verify the profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('user_filter_profiles')
        .select('name, is_active')
        .eq('id', profileId)
        .single();
        
      if (profileError) {
        console.error(`FilterServiceAdapter: Error fetching profile ${profileId}:`, profileError);
        // Instead of throwing, return empty array
        return [];
      }
      
      if (!profileData) {
        console.error(`FilterServiceAdapter: Profile ${profileId} not found in database!`);
        return [];
      }
      
      console.log(`FilterServiceAdapter: Found profile ${profileId} - Name: ${profileData.name}, Is Active: ${profileData.is_active}`);
      
      // Now get all the root_drive_ids for this profile
      console.log(`FilterServiceAdapter: Retrieving root_drive_ids for profile ${profileId}`);
      
      // Direct query - we know the field is root_drive_id
      const { data, error } = await supabase
        .from('user_filter_profile_drives')
        .select('root_drive_id')  // Using the correct field name
        .eq('profile_id', profileId);
      
      if (error) {
        console.error('FilterServiceAdapter: Error fetching profile drives:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log(`FilterServiceAdapter: No drives found for profile ${profileId} (${profileData.name})`);
        // Return empty array instead of throwing
        return [];
      }
      
      // Extract the root_drive_ids
      const driveIds = data
        .map(item => item.root_drive_id)
        .filter(id => id !== null && id !== undefined);
      
      console.log(`FilterServiceAdapter: Found ${driveIds.length} root_drive_ids for profile ${profileId}:`, driveIds);
      
      // Cache the results
      this.profileDrivesCache.set(profileId, driveIds);
      
      return driveIds;
    } catch (err) {
      console.error('FilterServiceAdapter: Error in getProfileDriveIds:', err);
      // Return empty array instead of throwing
      return [];
    }
  }
  
  // Clear drives cache for a specific profile
  clearDrivesCache(profileId: string) {
    this.profileDrivesCache.delete(profileId);
  }
  
  // Apply filter to a query based on active profile
  async applyFilterToQuery(query: any, activeProfileId?: string): Promise<any> {
    try {
      if (!activeProfileId) {
        const activeProfile = await this.loadActiveProfile();
        if (!activeProfile) {
          console.log('FilterServiceAdapter: No active profile found for filtering');
          return query;
        }
        activeProfileId = activeProfile.id;
      }
      
      console.log(`FilterServiceAdapter: Applying filter for profile ${activeProfileId}`);
      
      // Get root_drive_ids for this profile from user_filter_profile_drives
      const rootDriveIds = await this.getProfileDriveIds(activeProfileId);
      
      // If no drive IDs found, return unfiltered query
      if (!rootDriveIds || rootDriveIds.length === 0) {
        console.log('FilterServiceAdapter: No root_drive_ids found for this profile, returning unfiltered query');
        return query;
      }
      
      console.log(`FilterServiceAdapter: Using ${rootDriveIds.length} root_drive_ids for filtering:`, rootDriveIds);
      
      try {
        // First count how many total presentations and sources we have for reference
        const { count: totalPresentations } = await supabase
          .from('presentations')
          .select('id', { count: 'exact', head: true });
        
        console.log(`FilterServiceAdapter: Total presentations before filtering: ${totalPresentations}`);
      } catch (countErr) {
        console.error('FilterServiceAdapter: Error counting presentations:', countErr);
        // Continue despite counting error
      }
      
      try {
        // Get all sources where root_drive_id matches one of our allowed drive IDs
        console.log('FilterServiceAdapter: Finding sources with matching root_drive_id...');
        const { data: matchingSources, error: sourcesError } = await supabase
          .from('sources_google')
          .select('id, name, root_drive_id')
          .in('root_drive_id', rootDriveIds);
        
        if (sourcesError) {
          console.error('FilterServiceAdapter: Error querying sources with root_drive_id:', sourcesError);
          return query; // Return unfiltered query on error
        }
        
        if (!matchingSources || matchingSources.length === 0) {
          console.log('FilterServiceAdapter: No sources found with matching root_drive_id');
          // Return unmodified query instead of empty result
          return query;
        }
        
        // We have matching sources with our root_drive_ids
        console.log(`FilterServiceAdapter: Found ${matchingSources.length} sources with matching root_drive_id`);
        
        // Show a few examples for diagnostics
        if (matchingSources.length > 0) {
          console.log('FilterServiceAdapter: Sample matches:');
          matchingSources.slice(0, 3).forEach(src => {
            console.log(`- ${src.name} (root_drive_id: ${src.root_drive_id}, id: ${src.id})`);
          });
        }
        
        // Get the source IDs to use in our presentation filter
        const sourceIds = matchingSources.map(src => src.id);
        
        // Always use the array parameter form of in() for better stability with large arrays
        console.log(`FilterServiceAdapter: Using stable array form with ${sourceIds.length} source IDs`);
        
        // Extract a smaller batch if there are too many IDs (Supabase has URL length limits)
        const maxSourceIds = 500;
        if (sourceIds.length > maxSourceIds) {
          console.log(`FilterServiceAdapter: Limiting to ${maxSourceIds} source IDs due to URL length constraints`);
          const limitedSourceIds = sourceIds.slice(0, maxSourceIds);
          return query.in('video_source_id', limitedSourceIds);
        }
        
        // Use array parameter form instead of string interpolation for better stability
        return query.in('video_source_id', sourceIds);
      } catch (innerError) {
        console.error('FilterServiceAdapter: Inner error in filtering:', innerError);
        // Return original query if anything fails
        return query;
      }
    } catch (err) {
      console.error('FilterServiceAdapter: Error in applyFilterToQuery:', err);
      // Return unfiltered query on any error
      return query;
    }
  }
}

// Export singleton instance
export const filterService = new FilterService();