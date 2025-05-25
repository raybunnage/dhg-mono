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
}

// Export singleton instance
export const authService = BrowserAuthService.getInstance();