import { SupabaseClientService } from '../../services/supabase-client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a filter profile that can be applied to queries
 */
export interface FilterProfile {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  filter_criteria?: {
    mime_types?: string[];
    document_types?: string[];
    experts?: string[];
    folders?: string[];
    path_patterns?: string[];
    date_range?: {
      start?: string;
      end?: string;
    };
    other_criteria?: Record<string, any>;
  };
}

/**
 * Represents an excluded drive for a filter profile
 */
export interface FilterProfileDrive {
  id: string;
  profile_id: string;
  drive_id: string;
  created_at?: string;
}

/**
 * Singleton service for managing filter profiles and applying filters to queries
 */
export class FilterService {
  private static instance: FilterService;
  private activeProfile: FilterProfile | null = null;
  private supabase = SupabaseClientService.getInstance().getClient();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the FilterService
   * @returns The FilterService instance
   */
  public static getInstance(): FilterService {
    if (!FilterService.instance) {
      FilterService.instance = new FilterService();
    }
    return FilterService.instance;
  }

  /**
   * Loads a filter profile by ID
   * @param profileId - The ID of the profile to load
   * @returns The loaded profile or null if not found
   */
  public async loadProfile(profileId: string): Promise<FilterProfile | null> {
    const { data, error } = await this.supabase
      .from('user_filter_profiles')
      .select(`
        *
      `)
      .eq('id', profileId)
      .single();

    if (error) {
      console.error('Error loading filter profile:', error);
      return null;
    }

    const profile = data as FilterProfile;
    
    // Update the active profile
    this.activeProfile = profile;
    return profile;
  }

  /**
   * Loads the currently active filter profile
   * @returns The active profile or null if none is active
   */
  public async loadActiveProfile(): Promise<FilterProfile | null> {
    const { data, error } = await this.supabase
      .from('user_filter_profiles')
      .select(`
        *
      `)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error loading active filter profile:', error);
      return null;
    }

    this.activeProfile = data as FilterProfile;
    return this.activeProfile;
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
        .from('user_filter_profiles')
        .update({ is_active: false })
        .not('id', 'eq', profileId);

      if (deactivateError) {
        console.error('Error deactivating other profiles:', deactivateError);
        return false;
      }

      // Then activate the specified profile
      const { error: activateError } = await this.supabase
        .from('user_filter_profiles')
        .update({ is_active: true })
        .eq('id', profileId);

      if (activateError) {
        console.error('Error activating profile:', activateError);
        return false;
      }

