import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Represents a filter profile that can be applied to queries
 */
export interface FilterProfile {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean | null;
  created_at?: string | null;
}

/**
 * Represents a drive association for a filter profile
 */
export interface FilterProfileDrive {
  id: string;
  profile_id: string | null;
  root_drive_id: string;
  include_children?: boolean | null;
}

/**
 * Service for managing filter profiles and applying filters to queries
 * This service accepts a Supabase client to work in different environments
 */
export class FilterService {
  private activeProfile: FilterProfile | null = null;
  private profileDrivesCache: Map<string, string[]> = new Map();
  private supabase: SupabaseClient<any>;

  /**
   * Constructor that accepts a configured Supabase client
   * @param supabaseClient - The Supabase client to use for database operations
   */
  constructor(supabaseClient: SupabaseClient<any>) {
    this.supabase = supabaseClient;
  }

  /**
   * Loads a filter profile by ID
   * @param profileId - The ID of the profile to load
   * @returns The loaded profile or null if not found
   */
  public async loadProfile(profileId: string): Promise<FilterProfile | null> {
    const { data, error } = await this.supabase
      .from('filter_user_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (error) {
      console.error('Error loading filter profile:', error);
      return null;
    }

    const profile = data as FilterProfile;
    
    // Update the active profile
    this.activeProfile = profile;
    
    // Preload drive IDs for this profile
    await this.getProfileDriveIds(profileId);
    
    return profile;
  }

  /**
   * Loads the currently active filter profile
   * @returns The active profile or null if none is active
   */
  public async loadActiveProfile(): Promise<FilterProfile | null> {
    const { data, error } = await this.supabase
      .from('filter_user_profiles')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error loading active filter profile:', error);
      return null;
    }

    if (data && data.length > 0) {
      this.activeProfile = data[0] as FilterProfile;
      
      // Preload drive IDs for this profile
      await this.getProfileDriveIds(this.activeProfile.id);
      
      return this.activeProfile;
    }
    
