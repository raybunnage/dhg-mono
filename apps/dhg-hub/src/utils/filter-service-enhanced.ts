import { FilterService, FilterProfile } from '@root/packages/shared/services/filter-service/filter-service';
import { supabase } from './supabase-adapter';

/**
 * Enhanced Filter Service for dhg-hub
 * Uses the shared FilterService with presentation-specific filtering
 */
class EnhancedFilterService {
  private filterService: FilterService;
  
  constructor() {
    this.filterService = new FilterService(supabase);
  }
  
  // Delegate all basic operations to the shared service
  async listProfiles(): Promise<FilterProfile[]> {
    return this.filterService.listProfiles();
  }
  
  async loadActiveProfile(): Promise<FilterProfile | null> {
    return this.filterService.loadActiveProfile();
  }
  
  async setActiveProfile(profileId: string): Promise<boolean> {
    return this.filterService.setActiveProfile(profileId);
  }
  
  async getProfileDriveIds(profileId: string): Promise<string[]> {
    return this.filterService.getProfileDriveIds(profileId);
  }
  
  clearDrivesCache(profileId: string): void {
    this.filterService.clearDrivesCache(profileId);
  }
  
  // Presentations-specific filtering (dhg-hub's main use case)
  async applyFilterToQuery(query: any, activeProfileId?: string): Promise<any> {
    return this.filterService.applyFilterToQuery(query, {
      activeProfileId,
      filterType: 'presentations',
      sourceTable: 'sources_google'
    });
  }
  
  // Additional dhg-hub specific methods if needed
  async getActiveProfileDriveIds(): Promise<string[]> {
    const activeProfile = await this.loadActiveProfile();
    if (!activeProfile) {
      return [];
    }
    return this.getProfileDriveIds(activeProfile.id);
  }
}

// Export singleton instance (dhg-hub pattern)
export const filterService = new EnhancedFilterService();

// Also export the types for convenience
export type { FilterProfile } from '@root/packages/shared/services/filter-service/filter-service';