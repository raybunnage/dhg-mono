import type { ProfileFormData as ComponentProfileFormData } from '../../../../packages/shared/components/profile/ProfileForm';
import type { User } from '@supabase/supabase-js';
import { dhgHubLightAuthService } from './dhg-hub-light-auth-service';
import type { Database } from '../../../../supabase/types';

// Re-export types for backward compatibility
export type LightAuthUser = User;
export type ProfileFormData = ComponentProfileFormData;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  user_profile_id?: string;
  profile?: any | null;
}

export interface AuthResponse {
  user: AuthUser | null;
  error: Error | null;
}

export interface LightAuthResult {
  success: boolean;
  user?: LightAuthUser;
  error?: string;
  needsProfile?: boolean;
}

/**
 * Convert component ProfileFormData to service ProfileFormData
 * Since we're using browser-specific services, we can pass the profile data as-is
 */
function convertToServiceProfile(componentProfile: ComponentProfileFormData): ComponentProfileFormData {
  return componentProfile;
}

class DhgHubAuthService {
  private static instance: DhgHubAuthService;
  private lightAuthService = dhgHubLightAuthService;
  
  private constructor() {}
  
  static getInstance(): DhgHubAuthService {
    if (!DhgHubAuthService.instance) {
      DhgHubAuthService.instance = new DhgHubAuthService();
    }
    return DhgHubAuthService.instance;
  }
  
  async loginWithEmail(email: string): Promise<AuthResponse> {
    console.log('[DHG-HUB-AUTH-SERVICE] loginWithEmail called with:', email);
    try {
      console.log('[DHG-HUB-AUTH-SERVICE] Calling lightAuthService.login...');
      const response = await this.lightAuthService.login(email);
      console.log('[DHG-HUB-AUTH-SERVICE] Response from lightAuthService:', response);
      
      if (!response || !response.success) {
        console.log('[DHG-HUB-AUTH-SERVICE] Login failed:', response?.error);
        return {
          user: null,
          error: new Error(response?.error || 'Login failed')
        };
      }
      
      if (response.user) {
        console.log('[DHG-HUB-AUTH-SERVICE] Mapping user data...');
        const mappedUser: AuthUser = {
          id: response.user.id,
          email: response.user.email,
          role: response.user.role || 'user',
          created_at: response.user.created_at,
          last_login_at: response.user.last_login_at || null,
          user_profile_id: response.user.user_profile_id,
          profile: response.user.profile || null
        };
        
        console.log('[DHG-HUB-AUTH-SERVICE] Login successful, returning user:', mappedUser.id);
        return {
          user: mappedUser,
          error: null
        };
      }
      
      console.log('[DHG-HUB-AUTH-SERVICE] No user returned from login');
      return {
        user: null,
        error: new Error('No user returned')
      };
    } catch (error) {
      console.error('[DHG-HUB-AUTH-SERVICE] Login error:', error);
      return {
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async checkWhitelistStatus(email: string): Promise<{ isWhitelisted: boolean; error: Error | null }> {
    try {
      const result = await this.lightAuthService.checkWhitelistStatus(email);
      return result;
    } catch (error) {
      console.error('Whitelist check error:', error);
      return {
        isWhitelisted: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async registerWithProfile(email: string, profileData: ComponentProfileFormData): Promise<AuthResponse> {
    try {
      // Convert component profile data to service format
      const response = await this.lightAuthService.registerWithProfile({
        email,
        name: profileData.profession, // Use profession as the name
        profile: convertToServiceProfile(profileData)
      });
      
      if (!response || !response.success) {
        return {
          user: null,
          error: new Error(response?.error || 'Registration failed')
        };
      }
      
      if (response.user) {
        const mappedUser: AuthUser = {
          id: response.user.id,
          email: response.user.email,
          role: response.user.role || 'user',
          created_at: response.user.created_at,
          last_login_at: response.user.last_login_at || null,
          user_profile_id: response.user.user_profile_id,
          profile: response.user.profile || null
        };
        
        return {
          user: mappedUser,
          error: null
        };
      }
      
      return {
        user: null,
        error: new Error('No user returned')
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async createProfile(userId: string, profileData: ComponentProfileFormData): Promise<{ profile: any | null; error: Error | null }> {
    try {
      // Use the browser service with proper profile conversion
      const result = await this.lightAuthService.createProfile(userId, convertToServiceProfile(profileData));
      return result;
    } catch (error) {
      console.error('Profile creation error:', error);
      return {
        profile: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async completeProfile(userId: string, profileData: ComponentProfileFormData): Promise<LightAuthResult> {
    try {
      const result = await this.lightAuthService.completeProfile(userId, convertToServiceProfile(profileData));
      
      // Save updated user to localStorage
      if (result.success && result.user) {
        this.saveUser({
          id: result.user.id,
          email: result.user.email,
          role: result.user.role || 'user',
          created_at: result.user.created_at,
          last_login_at: result.user.last_login_at || null,
          user_profile_id: result.user.user_profile_id,
          profile: result.user.profile || null
        });
      }
      
      return {
        success: result.success,
        user: result.user,
        error: result.error,
        needsProfile: false
      };
    } catch (error) {
      console.error('Complete profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async logout(): Promise<void> {
    localStorage.removeItem('dhg_hub_auth_user');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dhg_hub_auth_user',
      newValue: null,
      storageArea: localStorage
    }));
  }
  
  getCurrentUser(): AuthUser | null {
    const userStr = localStorage.getItem('dhg_hub_auth_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  
  saveUser(user: AuthUser): void {
    localStorage.setItem('dhg_hub_auth_user', JSON.stringify(user));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dhg_hub_auth_user',
      newValue: JSON.stringify(user),
      storageArea: localStorage
    }));
  }
}

export const dhgHubAuthService = DhgHubAuthService.getInstance();