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

      // Update last_login_at
      await this.supabase
        .from('allowed_emails')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', allowedEmail.id);

      return {
        success: true,
        user: mockUser,
        needsProfile: !hasProfile
      };
    } catch (error) {
      console.error('Login error:', error);
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
}

export const dhgHubLightAuthService = DhgHubLightAuthService.getInstance();