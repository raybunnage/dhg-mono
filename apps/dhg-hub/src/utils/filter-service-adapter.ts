/**
 * Filter Service Adapter for dhg-hub
 * 
 * This adapter wraps the shared filter service to provide backward compatibility
 * for the dhg-hub app while using the centralized filter service.
 */

import { FilterService, FilterProfile, FilterProfileDrive } from '../../../../packages/shared/services/filter-service';
import { supabaseBrowser } from '../services/supabase-browser-adapter';

// Re-export types for backward compatibility
export type { FilterProfile, FilterProfileDrive };

// Create an instance of the shared FilterService with dhg-hub's configured Supabase client
const sharedFilterService = new FilterService(supabaseBrowser.getClient() as any);

// Create a wrapper class that delegates to the shared service
class FilterServiceAdapter {
  // List all available filter profiles
  async listProfiles(): Promise<FilterProfile[]> {
    console.log('FilterServiceAdapter: Delegating to shared filter service');
    return sharedFilterService.listProfiles();
  }
  
  // Get the currently active filter profile
  async loadActiveProfile(): Promise<FilterProfile | null> {
    console.log('FilterServiceAdapter: Delegating to shared filter service');
    return sharedFilterService.loadActiveProfile();
  }
  
  // Set a profile as active (deactivates all others)
  async setActiveProfile(profileId: string): Promise<boolean> {
    console.log(`FilterServiceAdapter: Delegating to shared filter service for profile ${profileId}`);
    return sharedFilterService.setActiveProfile(profileId);
  }
  
  // Get all drive IDs associated with a profile
  async getProfileDriveIds(profileId: string): Promise<string[]> {
    console.log(`FilterServiceAdapter: Delegating to shared filter service for profile ${profileId}`);
    return sharedFilterService.getProfileDriveIds(profileId);
  }
  
  // Clear drives cache for a specific profile
  clearDrivesCache(profileId: string): void {
    console.log(`FilterServiceAdapter: Delegating cache clear to shared filter service`);
    sharedFilterService.clearDrivesCache(profileId);
  }
  
  // Apply filter to a query based on active profile
  async applyFilterToQuery(query: any, activeProfileId?: string): Promise<any> {
    console.log('FilterServiceAdapter: Delegating to shared filter service');
    return sharedFilterService.applyFilterToQuery(query, activeProfileId);
  }
}

// Export singleton instance
export const filterService = new FilterServiceAdapter();