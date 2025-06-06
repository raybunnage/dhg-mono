/**
 * Browser-compatible Auth Service
 * 
 * This is a simplified version of the auth service for browser environments
 * that doesn't rely on Node.js-specific modules.
 */

import { supabase } from '../lib/supabase';
import type { 
  User,
  Session,
  AuthError,
  AuthChangeEvent,
  Subscription
} from '@supabase/supabase-js';

export type AppUser = User;
export type AuthSession = Session;

export interface AuthResult {
  session: Session | null;
  user: User | null;
  error: AuthError | null;
}

export interface UserProfileUpdate {
  full_name?: string;
  preferences?: Record<string, any>;
}

export interface MagicLinkOptions {
  email: string;
  redirectTo?: string;
}

export interface AccessRequestData {
  email: string;
  name: string;
  profession?: string;
  professional_interests?: string;
  organization?: string;
  reason_for_access?: string;
}

/**
 * Browser Auth Service
 * Provides authentication functionality for web applications
 */
class BrowserAuthService {
  private static instance: BrowserAuthService;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BrowserAuthService {
    if (!BrowserAuthService.instance) {
      BrowserAuthService.instance = new BrowserAuthService();
    }
    return BrowserAuthService.instance;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      session: data?.session || null,
      user: data?.user || null,
      error: error || null,
    };
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, options?: { data?: Record<string, any> }): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: options?.data,
      },
    });

    return {
      session: data?.session || null,
      user: data?.user || null,
      error: error || null,
    };
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Send magic link
   */
  async sendMagicLink(options: MagicLinkOptions): Promise<AuthResult> {
    const redirectTo = options.redirectTo || `${window.location.origin}/auth/callback`;
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: options.email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    return {
      session: null,
      user: null,
      error: error || null,
    };
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<AppUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<AuthSession | null> {
    const { data: { session } } = await supabase.auth.refreshSession();
    return session;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: UserProfileUpdate): Promise<AppUser> {
    const { data: { user }, error } = await supabase.auth.updateUser({
      data: updates,
    });

    if (error) {
      throw error;
    }

    if (!user) {
      throw new Error('Failed to update user profile');
    }

    return user;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(permission: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Check in user_permissions table
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id)
        .eq('permission', permission)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(): Promise<string[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }

      return data?.map(r => r.role) || [];
    } catch (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: AppUser | null) => void): Subscription {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });

    return data.subscription;
  }

  /**
   * Check if an email is on the allowed list
   */
  async isEmailAllowed(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
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
   * Submit an access request for a non-allowed email
   */
  async submitAccessRequest(requestData: AccessRequestData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('submit_access_request', {
          p_email: requestData.email,
          p_name: requestData.name,
          p_profession: requestData.profession,
          p_professional_interests: requestData.professional_interests,
          p_organization: requestData.organization,
          p_reason_for_access: requestData.reason_for_access
        });

      if (error) {
        console.error('Error submitting access request:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error submitting access request:', error);
      return { success: false, error: 'Failed to submit access request' };
    }
  }

  /**
   * Get pending access requests (admin only)
   */
  async getPendingAccessRequests(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('pending_access_requests')
        .select('*')
        .order('request_date', { ascending: false });

      if (error) {
        console.error('Error fetching access requests:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching access requests:', error);
      return [];
    }
  }

  /**
   * Get allowed emails list (admin only)
   */
  async getAllowedEmails(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('auth_allowed_emails')
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
   * Add an email to the allowed list (admin only)
   */
  async addAllowedEmail(email: string, name?: string, organization?: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('add_allowed_email', {
          p_email: email,
          p_name: name,
          p_organization: organization,
          p_notes: notes
        });

      if (error) {
        console.error('Error adding allowed email:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding allowed email:', error);
      return { success: false, error: 'Failed to add email to allowlist' };
    }
  }

  /**
   * Approve an access request (admin only)
   */
  async approveAccessRequest(requestId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('approve_access_request', {
          p_request_id: requestId,
          p_notes: notes
        });

      if (error) {
        console.error('Error approving access request:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error approving access request:', error);
      return { success: false, error: 'Failed to approve access request' };
    }
  }

  /**
   * Deny an access request (admin only)
   */
  async denyAccessRequest(requestId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('deny_access_request', {
          p_request_id: requestId,
          p_denial_reason: reason
        });

      if (error) {
        console.error('Error denying access request:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error denying access request:', error);
      return { success: false, error: 'Failed to deny access request' };
    }
  }

  /**
   * Make current user an admin (temporary, for initial setup)
   */
  async makeMeAdmin(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .rpc('make_me_admin');

      if (error) {
        console.error('Error making user admin:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error making user admin:', error);
      return { success: false, error: 'Failed to grant admin role' };
    }
  }
}

// Export singleton instance
export const authService = BrowserAuthService.getInstance();