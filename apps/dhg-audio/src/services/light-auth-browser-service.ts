/**
 * Browser-specific Light Auth Service
 * 
 * This is a browser-compatible version of the light auth service
 * that uses the browser-specific Supabase client
 */

import { supabaseBrowserClient } from './supabase-browser';
import type { User, Session, SupabaseClient } from '@supabase/supabase-js';
import type { ProfileFormData } from '@shared/services/user-profile-service';
import { userProfileBrowserService } from './user-profile-browser-service';

export interface LightAuthResult {
  success: boolean;
  user?: User;
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

class LightAuthBrowserService {
  private supabase: SupabaseClient;
  private mockSession: Session | null = null;

  constructor() {
    this.supabase = supabaseBrowserClient.getClient();
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('is_email_allowed', { check_email: email });

      if (error) {
        console.error('[LightAuthBrowser] Error checking email allowlist:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('[LightAuthBrowser] Error checking email allowlist:', error);
      return false;
    }
  }

  async registerUser(profile: any): Promise<any> {
    try {
      const { data: allowedEmail, error: allowError } = await this.supabase
        .from('auth_allowed_emails')
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
        console.error('[LightAuthBrowser] Error adding to allowed emails:', allowError);
        throw allowError;
      }

      console.log('[LightAuthBrowser] Successfully added to allowed emails:', allowedEmail);
      return { success: true, data: allowedEmail };
    } catch (error) {
      console.error('[LightAuthBrowser] Error in registerUser:', error);
      return { success: false, error };
    }
  }

  async login(email: string): Promise<LightAuthResult> {
    try {
      // Check if email is allowed
      const isAllowed = await this.isEmailAllowed(email);
      
      if (!isAllowed) {
        return {
          success: false,
          error: 'Email not in allowlist',
          needsProfile: true
        };
      }

      // Get the allowed email record
      const { data: allowedEmail, error: emailError } = await this.supabase
        .from('auth_allowed_emails')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (emailError || !allowedEmail) {
        console.error('[LightAuthBrowser] Error fetching allowed email:', emailError);
        return {
          success: false,
          error: 'Failed to fetch user data'
        };
      }

      // Create mock user and session
      const mockUser: User = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        app_metadata: {},
        user_metadata: {
          name: allowedEmail.name,
          allowed_email_id: allowedEmail.id
        },
        aud: 'authenticated',
        created_at: allowedEmail.created_at || new Date().toISOString()
      };

      this.mockSession = {
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock-refresh',
        user: mockUser
      };

      // Store in localStorage
      localStorage.setItem('dhg-audio-session', JSON.stringify(this.mockSession));

      // Log authentication event
      await this.logAuthEvent(allowedEmail.id, 'login', 'success');

      return {
        success: true,
        user: mockUser,
        session: this.mockSession,
        profileComplete: true
      };
    } catch (error) {
      console.error('[LightAuthBrowser] Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  async logout(): Promise<void> {
    try {
      const session = this.mockSession || this.getStoredSession();
      if (session?.user) {
        await this.logAuthEvent(session.user.id, 'logout', 'success');
      }
      
      this.mockSession = null;
      localStorage.removeItem('dhg-audio-session');
    } catch (error) {
      console.error('[LightAuthBrowser] Logout error:', error);
    }
  }

  getCurrentUser(): User | null {
    const session = this.mockSession || this.getStoredSession();
    return session?.user || null;
  }

  private getStoredSession(): Session | null {
    try {
      const stored = localStorage.getItem('dhg-audio-session');
      if (stored) {
        const session = JSON.parse(stored) as Session;
        // Check if expired
        if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000)) {
          return session;
        }
      }
    } catch (error) {
      console.error('[LightAuthBrowser] Error parsing stored session:', error);
    }
    return null;
  }

  private async logAuthEvent(userId: string, action: string, status: string): Promise<void> {
    try {
      console.log('[LightAuthBrowser] Logging auth event:', { userId, action, status });
      
      // Map action and status to event_type based on the correct schema
      let eventType: string;
      if (action === 'login' && status === 'success') {
        eventType = 'login';
      } else if (action === 'logout' && status === 'success') {
        eventType = 'logout';
      } else if (action === 'login' && status === 'failed') {
        eventType = 'login_failed';
      } else {
        eventType = action; // fallback
      }
      
      const event = {
        user_id: userId,
        event_type: eventType,
        metadata: {
          app: 'dhg-audio',
          auth_method: 'light_auth_browser',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          timestamp: new Date().toISOString(),
          original_action: action,
          original_status: status
        },
        created_at: new Date().toISOString()
      };
      
      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert(event);
        
      if (error) {
        console.error('[LightAuthBrowser] Error logging auth event:', error);
        console.error('[LightAuthBrowser] Event data:', event);
      } else {
        console.log('[LightAuthBrowser] Auth event logged successfully');
      }
    } catch (error) {
      console.error('[LightAuthBrowser] Error logging auth event:', error);
    }
  }

  // Additional methods for registration flow
  async checkAndRegister(email: string, registrationData: UserRegistrationData): Promise<LightAuthResult> {
    try {
      // Check if email is already allowed
      const isAllowed = await this.isEmailAllowed(email);
      
      if (isAllowed) {
        // Just log them in
        return this.login(email);
      }

      // Register the user
      const registerResult = await this.registerUser({
        email: registrationData.email,
        name: registrationData.name,
        organization: registrationData.profile.profession,
        profession: registrationData.profile.profession,
        professional_interests: registrationData.profile.interested_topics?.join(', ') || ''
      });

      if (!registerResult.success) {
        return {
          success: false,
          error: 'Failed to register user'
        };
      }

      // Create the user profile
      const profileResult = await userProfileBrowserService.createProfile(
        registerResult.data.id,
        registrationData.profile
      );

      if (!profileResult.success) {
        console.error('[LightAuthBrowser] Failed to create profile:', profileResult.error);
      }

      // Log them in
      return this.login(email);
    } catch (error) {
      console.error('[LightAuthBrowser] Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  // Method expected by dhg-audio-auth-service
  async registerWithProfile(data: UserRegistrationData): Promise<LightAuthResult> {
    return this.checkAndRegister(data.email, data);
  }

  // Method to complete profile for existing user
  async completeProfile(userId: string, profile: ProfileFormData): Promise<boolean> {
    try {
      const profileResult = await userProfileBrowserService.createProfile(userId, profile);
      return profileResult.success;
    } catch (error) {
      console.error('[LightAuthBrowser] Error completing profile:', error);
      return false;
    }
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('auth_user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[LightAuthBrowser] Error fetching profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, profile: data };
    } catch (error) {
      console.error('[LightAuthBrowser] Error getting user profile:', error);
      return { success: false, error: 'Failed to load profile' };
    }
  }

  // Check if user has completed onboarding
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('auth_user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('[LightAuthBrowser] Error checking onboarding:', error);
      return false;
    }
  }
}

// Export singleton instance
export const lightAuthBrowserService = new LightAuthBrowserService();