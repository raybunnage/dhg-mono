/**
 * Browser-compatible Auth Service
 * 
 * This is a browser-compatible wrapper around the main AuthService
 * that doesn't rely on Node.js-specific modules like crypto, fs, path, os.
 */

import type { 
  User,
  Session,
  AuthError,
  Subscription,
  SupabaseClient
} from '@supabase/supabase-js';
import type {
  AppUser,
  AuthSession,
  AuthResult,
  MagicLinkOptions,
  UserProfileUpdate,
  AccessRequestData,
  AccessRequest,
  AllowedEmail
} from './types';

export { type AccessRequestData, type AccessRequest, type AllowedEmail } from './types';

/**
 * Browser Auth Service
 * Provides authentication functionality for web applications
 */
class BrowserAuthService {
  private static instance: BrowserAuthService;
  private static supabaseClient: SupabaseClient | null = null;
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    // Private constructor to enforce singleton pattern
    this.supabase = supabaseClient;
  }

  /**
   * Initialize the service with a Supabase client
   * Must be called before getInstance()
   */
  public static initialize(supabaseClient: SupabaseClient): void {
    BrowserAuthService.supabaseClient = supabaseClient;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BrowserAuthService {
    if (!BrowserAuthService.supabaseClient) {
      throw new Error('BrowserAuthService must be initialized with a Supabase client before use. Call BrowserAuthService.initialize(supabaseClient) first.');
    }
    if (!BrowserAuthService.instance) {
      BrowserAuthService.instance = new BrowserAuthService(BrowserAuthService.supabaseClient);
    }
    return BrowserAuthService.instance;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
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
    const { data, error } = await this.supabase.auth.signUp({
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
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Send magic link
   */
  async sendMagicLink(options: MagicLinkOptions): Promise<AuthResult> {
    const redirectTo = options.redirectTo || `${window.location.origin}/auth/callback`;
    
    const { error } = await this.supabase.auth.signInWithOtp({
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
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<AuthSession | null> {
    const { data: { session } } = await this.supabase.auth.refreshSession();
    return session;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: UserProfileUpdate): Promise<AppUser> {
    const { data: { user }, error } = await this.supabase.auth.updateUser({
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
      const { data, error } = await this.supabase
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

      const { data, error } = await this.supabase
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
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });

    return data.subscription;
  }

  /**
   * Check if an email is on the allowed list
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
   * Submit an access request for a non-allowed email
   */
  async submitAccessRequest(requestData: AccessRequestData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
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
  async getPendingAccessRequests(): Promise<AccessRequest[]> {
    try {
      const { data, error } = await this.supabase
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
  async getAllowedEmails(): Promise<AllowedEmail[]> {
    try {
      const { data, error } = await this.supabase
        .from('auth_allowed_emails')
        .select('*')
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
      const user = await this.getCurrentUser();
      const { error } = await this.supabase
        .rpc('add_allowed_email', {
          p_email: email,
          p_name: name,
          p_organization: organization,
          p_notes: notes,
          p_added_by: user?.id
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
      const user = await this.getCurrentUser();
      const { error } = await this.supabase
        .rpc('approve_access_request', {
          p_request_id: requestId,
          p_approved_by: user?.id,
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
      const user = await this.getCurrentUser();
      const { error } = await this.supabase
        .rpc('deny_access_request', {
          p_request_id: requestId,
          p_denied_by: user?.id,
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
      const { error } = await this.supabase
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

  /**
   * Update an allowed email (admin only)
   */
  async updateAllowedEmail(emailId: string, updates: Partial<AllowedEmail>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('auth_allowed_emails')
        .update(updates)
        .eq('id', emailId);

      if (error) {
        console.error('Error updating allowed email:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating allowed email:', error);
      return { success: false, error: 'Failed to update allowed email' };
    }
  }

  /**
   * Delete an allowed email (admin only)
   */
  async deleteAllowedEmail(emailId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('auth_allowed_emails')
        .delete()
        .eq('id', emailId);

      if (error) {
        console.error('Error deleting allowed email:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting allowed email:', error);
      return { success: false, error: 'Failed to delete allowed email' };
    }
  }
}

// Export the class and a getter for the singleton instance
export { BrowserAuthService };
export const getBrowserAuthService = () => BrowserAuthService.getInstance();

// Export a singleton instance for use in hooks (browser environments)
export const browserAuthService = {
  initialize: (supabaseClient: SupabaseClient) => BrowserAuthService.initialize(supabaseClient),
  getInstance: () => BrowserAuthService.getInstance(),
  
  // Delegate all methods to the singleton instance
  async signIn(email: string, password: string) {
    return BrowserAuthService.getInstance().signIn(email, password);
  },
  async signUp(email: string, password: string, options?: { data?: Record<string, any> }) {
    return BrowserAuthService.getInstance().signUp(email, password, options);
  },
  async signOut() {
    return BrowserAuthService.getInstance().signOut();
  },
  async sendMagicLink(options: MagicLinkOptions) {
    return BrowserAuthService.getInstance().sendMagicLink(options);
  },
  async getCurrentUser() {
    return BrowserAuthService.getInstance().getCurrentUser();
  },
  async getSession() {
    return BrowserAuthService.getInstance().getSession();
  },
  async refreshSession() {
    return BrowserAuthService.getInstance().refreshSession();
  },
  async updateUserProfile(updates: UserProfileUpdate) {
    return BrowserAuthService.getInstance().updateUserProfile(updates);
  },
  async hasPermission(permission: string) {
    return BrowserAuthService.getInstance().hasPermission(permission);
  },
  async getUserRoles() {
    return BrowserAuthService.getInstance().getUserRoles();
  },
  onAuthStateChange(callback: (user: AppUser | null) => void) {
    return BrowserAuthService.getInstance().onAuthStateChange(callback);
  },
  async isEmailAllowed(email: string) {
    return BrowserAuthService.getInstance().isEmailAllowed(email);
  },
  async submitAccessRequest(requestData: AccessRequestData) {
    return BrowserAuthService.getInstance().submitAccessRequest(requestData);
  },
  async getPendingAccessRequests() {
    return BrowserAuthService.getInstance().getPendingAccessRequests();
  },
  async getAllowedEmails() {
    return BrowserAuthService.getInstance().getAllowedEmails();
  },
  async addAllowedEmail(email: string, name?: string, organization?: string, notes?: string) {
    return BrowserAuthService.getInstance().addAllowedEmail(email, name, organization, notes);
  },
  async approveAccessRequest(requestId: string, notes?: string) {
    return BrowserAuthService.getInstance().approveAccessRequest(requestId, notes);
  },
  async denyAccessRequest(requestId: string, reason?: string) {
    return BrowserAuthService.getInstance().denyAccessRequest(requestId, reason);
  },
  async makeMeAdmin() {
    return BrowserAuthService.getInstance().makeMeAdmin();
  },
  async updateAllowedEmail(emailId: string, updates: Partial<AllowedEmail>) {
    return BrowserAuthService.getInstance().updateAllowedEmail(emailId, updates);
  },
  async deleteAllowedEmail(emailId: string) {
    return BrowserAuthService.getInstance().deleteAllowedEmail(emailId);
  }
};