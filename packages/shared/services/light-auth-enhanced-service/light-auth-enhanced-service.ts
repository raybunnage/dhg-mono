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

import { userProfileService, type ProfileFormData } from '../user-profile-service';
import { SupabaseClientService } from '../supabase-client';
import type { User, Session, SupabaseClient } from '@supabase/supabase-js';

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
 * Light auth service interface for compatibility
 */
interface LightAuthService {
  isEmailAllowed(email: string): Promise<boolean>;
  registerUser(profile: any): Promise<any>;
  login(email: string): Promise<any>;
  logout(): Promise<void>;
  getCurrentUser(): User | null;
  getAllowedEmails(): Promise<any[]>;
  removeFromWhitelist(email: string): Promise<any>;
}

/**
 * Simple light auth implementation since we archived the original
 */
class SimpleLightAuthService implements LightAuthService {
  private supabase: SupabaseClient;
  private mockSession: Session | null = null;

  constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('is_email_allowed', { check_email: email });

      if (error) {
        console.error('Error checking email allowlist:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking email allowlist:', error);
      return false;
    }
  }

  async registerUser(profile: any): Promise<any> {
    try {
      const { data: allowedEmail, error: allowError } = await this.supabase
        .from('allowed_emails')
        .insert({
          email: profile.email.toLowerCase(),
          name: profile.name,
          organization: profile.organization,
          notes: `Auto-registered via light auth. Profession: ${profile.profession}, Interests: ${profile.professional_interests}`,
          is_active: true
        })
        .select()
        .single();

      if (allowError) {
        console.error('Error adding to allowed emails:', allowError);
        return { success: false, error: allowError.message };
      }

      const mockUser: User = {
        id: allowedEmail.id,
        email: profile.email,
        app_metadata: {},
        user_metadata: { 
          name: profile.name,
          profession: profile.profession,
          organization: profile.organization
        },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User;

      this.mockSession = {
        access_token: 'mock-token-' + allowedEmail.id,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-' + allowedEmail.id,
        user: mockUser
      } as Session;

      localStorage.setItem('dhg-light-auth-user', JSON.stringify(mockUser));

      return { 
        success: true, 
        user: mockUser,
        session: this.mockSession
      };
    } catch (error) {
      console.error('Error registering user:', error);
      return { success: false, error: 'Failed to register user' };
    }
  }

  async login(email: string): Promise<any> {
    try {
      const isAllowed = await this.isEmailAllowed(email);
      
      if (!isAllowed) {
        return { success: false, error: 'Email not on allowed list' };
      }

      const { data: allowedEmail, error } = await this.supabase
        .from('allowed_emails')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single();

      if (error || !allowedEmail) {
        return { success: false, error: 'User not found' };
      }

      const mockUser: User = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        app_metadata: {},
        user_metadata: { 
          name: allowedEmail.name,
          organization: allowedEmail.organization
        },
        aud: 'authenticated',
        created_at: allowedEmail.added_at
      } as User;

      this.mockSession = {
        access_token: 'mock-token-' + allowedEmail.id,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-' + allowedEmail.id,
        user: mockUser
      } as Session;

      localStorage.setItem('dhg-light-auth-user', JSON.stringify(mockUser));

      return { 
        success: true, 
        user: mockUser,
        session: this.mockSession
      };
    } catch (error) {
      console.error('Error logging in:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  async logout(): Promise<void> {
    this.mockSession = null;
    localStorage.removeItem('dhg-light-auth-user');
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('dhg-light-auth-user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  async getAllowedEmails(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('allowed_emails')
        .select('*')
        .eq('is_active', true)
        .order('email', { ascending: true });

      if (error) {
        console.error('Error fetching allowed emails:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching allowed emails:', error);
      return [];
    }
  }

  async removeFromWhitelist(email: string): Promise<any> {
    try {
      const { error } = await this.supabase
        .from('allowed_emails')
        .update({ is_active: false })
        .eq('email', email.toLowerCase());

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      return { success: false, error: 'Failed to remove from whitelist' };
    }
  }
}

/**
 * Enhanced Light Auth Service
 * Provides complete authentication flow with profile management
 */
class LightAuthEnhancedService {
  private static instance: LightAuthEnhancedService;
  private lightAuthService: LightAuthService;
  private supabase: SupabaseClient;

  private constructor() {
    // Private constructor for singleton
    this.lightAuthService = new SimpleLightAuthService();
    this.supabase = SupabaseClientService.getInstance().getClient();
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
      const loginResult = await this.lightAuthService.login(email);
      
      if (!loginResult.success) {
        // Log failed login attempt
        await this.logLightAuthEvent('login_failed', {
          email,
          reason: 'email_not_on_allowlist'
        });
        
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
        
        // Log successful login
        await this.logLightAuthEvent('login', {
          email,
          user_id: loginResult.user.id,
          profile_complete: profileComplete
        });
        
        return {
          success: true,
          user: loginResult.user,
          session: loginResult.session,
          needsProfile: !profileComplete,
          profileComplete
        };
      }

      // Log successful login without user
      await this.logLightAuthEvent('login', {
        email,
        user_id: loginResult.user?.id
      });

      return {
        success: true,
        user: loginResult.user,
        session: loginResult.session,
        needsProfile: false,
        profileComplete: true
      };
    } catch (error) {
      console.error('Login error:', error);
      
      // Log login error
      await this.logLightAuthEvent('login_failed', {
        email,
        error: (error as Error).message
      });
      
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
      const registerResult = await this.lightAuthService.registerUser({
        email: data.email,
        name: data.name,
        profession: data.profile.profession,
        organization: data.profile.industry_sectors?.[0],
        professional_interests: data.profile.interested_topics.join(', ')
      });

      if (!registerResult.success || !registerResult.user) {
        // Log failed registration
        await this.logLightAuthEvent('login_failed', {
          email: data.email,
          action: 'registration_failed',
          error: registerResult.error
        });
        
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

      // Log successful registration
      await this.logLightAuthEvent('login', {
        email: data.email,
        user_id: registerResult.user.id,
        action: 'registration_with_profile',
        profile_complete: profileResult.success
      });

      return {
        success: true,
        user: registerResult.user,
        session: registerResult.session,
        needsProfile: false,
        profileComplete: true
      };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Log registration error
      await this.logLightAuthEvent('login_failed', {
        email: data.email,
        action: 'registration_error',
        error: (error as Error).message
      });
      
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
        
        // Log profile completion
        await this.logLightAuthEvent('profile_updated', {
          user_id: userId,
          action: 'profile_completed',
          profile_data: {
            profession: profile.profession,
            topics_count: profile.interested_topics?.length,
            sectors_count: profile.industry_sectors?.length
          }
        });
      } else {
        // Log profile completion failure
        await this.logLightAuthEvent('profile_updated', {
          user_id: userId,
          action: 'profile_completion_failed',
          error: result.error
        });
      }
      
      return result.success;
    } catch (error) {
      console.error('Profile completion error:', error);
      
      // Log profile completion error
      await this.logLightAuthEvent('profile_updated', {
        user_id: userId,
        action: 'profile_completion_error',
        error: (error as Error).message
      });
      
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
    try {
      const user = this.getCurrentUser();
      
      // Log logout event before clearing session
      if (user) {
        await this.logLightAuthEvent('logout', {
          user_id: user.id,
          email: user.email
        });
      }
      
      return this.lightAuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Still logout even if logging fails
      return this.lightAuthService.logout();
    }
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
    return this.lightAuthService.isEmailAllowed(email);
  }

  /**
   * Get allowed emails list (admin function)
   */
  async getAllowedEmails() {
    return this.lightAuthService.getAllowedEmails();
  }

  /**
   * Remove from whitelist (admin function)
   */
  async removeFromWhitelist(email: string) {
    return this.lightAuthService.removeFromWhitelist(email);
  }

  // ===== AUDIT LOG METHODS =====

  /**
   * Log a light auth event to the auth_audit_log table
   */
  private async logLightAuthEvent(
    eventType: 'login' | 'logout' | 'login_failed' | 'profile_updated',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const event = {
        user_id: metadata?.user_id || null,
        event_type: eventType,
        metadata: {
          ...metadata,
          auth_method: 'light_auth_enhanced',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
        },
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert(event);

      if (error) {
        console.error('LightAuthEnhanced: Error logging auth event:', error);
      }
    } catch (error) {
      console.error('LightAuthEnhanced: Failed to log auth event:', error);
    }
  }

  /**
   * Get light auth audit logs for the current user
   */
  public async getUserAuditLogs(limit: number = 50): Promise<any[]> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .contains('metadata', { auth_method: 'light_auth_enhanced' })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('LightAuthEnhanced: Error fetching user audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('LightAuthEnhanced: Failed to fetch user audit logs:', error);
      return [];
    }
  }

  /**
   * Get light auth activity summary
   */
  public async getActivitySummary(): Promise<{
    totalLogins: number;
    totalRegistrations: number;
    profileCompletions: number;
    recentActivity: any[];
  }> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        return {
          totalLogins: 0,
          totalRegistrations: 0,
          profileCompletions: 0,
          recentActivity: []
        };
      }

      const logs = await this.getUserAuditLogs(100);
      
      const summary = {
        totalLogins: logs.filter(log => 
          log.event_type === 'login' && 
          log.metadata?.action !== 'registration_with_profile'
        ).length,
        totalRegistrations: logs.filter(log => 
          log.event_type === 'login' && 
          log.metadata?.action === 'registration_with_profile'
        ).length,
        profileCompletions: logs.filter(log => 
          log.event_type === 'profile_updated' && 
          log.metadata?.action === 'profile_completed'
        ).length,
        recentActivity: logs.slice(0, 10)
      };

      return summary;
    } catch (error) {
      console.error('LightAuthEnhanced: Failed to get activity summary:', error);
      return {
        totalLogins: 0,
        totalRegistrations: 0,
        profileCompletions: 0,
        recentActivity: []
      };
    }
  }
}

// Export singleton instance
export const lightAuthEnhanced = LightAuthEnhancedService.getInstance();