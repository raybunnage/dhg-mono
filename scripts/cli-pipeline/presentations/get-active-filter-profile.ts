import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import type { Database } from '../../../supabase/types';

type UserFilterProfile = Database['public']['Tables']['user_filter_profiles']['Row'];
type UserFilterProfileDrive = Database['public']['Tables']['user_filter_profile_drives']['Row'];

export interface ActiveFilterProfile {
  profile: UserFilterProfile;
  rootDriveId: string | null;
}

/**
 * Get the active user filter profile and its associated root_drive_id
 * @returns The active filter profile and root_drive_id, or null if none is active
 */
export async function getActiveFilterProfile(): Promise<ActiveFilterProfile | null> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get the active user filter profile
    const { data: activeProfile, error: profileError } = await supabase
      .from('user_filter_profiles')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // No active profile found
        console.log('No active user filter profile found');
        return null;
      }
      throw profileError;
    }
    
    if (!activeProfile) {
      return null;
    }
    
    // Get the associated drive for this profile
    const { data: profileDrive, error: driveError } = await supabase
      .from('user_filter_profile_drives')
      .select('root_drive_id')
      .eq('profile_id', activeProfile.id)
      .single();
    
    if (driveError) {
      if (driveError.code === 'PGRST116') {
        // No drive associated with this profile
        console.warn(`Active profile "${activeProfile.name}" has no associated drive`);
        return {
          profile: activeProfile,
          rootDriveId: null
        };
      }
      throw driveError;
    }
    
    return {
      profile: activeProfile,
      rootDriveId: profileDrive?.root_drive_id || null
    };
  } catch (error) {
    console.error('Error getting active filter profile:', error);
    throw error;
  }
}

/**
 * Check if a given root_drive_id matches the active filter profile
 * @param rootDriveId The root_drive_id to check
 * @returns true if the drive matches the active filter or if no filter is active
 */
export async function matchesActiveFilter(rootDriveId: string | null): Promise<boolean> {
  const activeFilter = await getActiveFilterProfile();
  
  // If no active filter, allow all drives
  if (!activeFilter || !activeFilter.rootDriveId) {
    return true;
  }
  
  // Check if the drive matches the active filter
  return rootDriveId === activeFilter.rootDriveId;
}

/**
 * Get a SQL WHERE clause for filtering by active profile's root_drive_id
 * @returns SQL WHERE clause string or empty string if no filter is active
 */
export async function getActiveFilterWhereClause(): Promise<string> {
  const activeFilter = await getActiveFilterProfile();
  
  if (!activeFilter || !activeFilter.rootDriveId) {
    return '';
  }
  
  return `root_drive_id = '${activeFilter.rootDriveId}'`;
}