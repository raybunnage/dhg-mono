/**
 * Light Auth Service - Shared Service
 * 
 * Simplified authentication without email verification:
 * - Check if email is on whitelist
 * - If not, user fills profile and is auto-added to whitelist
 * - No magic links, no email sending
 * 
 * This is a browser-only service that uses import.meta.env for Vite apps
 */

import { createClient } from '@supabase/supabase-js';
import type { 
  User,
  Session,
  SupabaseClient
} from '@supabase/supabase-js';

export type AppUser = User;
export type AuthSession = Session;

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

export interface ProfileData {
  email: string;
  name: string;
  profession?: string;
  organization?: string;
  professional_interests?: string;
}

export interface AllowedEmail {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  added_at: string;
  is_active: boolean;
}

/**
 * Light Auth Service - No email verification required
 */
class LightAuthService {
  private static instance: LightAuthService;
  private supabase: SupabaseClient;
  private mockSession: AuthSession | null = null;

  private constructor() {
    // Get environment variables - support both Vite (browser) and Node environments
    let supabaseUrl: string | undefined;
    let supabaseKey: string | undefined;
    
    // Check if we're in a browser environment with Vite
    if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
      supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    } 
    // Fallback to process.env for Node environments
    else if (typeof process !== 'undefined' && process.env) {
      supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 
                    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Unable to find Supabase credentials. Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env file.');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        storageKey: 'dhg-light-auth',
        persistSession: true,
        autoRefreshToken: false // No auto refresh since we're not using real auth
      }
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LightAuthService {
    if (!LightAuthService.instance) {
      LightAuthService.instance = new LightAuthService();
    }
    return LightAuthService.instance;
  }

  /**
   * Check if email is on the allowed list
   */
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

  /**
   * Register a new user by adding them to the whitelist
   * This auto-approves them immediately
   */
  async registerUser(profile: ProfileData): Promise<AuthResult> {
    try {
      // Add to allowed emails table
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

      // Create a mock session since we're not using real Supabase auth
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
      } as AuthSession;

      // Store in localStorage
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

  /**
   * Simple login - just check if email is allowed
   */
  async login(email: string): Promise<AuthResult> {
    try {
      const isAllowed = await this.isEmailAllowed(email);
      
      if (!isAllowed) {
        return { success: false, error: 'Email not on allowed list' };
      }

      // Get user details from allowed_emails
      const { data: allowedEmail, error } = await this.supabase
        .from('allowed_emails')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single();

      if (error || !allowedEmail) {
        return { success: false, error: 'User not found' };
      }

      // Create mock session
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
      } as AuthSession;

      // Store in localStorage
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

  /**
   * Logout - clear mock session
   */
  async logout(): Promise<void> {
    this.mockSession = null;
    localStorage.removeItem('dhg-light-auth-user');
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): AppUser | null {
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

  /**
   * Get allowed emails (for admin view)
   */
  async getAllowedEmails(): Promise<AllowedEmail[]> {
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

  /**
   * Remove email from whitelist (admin only)
   */
  async removeFromWhitelist(email: string): Promise<{ success: boolean; error?: string }> {
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

// Export singleton instance
export const lightAuthService = LightAuthService.getInstance();