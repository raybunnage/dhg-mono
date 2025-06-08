/**
 * Browser-specific User Profile Service
 * 
 * This wraps the shared user profile service but uses the browser-specific Supabase client
 */

import { supabase } from '../lib/supabase';
import type { ProfileFormData } from '@shared/services/user-profile-service';

export interface ProfileResult {
  success: boolean;
  profile?: any;
  error?: string;
}

class UserProfileBrowserService {
  private supabase = supabase;

  /**
   * Create or update a user profile
   */
  async createProfile(userId: string, profileData: ProfileFormData): Promise<ProfileResult> {
    try {
      console.log('[UserProfileBrowser] Creating profile for user:', userId);
      
      // First check if profile already exists
      const { data: existing, error: checkError } = await this.supabase
        .from('auth_user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[UserProfileBrowser] Error checking existing profile:', checkError);
        return { success: false, error: checkError.message };
      }

      const profileRecord = {
        ...profileData,
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing) {
        // Update existing profile
        result = await this.supabase
          .from('auth_user_profiles')
          .update(profileRecord)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        // Create new profile
        result = await this.supabase
          .from('auth_user_profiles')
          .insert({
            id: userId, // Add the required id field
            ...profileRecord,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error('[UserProfileBrowser] Error saving profile:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log('[UserProfileBrowser] Profile saved successfully');
      return { success: true, profile: result.data };
    } catch (error) {
      console.error('[UserProfileBrowser] Unexpected error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save profile' 
      };
    }
  }

  /**
   * Get a user profile
   */
  async getProfile(userId: string): Promise<ProfileResult> {
    try {
      const { data, error } = await this.supabase
        .from('auth_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, profile: null };
        }
        return { success: false, error: error.message };
      }

      return { success: true, profile: data };
    } catch (error) {
      console.error('[UserProfileBrowser] Error getting profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get profile' 
      };
    }
  }
}

// Export singleton instance
export const userProfileBrowserService = new UserProfileBrowserService();