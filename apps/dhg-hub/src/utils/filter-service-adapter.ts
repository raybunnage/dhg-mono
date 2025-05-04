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
      
      // First check if the table exists by getting a sample row
      console.log('FilterServiceAdapter: Checking user_filter_profile_drives table structure...');
      const { data: sampleData, error: sampleError } = await supabase
        .from('user_filter_profile_drives')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('FilterServiceAdapter: Error checking profile drives table:', sampleError);
        console.error('FilterServiceAdapter: Error details:', JSON.stringify(sampleError, null, 2));
        
        // If the table doesn't exist, we need to handle that case
        // We'll return an empty array
        if (sampleError.code === 'PGRST116') {
          console.log('FilterServiceAdapter: Table user_filter_profile_drives does not exist, returning all drives');
          
          // In this case, return all drives (no filtering)
          return [];
        }
        
        return [];
      }
      
      // Debug output to see the actual structure of the table
      if (sampleData && sampleData.length > 0) {
        console.log('FilterServiceAdapter: Sample drive profile data:', sampleData[0]);
        console.log('FilterServiceAdapter: Available fields:', Object.keys(sampleData[0]));
      } else {
        console.log('FilterServiceAdapter: No sample data found in user_filter_profile_drives table');
      }
      
      // Now fetch the actual drives for this profile
      // Dynamically determine which field to use based on what's available
      let driveField = 'root_drive_id'; // Default field name
      if (sampleData && sampleData.length > 0) {
        const fields = Object.keys(sampleData[0]);
        console.log('FilterServiceAdapter: Available fields in drive profile:', fields);
        
        if (fields.includes('drive_id')) {
          driveField = 'drive_id';
        }
      }
      
      console.log(`FilterServiceAdapter: Using field '${driveField}' for drive ID`);
      
      const { data, error } = await supabase
        .from('user_filter_profile_drives')
        .select(driveField)
        .eq('profile_id', profileId);
      
      if (error) {
        console.error('FilterServiceAdapter: Error fetching profile drives:', error);
        console.error('FilterServiceAdapter: Error details:', JSON.stringify(error, null, 2));
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log(`FilterServiceAdapter: No drives found for profile ${profileId}`);
        
        // No drives found for this profile, disable filtering
        return [];
      }
      
      const driveIds = data.map(item => item[driveField]).filter(id => id !== null && id !== undefined);
      console.log(`FilterServiceAdapter: Found ${driveIds.length} drives for profile ${profileId} using field '${driveField}':`, driveIds);
      
      // Cache the results
      this.profileDrivesCache.set(profileId, driveIds);
      
      return driveIds;
    } catch (err) {
      console.error('FilterServiceAdapter: Error in getProfileDriveIds:', err);
      if (err instanceof Error) {
        console.error('FilterServiceAdapter: Error details:', err.message, err.stack);
      }
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
    
    try {
      // Get drive IDs for this profile
      const driveIds = await this.getProfileDriveIds(activeProfileId);
      
      // If no drive IDs are found, don't apply any filter - show all presentations
      if (!driveIds || driveIds.length === 0) {
        console.log('FilterServiceAdapter: No drive IDs found for this profile, showing all presentations');
        return query;
      }
      
      console.log(`FilterServiceAdapter: Applying filter with ${driveIds.length} drive IDs:`, driveIds);
      
      // Approach 1: Try to filter by drive_id if available in high_level_folder
      try {
        // First try to get a sample row to see if we have the high_level_folder and what fields it has
        const testQuery = query.limit(1);
        const { data: testData, error: testError } = await testQuery;
        
        if (!testError && testData && testData.length > 0) {
          const samplePresentation = testData[0];
          
          console.log('FilterServiceAdapter: Sample presentation structure:', 
            Object.keys(samplePresentation).join(', '));
          
          // First check if we have high_level_folder
          if (samplePresentation.high_level_folder) {
            console.log('FilterServiceAdapter: high_level_folder is available in presentations');
            
            if (samplePresentation.high_level_folder.drive_id) {
              console.log('FilterServiceAdapter: drive_id is available in high_level_folder');
              
              // Use the foreign key relation to filter directly
              return query.in('high_level_folder.drive_id', driveIds);
            }
          }
        }
      } catch (err) {
        console.error('FilterServiceAdapter: Error testing high_level_folder structure:', err);
        // Continue to fallback method
      }
      
      // Fallback approach: Get the source IDs from sources_google that match our drive IDs
      try {
        console.log('FilterServiceAdapter: Using fallback filtering method with source IDs');
        
        const { data: matchingSources, error: sourcesError } = await supabase
          .from('sources_google')
          .select('id')
          .in('drive_id', driveIds);
        
        if (sourcesError) {
          console.error('FilterServiceAdapter: Error finding source IDs for drive filter:', sourcesError);
          console.error('FilterServiceAdapter: Error details:', JSON.stringify(sourcesError, null, 2));
          // If we fail at this point, don't apply any filter
          return query;
        }
        
        // If we have matching sources, filter presentations by high_level_folder_source_id
        if (matchingSources && matchingSources.length > 0) {
          const sourceIds = matchingSources.map(src => src.id);
          console.log(`FilterServiceAdapter: Found ${sourceIds.length} matching source IDs`);
          
          // Apply the filter to the query
          return query.in('high_level_folder_source_id', sourceIds);
        } else {
          console.log('FilterServiceAdapter: No matching sources found for the given drive IDs');
          
          // If we don't find any matching sources but have drive IDs, return empty result
          // This indicates a configuration issue
          console.log('FilterServiceAdapter: Configuration issue - no sources match the configured drive IDs');
          
          // Return a query that will return no results (using an impossible condition)
          return query.eq('id', 'no-match-force-empty-results');
        }
      } catch (err) {
        console.error('FilterServiceAdapter: Error in fallback filter method:', err);
        if (err instanceof Error) {
          console.error('FilterServiceAdapter: Error details:', err.message, err.stack);
        }
        // If all attempts fail, don't apply any filter
        return query;
      }
    } catch (err) {
      console.error('FilterServiceAdapter: Error in applyFilterToQuery:', err);
      if (err instanceof Error) {
        console.error('FilterServiceAdapter: Error details:', err.message, err.stack);
      }
      // If all attempts fail, don't apply any filter
      return query;
    }
  }
}

// Export singleton instance
export const filterService = new FilterService();