      // Load the newly activated profile
      await this.loadProfile(profileId);
      return true;
    } catch (error) {
      console.error('Error setting active profile:', error);
      return false;
    }
  }

  /**
   * Creates a new filter profile
   * @param profile - The profile to create
   * @returns The created profile with ID or null if creation failed
   */
  public async createProfile(profile: Omit<FilterProfile, 'id'>): Promise<FilterProfile | null> {
    const newProfile = {
      ...profile,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('user_filter_profiles')
      .insert(newProfile)
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
   * @param profile - The profile with updated values
   * @returns The updated profile or null if update failed
   */
  public async updateProfile(profile: FilterProfile): Promise<FilterProfile | null> {
    const updatedProfile = {
      ...profile,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('user_filter_profiles')
      .update(updatedProfile)
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating filter profile:', error);
      return null;
    }

    // If this is the active profile, update the cached copy
    if (this.activeProfile && this.activeProfile.id === profile.id) {
      this.activeProfile = data as FilterProfile;
    }

    return data as FilterProfile;
  }

  /**
   * Deletes a filter profile
   * @param profileId - The ID of the profile to delete
   * @returns True if successful, false otherwise
   */
  public async deleteProfile(profileId: string): Promise<boolean> {
    // First delete any associated drives
    const { error: drivesError } = await this.supabase
      .from('user_filter_profile_drives')
      .delete()
      .eq('profile_id', profileId);

    if (drivesError) {
      console.error('Error deleting profile drives:', drivesError);
      return false;
    }

    // Then delete the profile itself
    const { error } = await this.supabase
      .from('user_filter_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      console.error('Error deleting filter profile:', error);
      return false;
    }

    // If we deleted the active profile, clear it
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
    const { data, error } = await this.supabase
      .from('user_filter_profiles')
      .select(`
        *
      `)
      .order('name');

    if (error) {
      console.error('Error listing filter profiles:', error);
      return [];
    }

    return data as FilterProfile[];
  }

  /**
   * Adds a drive ID to be excluded by a filter profile
   * @param profileId - The profile ID
   * @param driveId - The drive ID to exclude
   * @returns The created drive filter record or null if creation failed
   */
  public async addDriveToProfile(profileId: string, driveId: string): Promise<FilterProfileDrive | null> {
    const newDrive = {
      id: uuidv4(),
      profile_id: profileId,
      drive_id: driveId,
      created_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('user_filter_profile_drives')
      .insert(newDrive)
      .select()
      .single();

    if (error) {
      console.error('Error adding drive to filter profile:', error);
      return null;
    }

    return data as FilterProfileDrive;
  }

  /**
   * Removes a drive ID from a filter profile
   * @param profileId - The profile ID
   * @param driveId - The drive ID to remove
   * @returns True if successful, false otherwise
   */
  public async removeDriveFromProfile(profileId: string, driveId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('user_filter_profile_drives')
      .delete()
      .eq('profile_id', profileId)
      .eq('drive_id', driveId);

    if (error) {
      console.error('Error removing drive from filter profile:', error);
      return false;
    }

    return true;
  }

  /**
   * Lists all drive IDs excluded by a filter profile
   * @param profileId - The profile ID
   * @returns Array of drive IDs or empty array if none found
   */
  public async listDrivesForProfile(profileId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_filter_profile_drives')
      .select('drive_id')
      .eq('profile_id', profileId);

    if (error) {
      console.error('Error listing drives for filter profile:', error);
      return [];
    }

    return data.map(item => item.drive_id);
  }

  /**
   * Applies the filter criteria from the active profile to a Supabase query
   * @param query - The Supabase query to modify
   * @returns The modified query with filters applied
   */
  public applyFilterToQuery(query: any): any {
    if (!this.activeProfile || !this.activeProfile.filter_criteria) {
      return query;
    }

    const criteria = this.activeProfile.filter_criteria;

    // Apply mime type filters if specified
    if (criteria.mime_types && criteria.mime_types.length > 0) {
      query = query.in('mime_type', criteria.mime_types);
    }

    // Apply document type filters if specified
    if (criteria.document_types && criteria.document_types.length > 0) {
      query = query.in('document_type_id', criteria.document_types);
    }

    // Apply expert filters if specified
    if (criteria.experts && criteria.experts.length > 0) {
      query = query.in('expert_id', criteria.experts);
    }

    // Apply folder filters if specified
    if (criteria.folders && criteria.folders.length > 0) {
      query = query.in('parent_folder_id', criteria.folders);
    }

    // Apply date range filters if specified
    if (criteria.date_range) {
      if (criteria.date_range.start) {
        query = query.gte('created_at', criteria.date_range.start);
      }
      if (criteria.date_range.end) {
        query = query.lte('created_at', criteria.date_range.end);
      }
    }

    return query;
  }

  /**
   * Creates a SQL migration for the necessary filter tables
   * @returns The SQL statements for creating the tables
   */
  public static generateMigrationSQL(): string {
    return `
-- Create filter profiles table
CREATE TABLE IF NOT EXISTS user_filter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  filter_criteria JSONB
);

-- Create filter profile drives table for excluding specific drives
CREATE TABLE IF NOT EXISTS user_filter_profile_drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  profile_id UUID NOT NULL REFERENCES user_filter_profiles(id) ON DELETE CASCADE,
  drive_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (profile_id, drive_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_filter_profiles_active ON user_filter_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_profile_drives_profile_id ON user_filter_profile_drives(profile_id);
    `;
  }
}

// Export a singleton instance
export const filterService = FilterService.getInstance();