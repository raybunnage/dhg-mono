/**
 * DHG Audio Auth Service
 * 
 * A thin wrapper around the shared light-auth-enhanced-service
 * Provides app-specific authentication logic while using shared services
 * 
 * This replaces the multiple auth service files with a single clean implementation
 */

import type { ProfileFormData as ComponentProfileFormData } from '@shared/components/profile/ProfileForm';
import type { User } from '@supabase/supabase-js';
import { lightAuthBrowserService } from './light-auth-browser-service';

// Use the browser-specific service instead of the shared one
const getLightAuthEnhanced = async () => lightAuthBrowserService;

// Re-export types for backward compatibility
export type LightAuthUser = User;
export type ProfileFormData = ComponentProfileFormData;

// Service-specific ProfileFormData type to match what the service expects
type ServiceProfileFormData = ComponentProfileFormData;

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
function convertToServiceProfile(componentProfile: ComponentProfileFormData): ServiceProfileFormData {
  return componentProfile;
}

/**
 * DHG Audio Authentication Service
 * Uses the enhanced shared auth service for all operations
 */
class DhgAudioAuthService {
  private static instance: DhgAudioAuthService;
  private readonly STORAGE_KEY = 'dhg_auth_user';

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DhgAudioAuthService {
    if (!DhgAudioAuthService.instance) {
      DhgAudioAuthService.instance = new DhgAudioAuthService();
    }
    return DhgAudioAuthService.instance;
  }

  /**
   * Login with email
   */
  async login(email: string): Promise<LightAuthResult> {
    try {
      const lightAuthEnhanced = await getLightAuthEnhanced();
      const result = await lightAuthEnhanced.login(email);
      
      // Save to localStorage with app-specific key
      if (result.success && result.user) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result.user));
      }

      return {
        success: result.success,
        user: result.user,
        error: result.error,
        needsProfile: result.needsProfile
      };
    } catch (error) {
      console.error('Login error in dhg-audio-auth-service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication service initialization failed'
      };
    }
  }

  /**
   * Register with profile (for non-whitelisted users)
   */
  async registerWithProfile(email: string, name: string, profile: ComponentProfileFormData): Promise<LightAuthResult> {
    const lightAuthEnhanced = await getLightAuthEnhanced();
    const result = await lightAuthEnhanced.registerWithProfile({
      email,
      name,
      profile: convertToServiceProfile(profile)
    });

    // Save to localStorage with app-specific key
    if (result.success && result.user) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result.user));
    }

    return {
      success: result.success,
      user: result.user,
      error: result.error,
      needsProfile: false
    };
  }

  /**
   * Complete profile for whitelisted user
   */
  async completeProfile(userId: string, profile: ComponentProfileFormData): Promise<boolean> {
    console.log('[dhg-audio-auth-service] completeProfile called with userId:', userId);
    console.log('[dhg-audio-auth-service] profile data:', profile);
    
    const lightAuthEnhanced = await getLightAuthEnhanced();
    const serviceProfile = convertToServiceProfile(profile);
    console.log('[dhg-audio-auth-service] converted profile:', serviceProfile);
    
    const success = await lightAuthEnhanced.completeProfile(userId, serviceProfile);
    
    if (success) {
      // Update localStorage to reflect profile completion
      const user = this.getCurrentUser();
      if (user) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      }
    }

    return success;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    // Don't use shared service for getCurrentUser to avoid async issues
    // Just use localStorage directly
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to parse stored user:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }

    return null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      const lightAuthEnhanced = await getLightAuthEnhanced();
      await lightAuthEnhanced.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      const lightAuthEnhanced = await getLightAuthEnhanced();
      return await lightAuthEnhanced.getUserProfile(userId);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { success: false, error: 'Failed to load profile' };
    }
  }

  /**
   * Check if onboarding is complete
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const lightAuthEnhanced = await getLightAuthEnhanced();
    return lightAuthEnhanced.hasCompletedOnboarding(userId);
  }
}

// Export singleton instance
export const dhgAudioAuth = DhgAudioAuthService.getInstance();