/**
 * Simplified Light Auth Service for dhg-audio app
 * 
 * This is a simplified version that handles lazy loading of Supabase
 * to prevent initialization errors on app startup
 */

import { supabaseBrowser } from './supabase-browser-adapter';
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

/**
 * Simplified Light Auth Service for dhg-audio
 * Uses localStorage for session persistence and lazy Supabase initialization
 */
class DhgAudioLightAuthService {
  private static instance: DhgAudioLightAuthService;
  private currentUser: User | null = null;

  private constructor() {
    console.log('[DhgAudioLightAuthService] Constructor called');
    // Try to restore user from localStorage
    this.restoreUserFromStorage();
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
   * Restore user from localStorage
   */
  private restoreUserFromStorage(): void {
    try {
      console.log('[DhgAudioLightAuthService] Checking localStorage for user...');
      const stored = localStorage.getItem('dhg_auth_user');
      if (stored) {
        this.currentUser = JSON.parse(stored);
        console.log('[DhgAudioLightAuthService] User restored from storage:', this.currentUser?.email);
      } else {
        console.log('[DhgAudioLightAuthService] No user found in localStorage');
      }
    } catch (error) {
      console.error('[DhgAudioLightAuthService] Failed to restore user from storage:', error);
      localStorage.removeItem('dhg_auth_user');
    }
  }

  /**
   * Save user to localStorage
   */
  private saveUserToStorage(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem('dhg_auth_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('dhg_auth_user');
      }
    } catch (error) {
      console.error('Failed to save user to storage:', error);
    }
  }

  /**
   * Attempt to login with email
   * For now, this is a simplified version that checks against a basic whitelist
   */
  async login(email: string): Promise<LightAuthResult> {
    try {
      console.log('Attempting login with email:', email);
      
      // Initialize Supabase client only when needed
      const supabase = supabaseBrowser.getClient();
      
      // Check if email is on the allowed list
      const { data: allowedEmail, error } = await supabase
        .from('allowed_emails')
        .select('id, email, name, created_at')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !allowedEmail) {
        console.log('Email not on whitelist, needs profile');
        return {
          success: false,
          needsProfile: true,
          error: 'Please complete your profile to continue'
        };
      }

      // Create a mock user object for whitelisted users
      const user: User = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        email_confirmed_at: allowedEmail.created_at,
        created_at: allowedEmail.created_at,
        updated_at: new Date().toISOString(),
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {
          name: allowedEmail.name,
          email: allowedEmail.email
        }
      };

      // Save user state
      this.currentUser = user;
      this.saveUserToStorage(user);

      console.log('Login successful for whitelisted user');
      return {
        success: true,
        user,
        needsProfile: false
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
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    this.currentUser = null;
    this.saveUserToStorage(null);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

// Export singleton instance
export const dhgAudioLightAuth = DhgAudioLightAuthService.getInstance();

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).dhgAudioLightAuth = dhgAudioLightAuth;
  console.log('[light-auth-service-simple] Service exported to window.dhgAudioLightAuth for debugging');
}