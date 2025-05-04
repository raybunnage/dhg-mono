import { supabase } from './supabase-adapter';

// Types for filter service
export interface FilterProfile {
  id: string;
  name: string;
  description?: string;
  filter_config: any;
  is_active: boolean;
  created_at?: string;
}

// Filter service implementation
class FilterService {
  // List all available filter profiles
  async listProfiles(): Promise<FilterProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_filter_profiles')
        .select('*');
      
      if (error) {
        console.error('Error fetching filter profiles:', error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error('Error in listProfiles:', err);
      return [];
    }
  }
  
  // Get the currently active filter profile
  async loadActiveProfile(): Promise<FilterProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_filter_profiles')
        .select('*')
        .eq('is_active', true)
        .limit(1);
      
      if (error) {
        console.error('Error fetching active filter profile:', error);
        return null;
      }
      
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error('Error in loadActiveProfile:', err);
      return null;
    }
  }
  
  // Set a profile as active (deactivates all others)
  async setActiveProfile(profileId: string): Promise<boolean> {
    try {
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
      
      return true;
    } catch (err) {
      console.error('Error in setActiveProfile:', err);
      return false;
    }
  }
  
  // Apply filter to a query based on active profile
  applyFilterToQuery(query: any): any {
    // This is a simplified implementation
    // In a real scenario, this would parse the filter_config and apply appropriate filters
    return query;
  }
}

// Export singleton instance
export const filterService = new FilterService();