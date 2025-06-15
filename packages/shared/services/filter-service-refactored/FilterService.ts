import { BusinessService } from '../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../base-classes/BaseService';

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
 * Metrics for FilterService tracking
 */
interface FilterServiceMetrics {
  profilesLoaded: number;
  profilesCreated: number;
  profilesUpdated: number;
  profilesDeleted: number;
  drivesAdded: number;
  drivesRemoved: number;
  queriesFiltered: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
}

/**
 * Service for managing filter profiles and applying filters to queries
 * Extends BusinessService for proper dependency injection and lifecycle management
 */
export class FilterService extends BusinessService {
  private activeProfile: FilterProfile | null = null;
  private profileDrivesCache: Map<string, string[]> = new Map();
  private metrics: FilterServiceMetrics = {
    profilesLoaded: 0,
    profilesCreated: 0,
    profilesUpdated: 0,
    profilesDeleted: 0,
    drivesAdded: 0,
    drivesRemoved: 0,
    queriesFiltered: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0
  };

  /**
   * Constructor that accepts a configured Supabase client and optional logger
   * @param supabase - The Supabase client to use for database operations
   * @param logger - Optional logger for structured logging
   */
  constructor(
    private supabase: SupabaseClient<any>,
    logger?: Logger
  ) {
    super('FilterService', { supabase }, logger);
  }

