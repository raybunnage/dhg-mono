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
      
      // First verify the table structure by checking a single row
      const { data: sampleData, error: sampleError } = await supabase
        .from('user_filter_profile_drives')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('FilterServiceAdapter: Error checking profile drives table:', sampleError);
        return [];
      }
      
      // Debug output to see the actual structure of the table
      if (sampleData && sampleData.length > 0) {
        console.log('FilterServiceAdapter: Sample drive profile data:', sampleData[0]);
        console.log('FilterServiceAdapter: Available fields:', Object.keys(sampleData[0]));
      }
      
      // Now fetch the actual drives for this profile
      // Dynamically determine which field to use based on what's available
      let driveField = 'root_drive_id'; // Default field name
      if (sampleData && sampleData.length > 0) {
        const fields = Object.keys(sampleData[0]);
        if (fields.includes('drive_id')) {
          driveField = 'drive_id';
        }
      }
      
      const { data, error } = await supabase
        .from('user_filter_profile_drives')
        .select(driveField)
        .eq('profile_id', profileId);
      
      if (error) {
        console.error('FilterServiceAdapter: Error fetching profile drives:', error);
        return [];
      }
      
      const driveIds = data.map(item => item[driveField]);
      console.log(`FilterServiceAdapter: Found ${driveIds.length} drives for profile ${profileId} using field '${driveField}':`, driveIds);
      
      // Cache the results
      this.profileDrivesCache.set(profileId, driveIds);
      
      return driveIds;
    } catch (err) {
      console.error('FilterServiceAdapter: Error in getProfileDriveIds:', err);
      return [];
    }
  }
  
  // Clear drives cache for a specific profile
  clearDrivesCache(profileId: string) {
    this.profileDrivesCache.delete(profileId);
  }
  
  // Apply filter to a query based on active profile
  async applyFilterToQuery(query: any, activeProfileId?: string): Promise<any> {
    if (!activeProfileId) {
      const activeProfile = await this.loadActiveProfile();
      if (!activeProfile) {
        console.log('FilterServiceAdapter: No active profile found for filtering');
        return query;
      }
      activeProfileId = activeProfile.id;
    }
    
    // Get drive IDs for this profile
    const driveIds = await this.getProfileDriveIds(activeProfileId);
    
    if (driveIds.length > 0) {
      console.log(`FilterServiceAdapter: Applying filter with ${driveIds.length} drive IDs:`, driveIds);
      
      try {
        // This approach uses filtering on the high_level_folder_source_id directly
        // We first need to get the ID values for sources_google records that match our drive IDs
        const { data: matchingSources, error: sourcesError } = await supabase
          .from('sources_google')
          .select('id')
          .in('drive_id', driveIds);
        
        if (sourcesError) {
          console.error('Error finding source IDs for drive filter:', sourcesError);
          return query;
        }
        
        // If we have matching sources, filter presentations by high_level_folder_source_id
        if (matchingSources && matchingSources.length > 0) {
          const sourceIds = matchingSources.map(src => src.id);
          console.log(`FilterServiceAdapter: Found ${sourceIds.length} matching source IDs`);
          
          // Apply the filter to the query
          query = query.in('high_level_folder_source_id', sourceIds);
        } else {
          console.log('FilterServiceAdapter: No matching sources found for the given drive IDs');
        }
      } catch (err) {
        console.error('Error applying drive filter:', err);
      }
    } else {
      console.log('FilterServiceAdapter: No drive IDs found for filtering');
    }
    
    return query;
  }
}

// Export singleton instance
export const filterService = new FilterService();