    return null;
  }

  /**
   * Gets the currently active filter profile
   * @returns The active profile or null if none is loaded
   */
  public getActiveProfile(): FilterProfile | null {
    return this.activeProfile;
  }

  /**
   * Sets a profile as active and deactivates all others
   * @param profileId - The ID of the profile to set as active
   * @returns True if successful, false otherwise
   */
  public async setActiveProfile(profileId: string): Promise<boolean> {
    try {
      // First deactivate all profiles
      const { error: deactivateError } = await this.supabase
        .from('filter_user_profiles')
        .update({ is_active: false })
        .not('id', 'is', null);

      if (deactivateError) {
        console.error('Error deactivating other profiles:', deactivateError);
        return false;
      }

      // Then activate the specified profile
      const { error: activateError } = await this.supabase
        .from('filter_user_profiles')
        .update({ is_active: true })
        .eq('id', profileId);

      if (activateError) {
        console.error('Error activating profile:', activateError);
        return false;
      }

      // Clear cache and load the newly activated profile
      this.profileDrivesCache.clear();
      await this.loadProfile(profileId);
      return true;
    } catch (error) {
      console.error('Error setting active profile:', error);
      return false;
    }
  }

  /**
   * Get all drive IDs associated with a profile
   * @param profileId - The profile ID
   * @returns Array of root drive IDs
   */
  public async getProfileDriveIds(profileId: string): Promise<string[]> {
    try {
      // Check cache first
      if (this.profileDrivesCache.has(profileId)) {
        console.log(`FilterService: Using cached drives for profile ${profileId}`);
        return this.profileDrivesCache.get(profileId) || [];
      }
      
      console.log(`FilterService: Fetching drives for profile ${profileId}`);
      
      const { data, error } = await this.supabase
        .from('filter_user_profile_drives')
        .select('root_drive_id')
        .eq('profile_id', profileId);
      
      if (error) {
        console.error('FilterService: Error fetching profile drives:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log(`FilterService: No drives found for profile ${profileId}`);
        return [];
      }
      
      // Extract the root_drive_ids
      const driveIds = data
        .map(item => item.root_drive_id)
        .filter(id => id !== null && id !== undefined);
      
      console.log(`FilterService: Found ${driveIds.length} root_drive_ids for profile ${profileId}`);
      
      // Cache the results
      this.profileDrivesCache.set(profileId, driveIds);
      
      return driveIds;
    } catch (err) {
      console.error('FilterService: Error in getProfileDriveIds:', err);
      return [];
    }
  }
  
  /**
   * Clear drives cache for a specific profile or all profiles
   * @param profileId - Optional profile ID to clear cache for
   */
  public clearDrivesCache(profileId?: string): void {
    if (profileId) {
      this.profileDrivesCache.delete(profileId);
    } else {
      this.profileDrivesCache.clear();
    }
  }

  /**
   * Creates a new filter profile
   * @param profile - The profile to create
   * @returns The created profile with ID or null if creation failed
   */
  public async createProfile(profile: Omit<FilterProfile, 'id' | 'created_at'>): Promise<FilterProfile | null> {
    const { data, error } = await this.supabase
      .from('filter_user_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error creating filter profile:', error);
      return null;
    }

    return data as FilterProfile;
  }

  /**
   * Updates an existing filter profile
   * @param profileId - The profile ID
   * @param updates - The fields to update
   * @returns True if successful, false otherwise
   */
  public async updateProfile(profileId: string, updates: Partial<Omit<FilterProfile, 'id' | 'created_at'>>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('filter_user_profiles')
        .update(updates)
        .eq('id', profileId);
      
      if (error) {
        console.error('FilterService: Error updating profile:', error);
        return false;
      }
      
      // Clear cache if name or description changed
      if (updates.name || updates.description) {
        this.clearDrivesCache(profileId);
      }
      
      // If this is the active profile, reload it
      if (this.activeProfile && this.activeProfile.id === profileId) {
        await this.loadProfile(profileId);
      }
      
      return true;
    } catch (err) {
      console.error('FilterService: Error in updateProfile:', err);
      return false;
    }
  }

  /**
   * Deletes a filter profile
   * @param profileId - The ID of the profile to delete
   * @returns True if successful, false otherwise
   */
  public async deleteProfile(profileId: string): Promise<boolean> {
    // First delete any associated drives
    const { error: drivesError } = await this.supabase
      .from('filter_user_profile_drives')
      .delete()
      .eq('profile_id', profileId);

    if (drivesError) {
      console.error('Error deleting profile drives:', drivesError);
      return false;
    }

    // Then delete the profile itself
    const { error } = await this.supabase
      .from('filter_user_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      console.error('Error deleting filter profile:', error);
      return false;
    }

    // Clear cache and active profile if needed
    this.clearDrivesCache(profileId);
    if (this.activeProfile && this.activeProfile.id === profileId) {
      this.activeProfile = null;
    }

    return true;
  }

  /**
   * Lists all available filter profiles
   * @returns Array of filter profiles or empty array if none found
   */
  public async listProfiles(): Promise<FilterProfile[]> {
    try {
      console.log('FilterService: Fetching filter profiles from database');
      
      const { data, error } = await this.supabase
        .from('filter_user_profiles')
        .select('*')
        .order('name');

      if (error) {
        console.error('FilterService: Error listing filter profiles:', error);
        return [];
      }

      console.log('FilterService: Found', data?.length || 0, 'profiles in database');
      
      if (!data || data.length === 0) {
        console.warn('FilterService: No filter profiles found in database');
      } else {
        console.log('FilterService: Profile IDs found:', data.map(p => p.id).join(', '));
      }
      
      return data as FilterProfile[];
    } catch (err) {
      console.error('FilterService: Unexpected error in listProfiles:', err);
      return [];
    }
  }

  /**
   * Adds drive IDs to a filter profile
   * @param profileId - The profile ID
   * @param driveIds - Array of root drive IDs to add
   * @returns True if successful, false otherwise
   */
  public async addDrivesToProfile(profileId: string, driveIds: string[]): Promise<boolean> {
    try {
      const drivesToAdd = driveIds.map(driveId => ({
        profile_id: profileId,
        root_drive_id: driveId,
        include_children: true
      }));
      
      const { error } = await this.supabase
        .from('filter_user_profile_drives')
        .insert(drivesToAdd);
      
      if (error) {
        console.error('FilterService: Error adding drives to profile:', error);
        return false;
      }
      
      // Clear cache for this profile
      this.clearDrivesCache(profileId);
      
      return true;
    } catch (err) {
      console.error('FilterService: Error in addDrivesToProfile:', err);
      return false;
    }
  }

  /**
   * Removes drive IDs from a filter profile
   * @param profileId - The profile ID
   * @param driveIds - Array of root drive IDs to remove
   * @returns True if successful, false otherwise
   */
  public async removeDrivesFromProfile(profileId: string, driveIds: string[]): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('filter_user_profile_drives')
        .delete()
        .eq('profile_id', profileId)
        .in('root_drive_id', driveIds);
      
      if (error) {
        console.error('FilterService: Error removing drives from profile:', error);
        return false;
      }
      
      // Clear cache for this profile
      this.clearDrivesCache(profileId);
      
      return true;
    } catch (err) {
      console.error('FilterService: Error in removeDrivesFromProfile:', err);
      return false;
    }
  }

  /**
   * Lists all drive IDs for a filter profile (alias for getProfileDriveIds)
   * @param profileId - The profile ID
   * @returns Array of root drive IDs or empty array if none found
   */
  public async listDrivesForProfile(profileId: string): Promise<string[]> {
    return this.getProfileDriveIds(profileId);
  }

  /**
   * Apply filter to a query based on active profile
   * This method modifies a Supabase query to filter results based on the active profile's drive IDs
   * @param query - The Supabase query to modify
   * @param activeProfileId - Optional profile ID (uses active profile if not provided)
   * @returns The modified query with filters applied
   */
  public async applyFilterToQuery(
    query: any,
    activeProfileId?: string
  ): Promise<any> {
    try {
      if (!activeProfileId) {
        const activeProfile = await this.loadActiveProfile();
        if (!activeProfile) {
          console.log('FilterService: No active profile found for filtering');
          return query;
        }
        activeProfileId = activeProfile.id;
      }
      
      console.log(`FilterService: Applying filter for profile ${activeProfileId}`);
      
      // Get root_drive_ids for this profile
      const rootDriveIds = await this.getProfileDriveIds(activeProfileId);
      
      if (!rootDriveIds || rootDriveIds.length === 0) {
        console.log('FilterService: No root_drive_ids found for this profile, returning unfiltered query');
        return query;
      }
      
      console.log(`FilterService: Using ${rootDriveIds.length} root_drive_ids for filtering`);
      
      // Get all sources where root_drive_id matches one of our allowed drive IDs
      const { data: matchingSources, error: sourcesError } = await this.supabase
        .from('google_sources')
        .select('id')
        .in('root_drive_id', rootDriveIds);
      
      if (sourcesError) {
        console.error('FilterService: Error querying sources with root_drive_id:', sourcesError);
        return query; // Return unfiltered query on error
      }
      
      if (!matchingSources || matchingSources.length === 0) {
        console.log('FilterService: No sources found with matching root_drive_id');
        return query;
      }
      
      console.log(`FilterService: Found ${matchingSources.length} sources with matching root_drive_id`);
      
      // Get the source IDs to use in our filter
      const sourceIds = matchingSources.map(src => src.id);
      
      // Apply filter to query
      // Limit to 1500 source IDs to avoid URL length issues
      const maxSourceIds = 1500;
      if (sourceIds.length > maxSourceIds) {
        console.log(`FilterService: Limiting to ${maxSourceIds} source IDs due to URL length constraints`);
        const limitedSourceIds = sourceIds.slice(0, maxSourceIds);
        return query.in('video_source_id', limitedSourceIds);
      }
      
      return query.in('video_source_id', sourceIds);
    } catch (err) {
      console.error('FilterService: Error in applyFilterToQuery:', err);
      return query; // Return unfiltered query on any error
    }
  }

  /**
   * Creates a SQL migration for the necessary filter tables
   * @returns The SQL statements for creating the tables
   */
  public static generateMigrationSQL(): string {
    return `
-- Create filter profiles table
CREATE TABLE IF NOT EXISTS filter_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create filter profile drives table for including specific root drives
CREATE TABLE IF NOT EXISTS filter_user_profile_drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  profile_id UUID REFERENCES filter_user_profiles(id) ON DELETE CASCADE,
  root_drive_id TEXT NOT NULL,
  include_children BOOLEAN DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_filter_profiles_active ON filter_user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_profile_drives_profile_id ON filter_user_profile_drives(profile_id);
CREATE INDEX IF NOT EXISTS idx_filter_profile_drives_root_drive_id ON filter_user_profile_drives(root_drive_id);
    `;
  }
}

// Note: No longer exporting a singleton instance
// Each environment should create its own instance with the appropriate Supabase client
// Example: const filterService = new FilterService(supabaseClient);