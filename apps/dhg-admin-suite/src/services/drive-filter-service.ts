import { FilterService } from '@shared/services/filter-service/filter-service';
import { supabase } from '../lib/supabase';

// Create a singleton instance for the browser environment
export const driveFilterService = new FilterService(supabase as any);

// Export convenient methods for the UI
export const filterServiceMethods = {
  // Profile management
  createProfile: (name: string, description?: string) => 
    driveFilterService.createProfile({ name, description, is_active: false }),
    
  updateProfile: (profileId: string, updates: { name?: string; description?: string }) =>
    driveFilterService.updateProfile(profileId, updates),
    
  deleteProfile: (profileId: string) =>
    driveFilterService.deleteProfile(profileId),
    
  listProfiles: () =>
    driveFilterService.listProfiles(),
    
  setActiveProfile: (profileId: string) =>
    driveFilterService.setActiveProfile(profileId),
    
  getActiveProfile: () =>
    driveFilterService.getActiveProfile(),
    
  loadActiveProfile: () =>
    driveFilterService.loadActiveProfile(),
    
  // Drive management
  addDrivesToProfile: (profileId: string, driveIds: string[]) =>
    driveFilterService.addDrivesToProfile(profileId, driveIds),
    
  removeDrivesFromProfile: (profileId: string, driveIds: string[]) =>
    driveFilterService.removeDrivesFromProfile(profileId, driveIds),
    
  getProfileDriveIds: (profileId: string) =>
    driveFilterService.getProfileDriveIds(profileId),
};