  /**
   * Validate that all required dependencies are provided
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabase) {
      throw new Error('SupabaseClient is required');
    }
  }

  /**
   * BaseService requirement: Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('FilterService: Initializing service');
    // Clear any stale cache on initialization
    this.profileDrivesCache.clear();
    this.activeProfile = null;
  }

  /**
   * BaseService requirement: Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    this.logger?.info('FilterService: Cleaning up resources');
    this.profileDrivesCache.clear();
    this.activeProfile = null;
  }

  /**
   * BaseService requirement: Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connectivity by counting profiles
      const { count, error } = await this.supabase
        .from('filter_user_profiles')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return {
        healthy: true,
        details: {
          profileCount: count || 0,
          activeProfile: this.activeProfile?.name || 'none',
          cacheSize: this.profileDrivesCache.size,
          metrics: this.getMetrics()
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger?.error('FilterService: Health check failed', error);
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          metrics: this.getMetrics()
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): FilterServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Loads a filter profile by ID
   * @param profileId - The ID of the profile to load
   * @returns The loaded profile or null if not found
   */
  public async loadProfile(profileId: string): Promise<FilterProfile | null> {
    try {
      this.logger?.debug('FilterService: Loading profile', { profileId });
      
      const { data, error } = await this.supabase
        .from('filter_user_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) {
        this.logger?.error('FilterService: Error loading filter profile', error);
        this.metrics.errors++;
        return null;
      }

      const profile = data as FilterProfile;
      
      // Update the active profile
      this.activeProfile = profile;
      
      // Preload drive IDs for this profile
      await this.getProfileDriveIds(profileId);
      
      this.metrics.profilesLoaded++;
      this.logger?.info('FilterService: Profile loaded successfully', { profileId, profileName: profile.name });
      
      return profile;
    } catch (error) {
      this.logger?.error('FilterService: Unexpected error loading profile', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Loads the currently active filter profile
   * @returns The active profile or null if none is active
   */
  public async loadActiveProfile(): Promise<FilterProfile | null> {
    try {
      this.logger?.debug('FilterService: Loading active profile');
      
      const { data, error } = await this.supabase
        .from('filter_user_profiles')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (error) {
        this.logger?.error('FilterService: Error loading active filter profile', error);
        this.metrics.errors++;
        return null;
      }

      if (data && data.length > 0) {
        this.activeProfile = data[0] as FilterProfile;
        
        // Preload drive IDs for this profile
        await this.getProfileDriveIds(this.activeProfile.id);
        
        this.metrics.profilesLoaded++;
        this.logger?.info('FilterService: Active profile loaded', { profileId: this.activeProfile.id, profileName: this.activeProfile.name });
        
        return this.activeProfile;
      }
      
      this.logger?.warn('FilterService: No active profile found');
      return null;
    } catch (error) {
      this.logger?.error('FilterService: Unexpected error loading active profile', error);
      this.metrics.errors++;
      return null;
    }
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
      this.logger?.info('FilterService: Setting active profile', { profileId });
      
      // First deactivate all profiles
      const { error: deactivateError } = await this.supabase
        .from('filter_user_profiles')
        .update({ is_active: false })
        .not('id', 'is', null);

      if (deactivateError) {
        this.logger?.error('FilterService: Error deactivating other profiles', deactivateError);
        this.metrics.errors++;
        return false;
      }

      // Then activate the specified profile
      const { error: activateError } = await this.supabase
        .from('filter_user_profiles')
        .update({ is_active: true })
        .eq('id', profileId);

      if (activateError) {
        this.logger?.error('FilterService: Error activating profile', activateError);
        this.metrics.errors++;
        return false;
      }

      // Clear cache and load the newly activated profile
      this.profileDrivesCache.clear();
      await this.loadProfile(profileId);
      
      this.logger?.info('FilterService: Active profile set successfully', { profileId });
      return true;
    } catch (error) {
      this.logger?.error('FilterService: Error setting active profile', error);
      this.metrics.errors++;
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
        this.logger?.debug('FilterService: Using cached drives for profile', { profileId });
        this.metrics.cacheHits++;
        return this.profileDrivesCache.get(profileId) || [];
      }
      
      this.metrics.cacheMisses++;
      this.logger?.debug('FilterService: Fetching drives for profile', { profileId });
      
      const { data, error } = await this.supabase
        .from('filter_user_profile_drives')
        .select('root_drive_id')
        .eq('profile_id', profileId);
      
      if (error) {
        this.logger?.error('FilterService: Error fetching profile drives', error);
        this.metrics.errors++;
        return [];
      }
      
      if (!data || data.length === 0) {
        this.logger?.debug('FilterService: No drives found for profile', { profileId });
        return [];
      }
      
      // Extract the root_drive_ids
      const driveIds = data
        .map(item => item.root_drive_id)
        .filter(id => id !== null && id !== undefined);
      
      this.logger?.debug('FilterService: Found drives for profile', { profileId, driveCount: driveIds.length });
      
      // Cache the results
      this.profileDrivesCache.set(profileId, driveIds);
      
      return driveIds;
    } catch (err) {
      this.logger?.error('FilterService: Error in getProfileDriveIds', err);
      this.metrics.errors++;
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
      this.logger?.debug('FilterService: Cleared cache for profile', { profileId });
    } else {
      this.profileDrivesCache.clear();
      this.logger?.debug('FilterService: Cleared all drives cache');
    }
  }

  /**
   * Creates a new filter profile
   * @param profile - The profile to create
   * @returns The created profile with ID or null if creation failed
   */
  public async createProfile(profile: Omit<FilterProfile, 'id' | 'created_at'>): Promise<FilterProfile | null> {
    try {
      this.logger?.info('FilterService: Creating new profile', { profileName: profile.name });
      
      const { data, error } = await this.supabase
        .from('filter_user_profiles')
        .insert(profile)
        .select()
        .single();

      if (error) {
        this.logger?.error('FilterService: Error creating filter profile', error);
        this.metrics.errors++;
        return null;
      }

      this.metrics.profilesCreated++;
      this.logger?.info('FilterService: Profile created successfully', { profileId: data.id, profileName: data.name });
      
      return data as FilterProfile;
    } catch (error) {
      this.logger?.error('FilterService: Unexpected error creating profile', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Updates an existing filter profile
   * @param profileId - The profile ID
   * @param updates - The fields to update
   * @returns True if successful, false otherwise
   */
  public async updateProfile(profileId: string, updates: Partial<Omit<FilterProfile, 'id' | 'created_at'>>): Promise<boolean> {
    try {
      this.logger?.info('FilterService: Updating profile', { profileId, updates });
      
      const { error } = await this.supabase
        .from('filter_user_profiles')
        .update(updates)
        .eq('id', profileId);
      
      if (error) {
        this.logger?.error('FilterService: Error updating profile', error);
        this.metrics.errors++;
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
      
      this.metrics.profilesUpdated++;
      this.logger?.info('FilterService: Profile updated successfully', { profileId });
      
      return true;
    } catch (err) {
      this.logger?.error('FilterService: Error in updateProfile', err);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Deletes a filter profile
   * @param profileId - The ID of the profile to delete
   * @returns True if successful, false otherwise
   */
  public async deleteProfile(profileId: string): Promise<boolean> {
    try {
      this.logger?.info('FilterService: Deleting profile', { profileId });
      
      // First delete any associated drives
      const { error: drivesError } = await this.supabase
        .from('filter_user_profile_drives')
        .delete()
        .eq('profile_id', profileId);

      if (drivesError) {
        this.logger?.error('FilterService: Error deleting profile drives', drivesError);
        this.metrics.errors++;
        return false;
      }

      // Then delete the profile itself
      const { error } = await this.supabase
        .from('filter_user_profiles')
        .delete()
        .eq('id', profileId);

      if (error) {
        this.logger?.error('FilterService: Error deleting filter profile', error);
        this.metrics.errors++;
        return false;
      }

      // Clear cache and active profile if needed
      this.clearDrivesCache(profileId);
      if (this.activeProfile && this.activeProfile.id === profileId) {
        this.activeProfile = null;
      }

      this.metrics.profilesDeleted++;
      this.logger?.info('FilterService: Profile deleted successfully', { profileId });
      
      return true;
    } catch (error) {
      this.logger?.error('FilterService: Unexpected error deleting profile', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Lists all available filter profiles
   * @returns Array of filter profiles or empty array if none found
   */
  public async listProfiles(): Promise<FilterProfile[]> {
    try {
      this.logger?.debug('FilterService: Fetching filter profiles from database');
      
      const { data, error } = await this.supabase
        .from('filter_user_profiles')
        .select('*')
        .order('name');

      if (error) {
        this.logger?.error('FilterService: Error listing filter profiles', error);
        this.metrics.errors++;
        return [];
      }

      this.logger?.debug('FilterService: Found profiles in database', { count: data?.length || 0 });
      
      if (!data || data.length === 0) {
        this.logger?.warn('FilterService: No filter profiles found in database');
      }
      
      return data as FilterProfile[];
    } catch (err) {
      this.logger?.error('FilterService: Unexpected error in listProfiles', err);
      this.metrics.errors++;
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
      this.logger?.info('FilterService: Adding drives to profile', { profileId, driveCount: driveIds.length });
      
      const drivesToAdd = driveIds.map(driveId => ({
        profile_id: profileId,
        root_drive_id: driveId,
        include_children: true
      }));
      
      const { error } = await this.supabase
        .from('filter_user_profile_drives')
        .insert(drivesToAdd);
      
      if (error) {
        this.logger?.error('FilterService: Error adding drives to profile', error);
        this.metrics.errors++;
        return false;
      }
      
      // Clear cache for this profile
      this.clearDrivesCache(profileId);
      
      this.metrics.drivesAdded += driveIds.length;
      this.logger?.info('FilterService: Drives added successfully', { profileId, driveCount: driveIds.length });
      
      return true;
    } catch (err) {
      this.logger?.error('FilterService: Error in addDrivesToProfile', err);
      this.metrics.errors++;
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
      this.logger?.info('FilterService: Removing drives from profile', { profileId, driveCount: driveIds.length });
      
      const { error } = await this.supabase
        .from('filter_user_profile_drives')
        .delete()
        .eq('profile_id', profileId)
        .in('root_drive_id', driveIds);
      
      if (error) {
        this.logger?.error('FilterService: Error removing drives from profile', error);
        this.metrics.errors++;
        return false;
      }
      
      // Clear cache for this profile
      this.clearDrivesCache(profileId);
      
      this.metrics.drivesRemoved += driveIds.length;
      this.logger?.info('FilterService: Drives removed successfully', { profileId, driveCount: driveIds.length });
      
      return true;
    } catch (err) {
      this.logger?.error('FilterService: Error in removeDrivesFromProfile', err);
      this.metrics.errors++;
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
   * Gets all drives for a profile with full details
   * @param profileId - The profile ID
   * @returns Array of drive mappings or empty array if none found
   */
  public async getProfileDrives(profileId: string): Promise<any[]> {
    try {
      this.logger?.debug('FilterService: Getting full drive details for profile', { profileId });
      
      const { data, error } = await this.supabase
        .from('filter_user_profile_drives')
        .select('*')
        .eq('profile_id', profileId);
      
      if (error) {
        this.logger?.error('FilterService: Error getting profile drives', error);
        this.metrics.errors++;
        return [];
      }
      
      this.logger?.debug('FilterService: Retrieved drive details', { profileId, driveCount: data?.length || 0 });
      
      return data || [];
    } catch (err) {
      this.logger?.error('FilterService: Error in getProfileDrives', err);
      this.metrics.errors++;
      return [];
    }
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
          this.logger?.debug('FilterService: No active profile found for filtering');
          return query;
        }
        activeProfileId = activeProfile.id;
      }
      
      this.logger?.debug('FilterService: Applying filter for profile', { activeProfileId });
      
      // Get root_drive_ids for this profile
      const rootDriveIds = await this.getProfileDriveIds(activeProfileId);
      
      if (!rootDriveIds || rootDriveIds.length === 0) {
        this.logger?.debug('FilterService: No root_drive_ids found for this profile, returning unfiltered query');
        return query;
      }
      
      this.logger?.debug('FilterService: Using root_drive_ids for filtering', { count: rootDriveIds.length });
      
      // Get all sources where root_drive_id matches one of our allowed drive IDs
      const { data: matchingSources, error: sourcesError } = await this.supabase
        .from('google_sources')
        .select('id')
        .in('root_drive_id', rootDriveIds);
      
      if (sourcesError) {
        this.logger?.error('FilterService: Error querying sources with root_drive_id', sourcesError);
        this.metrics.errors++;
        return query; // Return unfiltered query on error
      }
      
      if (!matchingSources || matchingSources.length === 0) {
        this.logger?.debug('FilterService: No sources found with matching root_drive_id');
        return query;
      }
      
      this.logger?.debug('FilterService: Found sources with matching root_drive_id', { count: matchingSources.length });
      
      // Get the source IDs to use in our filter
      const sourceIds = matchingSources.map(src => src.id);
      
      // Apply filter to query
      // Limit to 1500 source IDs to avoid URL length issues
      const maxSourceIds = 1500;
      if (sourceIds.length > maxSourceIds) {
        this.logger?.warn('FilterService: Limiting source IDs due to URL length constraints', { total: sourceIds.length, limit: maxSourceIds });
        const limitedSourceIds = sourceIds.slice(0, maxSourceIds);
        this.metrics.queriesFiltered++;
        return query.in('id', limitedSourceIds);
      }
      
      this.metrics.queriesFiltered++;
      return query.in('id', sourceIds);
    } catch (err) {
      this.logger?.error('FilterService: Error in applyFilterToQuery', err);
      this.metrics.errors++;
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

// FilterService is already exported above as export class