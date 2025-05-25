/**
 * Light Auth Service for dhg-audio app
 * 
 * Implements lightweight authentication:
 * - Check if email is on whitelist (allowed_emails)
 * - If not, collect comprehensive profile and auto-add
 * - No email verification required
 * - Uses allowed_emails.id as universal user ID
 * - Integrates with user_profiles_v2 table
 */

import { lightAuthService } from '@shared/services/light-auth-service';
import { userProfileService, type ProfileFormData } from '@shared/services/user-profile-service';
import type { User, Session } from '@supabase/supabase-js';

// Export User type as LightAuthUser for consistency
export type LightAuthUser = User;

export interface LightAuthResult {
  success: boolean;
  user?: LightAuthUser;
  session?: Session;
  error?: string;
  needsProfile?: boolean;
}

export interface UserRegistrationData {
  email: string;
  name: string;
  profile: ProfileFormData;
}

/**
 * Enhanced Light Auth Service for dhg-audio
 * Handles authentication and comprehensive profile collection
 */
class DhgAudioLightAuthService {
  private static instance: DhgAudioLightAuthService;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DhgAudioLightAuthService {
    if (!DhgAudioLightAuthService.instance) {
      DhgAudioLightAuthService.instance = new DhgAudioLightAuthService();
    }
    return DhgAudioLightAuthService.instance;
  }

  /**
   * Attempt to login with email
   * Returns needsProfile=true if email not on whitelist
   */
  async login(email: string): Promise<LightAuthResult> {
    try {
      // Check if email is allowed
      const loginResult = await lightAuthService.login(email);
      
      if (!loginResult.success) {
        // Email not on whitelist - they need to fill profile
        return {
          success: false,
          needsProfile: true,
          error: 'Please complete your profile to continue'
        };
      }

      // Email is allowed - check if they have a profile
      if (loginResult.user) {
        const profileResult = await userProfileService.getProfile(loginResult.user.id);
        
        // If no profile exists, they need to complete it
        if (!profileResult.profile) {
          return {
            success: true,
            user: loginResult.user,
            session: loginResult.session,
            needsProfile: true
          };
        }
      }

      return {
        success: true,
        user: loginResult.user,
        session: loginResult.session,
        needsProfile: false
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  /**
   * Register new user with comprehensive profile
   */
  async registerWithProfile(data: UserRegistrationData): Promise<LightAuthResult> {
    try {
      // First, register the user (adds to allowed_emails)
      const registerResult = await lightAuthService.registerUser({
        email: data.email,
        name: data.name,
        profession: data.profile.profession,
        organization: data.profile.industry_sectors?.[0],
        professional_interests: data.profile.interested_topics.join(', ')
      });

      if (!registerResult.success || !registerResult.user) {
        return {
          success: false,
          error: registerResult.error || 'Registration failed'
        };
      }

      // Now save their comprehensive profile
      const profileResult = await userProfileService.saveProfile(
        registerResult.user.id,
        data.profile
      );

      if (!profileResult.success) {
        // Profile save failed, but user is registered
        console.error('Failed to save profile:', profileResult.error);
        // Continue anyway - they can update profile later
      }

      return {
        success: true,
        user: registerResult.user,
        session: registerResult.session,
        needsProfile: false
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  /**
   * Update user profile for existing user
   */
  async updateProfile(userId: string, profile: ProfileFormData): Promise<boolean> {
    try {
      const result = await userProfileService.saveProfile(userId, profile);
      return result.success;
    } catch (error) {
      console.error('Profile update error:', error);
      return false;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return lightAuthService.getCurrentUser();
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string) {
    return userProfileService.getProfile(userId);
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    return userProfileService.hasCompletedOnboarding(userId);
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    return lightAuthService.logout();
  }

  /**
   * Get profile completion stats
   */
  async getProfileStats(userId: string) {
    return userProfileService.getProfileStats(userId);
  }

  /**
   * Get recommended content based on profile
   */
  async getRecommendedTopics(userId: string): Promise<string[]> {
    return userProfileService.getRecommendedTopics(userId);
  }
}

// Export singleton instance
export const dhgAudioLightAuth = DhgAudioLightAuthService.getInstance();