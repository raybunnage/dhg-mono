/**
 * DHG Hub Light Auth Service
 * 
 * Browser-compatible authentication service that implements the light auth pattern
 * using the browser-specific Supabase adapter
 */

import { supabaseBrowser } from './supabase-browser-adapter';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

export interface LightAuthServiceResult {
  success: boolean;
  user?: any;
  error?: string;
  needsProfile?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
  created_at: string;
  last_login_at?: string | null;
  user_profile_id?: string;
  profile?: any;
}

class DhgHubLightAuthService {
  private static instance: DhgHubLightAuthService;
  private supabase: SupabaseClient;
  private mockSession: Session | null = null;

  private constructor() {
    this.supabase = supabaseBrowser.getClient();
  }

  static getInstance(): DhgHubLightAuthService {
    if (!DhgHubLightAuthService.instance) {
      DhgHubLightAuthService.instance = new DhgHubLightAuthService();
    }
    return DhgHubLightAuthService.instance;
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

  async checkWhitelistStatus(email: string): Promise<{ isWhitelisted: boolean; error: Error | null }> {
    try {
      const isAllowed = await this.isEmailAllowed(email);
      return {
        isWhitelisted: isAllowed,
        error: null
      };
    } catch (error) {
      return {
        isWhitelisted: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  async login(email: string): Promise<LightAuthServiceResult> {
    console.log('[DHG-HUB-AUTH] Starting login for email:', email);
    
    try {
      const isAllowed = await this.isEmailAllowed(email);
      console.log('[DHG-HUB-AUTH] Email allowed check:', isAllowed);
      
      if (!isAllowed) {
        // Log failed login attempt
        await this.logAuthEvent('login_failed', {
          email,
          error: 'Email not on allowed list'
        });
        return { success: false, error: 'Email not on allowed list' };
      }

      const { data: allowedEmail, error } = await this.supabase
        .from('allowed_emails')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single();

      console.log('[DHG-HUB-AUTH] Allowed email lookup:', { found: !!allowedEmail, error });

      if (error || !allowedEmail) {
        // Log failed login attempt
        await this.logAuthEvent('login_failed', {
          email,
          error: error?.message || 'User not found'
        });
        return { success: false, error: 'User not found' };
      }

      // Check if user has a profile
      const { data: profiles } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('allowed_email_id', allowedEmail.id);

      const hasProfile = profiles && profiles.length > 0;
      const profile = hasProfile ? profiles[0] : null;

      const mockUser: UserProfile = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        name: allowedEmail.name,
        role: 'user',
        created_at: allowedEmail.created_at,
        last_login_at: new Date().toISOString(),
        user_profile_id: profile?.id,
        profile: profile
      };

      // Update login tracking
      await this.updateLoginTracking(allowedEmail.id);
      
      // Log successful login
      await this.logAuthEvent('login', {
        email,
        user_id: allowedEmail.id,
        profile_complete: hasProfile
      });

      console.log('[DHG-HUB-AUTH] Login successful for user:', allowedEmail.id);

      return {
        success: true,
        user: mockUser,
        needsProfile: !hasProfile
      };
    } catch (error) {
      console.error('[DHG-HUB-AUTH] Login error:', error);
      
      // Log error
      await this.logAuthEvent('login_failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async registerWithProfile(data: { email: string; name: string; profile: any }): Promise<LightAuthServiceResult> {
    try {
      // First, add to allowed emails
      const { data: allowedEmail, error: allowError } = await this.supabase
        .from('allowed_emails')
        .insert({
          email: data.email.toLowerCase(),
          name: data.name,
          notes: `Auto-registered via light auth`,
          is_active: true
        })
        .select()
        .single();

      if (allowError) {
        console.error('Error adding to allowed emails:', allowError);
        return { success: false, error: allowError.message };
      }

      // Create user profile
      const { data: userProfile, error: profileError } = await this.supabase
        .from('user_profiles')
        .insert({
          allowed_email_id: allowedEmail.id,
          ...data.profile
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Rollback allowed email creation
        await this.supabase
          .from('allowed_emails')
          .delete()
          .eq('id', allowedEmail.id);
        return { success: false, error: profileError.message };
      }

      const mockUser: UserProfile = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        name: data.name,
        role: 'user',
        created_at: allowedEmail.created_at,
        last_login_at: new Date().toISOString(),
        user_profile_id: userProfile.id,
        profile: userProfile
      };

      return { 
        success: true, 
        user: mockUser,
        needsProfile: false
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to register user' 
      };
    }
  }

  async createProfile(userId: string, profileData: any): Promise<{ profile: any | null; error: Error | null }> {
    try {
      const { data: profile, error } = await this.supabase
        .from('user_profiles')
        .insert({
          allowed_email_id: userId,
          ...profileData
        })
        .select()
        .single();

      if (error) {
        return { profile: null, error };
      }

      return { profile, error: null };
    } catch (error) {
      return { 
        profile: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  async completeProfile(userId: string, profileData: any): Promise<LightAuthServiceResult> {
    try {
      const { profile, error } = await this.createProfile(userId, profileData);
      
      if (error) {
        return { success: false, error: error.message };
      }

      // Get updated user data
      const { data: allowedEmail } = await this.supabase
        .from('allowed_emails')
        .select('*')
        .eq('id', userId)
        .single();

      if (!allowedEmail) {
        return { success: false, error: 'User not found' };
      }

      const mockUser: UserProfile = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        name: allowedEmail.name,
        role: 'user',
        created_at: allowedEmail.created_at,
        last_login_at: allowedEmail.last_login_at,
        user_profile_id: profile?.id,
        profile: profile
      };

      return {
        success: true,
        user: mockUser,
        needsProfile: false
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update login tracking fields in allowed_emails
   */
  private async updateLoginTracking(userId: string): Promise<void> {
    try {
      console.log('[DHG-HUB-AUTH] Updating login tracking for user:', userId);
      
      // First get current login count
      const { data: currentData, error: fetchError } = await this.supabase
        .from('allowed_emails')
        .select('login_count')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('[DHG-HUB-AUTH] Error fetching current login count:', fetchError);
        return;
      }

      const currentCount = currentData?.login_count || 0;
      console.log('[DHG-HUB-AUTH] Current login count:', currentCount);

      // Update last_login_at and increment login_count
      const { error: updateError } = await this.supabase
        .from('allowed_emails')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: currentCount + 1
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[DHG-HUB-AUTH] Error updating login tracking:', updateError);
      } else {
        console.log('[DHG-HUB-AUTH] Login tracking updated successfully');
      }
    } catch (error) {
      console.error('[DHG-HUB-AUTH] Failed to update login tracking:', error);
      // Don't throw - this is not critical for login success
    }
  }

  /**
   * Log an auth event to the auth_audit_log table
   */
  private async logAuthEvent(
    eventType: 'login' | 'logout' | 'login_failed' | 'profile_updated',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      console.log('[DHG-HUB-AUTH] Logging auth event:', eventType, metadata);
      
      const event = {
        user_id: metadata?.user_id || null,
        event_type: eventType,
        metadata: {
          ...metadata,
          auth_method: 'light_auth_dhg_hub',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          app: 'dhg-hub'
        },
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert(event);

      if (error) {
        console.error('[DHG-HUB-AUTH] Error logging auth event:', error);
        console.error('[DHG-HUB-AUTH] Event data:', event);
      } else {
        console.log('[DHG-HUB-AUTH] Auth event logged successfully');
      }
    } catch (error) {
      console.error('[DHG-HUB-AUTH] Failed to log auth event:', error);
    }
  }
}

export const dhgHubLightAuthService = DhgHubLightAuthService.getInstance();