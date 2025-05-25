/**
 * Enhanced Light Auth Service - Shared Service
 * 
 * Combines lightweight authentication with comprehensive profile collection.
 * Built on top of existing light-auth-service and user-profile-service.
 * 
 * Features:
 * - Email whitelist authentication
 * - Automatic profile collection for non-whitelisted users
 * - Uses allowed_emails.id as universal user identifier
 * - Integrates with user_profiles_v2 table
 * - localStorage session persistence
 * 
 * Following CLAUDE.md:
 * - Singleton pattern
 * - Uses existing shared services
 * - No hardcoded credentials
 * - Proper TypeScript types
 */

import { lightAuthService } from '../light-auth-service';
import { userProfileService, type ProfileFormData } from '../user-profile-service';
import type { User, Session } from '@supabase/supabase-js';

// Re-export types for convenience
export type { ProfileFormData } from '../user-profile-service';
export type LightAuthUser = User;

export interface LightAuthEnhancedResult {
  success: boolean;
  user?: LightAuthUser;
  session?: Session;
  error?: string;
  needsProfile?: boolean;
  profileComplete?: boolean;
}

export interface UserRegistrationData {
  email: string;
  name: string;
  profile: ProfileFormData;
}

/**
 * Enhanced Light Auth Service
 * Provides complete authentication flow with profile management
 */
class LightAuthEnhancedService {
  private static instance: LightAuthEnhancedService;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LightAuthEnhancedService {
    if (!LightAuthEnhancedService.instance) {
      LightAuthEnhancedService.instance = new LightAuthEnhancedService();
    }
    return LightAuthEnhancedService.instance;
  }

  /**
   * Attempt to login with email
   * Returns needsProfile=true if email not on whitelist or profile incomplete
   */
  async login(email: string): Promise<LightAuthEnhancedResult> {
    try {
      // Check if email is allowed using base service
      const loginResult = await lightAuthService.login(email);
      
      if (!loginResult.success) {
        // Email not on whitelist - they need to fill profile
        return {
          success: false,
          needsProfile: true,
          error: 'Please complete your profile to continue'
        };
      }

      // Email is allowed - check if they have a complete profile
      if (loginResult.user) {
        const profileResult = await userProfileService.getProfile(loginResult.user.id);
        
        // Check if profile exists and is complete
        const hasProfile = profileResult.success && profileResult.profile;
        const profileComplete = hasProfile && profileResult.profile!.onboarding_completed === true;
        
        return {
          success: true,
          user: loginResult.user,
          session: loginResult.session,
          needsProfile: !profileComplete,
          profileComplete
        };
      }

      return {
        success: true,
        user: loginResult.user,
        session: loginResult.session,
        needsProfile: false,
        profileComplete: true
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed: ' + (error as Error).message
      };
    }
  }

  /**
   * Register new user with comprehensive profile
   * Adds to allowed_emails and creates profile in one operation
   */
  async registerWithProfile(data: UserRegistrationData): Promise<LightAuthEnhancedResult> {
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
        needsProfile: false,
        profileComplete: true
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed: ' + (error as Error).message
      };
    }
  }

  /**
   * Complete profile for existing whitelisted user
   */
  async completeProfile(userId: string, profile: ProfileFormData): Promise<boolean> {
    try {
      console.log('[LightAuthEnhanced] completeProfile called for userId:', userId);
      const result = await userProfileService.saveProfile(userId, profile);
      
      if (result.success) {
        // Update the user session to reflect profile completion
        const user = this.getCurrentUser();
        if (user) {
          user.user_metadata = {
            ...user.user_metadata,
            profile_complete: true
          };
          // Update localStorage
          localStorage.setItem('dhg-light-auth-user', JSON.stringify(user));
        }
      }
      
      return result.success;
    } catch (error) {
      console.error('Profile completion error:', error);
      return false;
    }
  }

  /**
   * Update user profile
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
   * Get current user from base service
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
   * Logout using base service
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

  /**
   * Check if email is allowed (whitelist check)
   */
  async isEmailAllowed(email: string): Promise<boolean> {
    return lightAuthService.isEmailAllowed(email);
  }

  /**
   * Get allowed emails list (admin function)
   */
  async getAllowedEmails() {
    return lightAuthService.getAllowedEmails();
  }

  /**
   * Remove from whitelist (admin function)
   */
  async removeFromWhitelist(email: string) {
    return lightAuthService.removeFromWhitelist(email);
  }
}

// Export singleton instance
export const lightAuthEnhanced = LightAuthEnhancedService.getInstance();