/**
 * Authentication Service
 * 
 * Provides unified authentication for both CLI and web applications
 * using Supabase Auth with enhanced session management and security features.
 */

import { 
  SupabaseClient, 
  AuthError, 
  AuthApiError,
  Session,
  User,
  AuthChangeEvent,
  Subscription
} from '@supabase/supabase-js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import types
import {
  AppUser,
  AuthSession,
  AuthResult,
  AuthEvent,
  AuthEventType,
  AuthOptions,
  CLIAuthToken,
  MagicLinkOptions,
  OAuthOptions,
  PermissionCheck,
  ServiceAccountCredentials,
  SignUpOptions,
  UserProfile,
  UserProfileUpdate,
  AccessRequestData,
  AccessRequest,
  AllowedEmail
} from './types';

// Import existing SupabaseClientService
import { SupabaseClientService } from '../supabase-client';

/**
 * Authentication Service
 * Singleton pattern implementation for authentication management
 */
export class AuthService {
  private static instance: AuthService;
  private supabase: SupabaseClient;
  private currentSession: AuthSession | null = null;
  private authStateSubscription: Subscription | null = null;
  private sessionRefreshTimer: NodeJS.Timeout | null = null;
  private environment: 'cli' | 'web' = 'web';
  
  // CLI token storage location
  private readonly CLI_TOKEN_PATH = path.join(os.homedir(), '.dhg', 'auth.json');
  
  private constructor() {
    // Initialize with existing Supabase client service
    this.supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('AuthService: Initializing authentication service');
    
    // Detect environment
    this.environment = this.detectEnvironment();
    
    // Initialize session if in web environment
    if (this.environment === 'web') {
      this.initializeWebSession();
    }
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  /**
   * Detect if running in CLI or web environment
   */
  private detectEnvironment(): 'cli' | 'web' {
    // Check if running in Node.js without a browser
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      return 'cli';
    }
    return 'web';
  }
  
  /**
   * Initialize web session from stored session
   */
  private async initializeWebSession(): Promise<void> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('AuthService: Error initializing session:', error);
        return;
      }
      
      if (session) {
        this.currentSession = await this.enhanceSession(session);
        this.startSessionRefreshTimer();
      }
    } catch (error) {
      console.error('AuthService: Failed to initialize web session:', error);
    }
  }
  
  /**
   * Sign in with email and password
   */
  public async signIn(email: string, password: string, options?: AuthOptions): Promise<AuthResult> {
    try {
      console.log(`AuthService: Attempting sign in for ${email}`);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        await this.logAuthEvent('login_failed', { email, error: error.message });
        return { session: null, user: null, error };
      }
      
      if (!data.session || !data.user) {
        return { 
          session: null, 
          user: null, 
          error: new AuthError('No session or user returned', 500) 
        };
      }
      
      // Enhance session with additional data
      const enhancedSession = await this.enhanceSession(data.session);
      this.currentSession = enhancedSession;
      
      // Start session refresh timer
      this.startSessionRefreshTimer();
      
      // Log successful login
      await this.logAuthEvent('login', { 
        email, 
        environment: options?.environment || this.environment 
      });
      
      return { 
        session: enhancedSession, 
        user: enhancedSession.user, 
        error: null 
      };
    } catch (error) {
      console.error('AuthService: Sign in error:', error);
      return { 
        session: null, 
        user: null, 
        error: error as AuthError 
      };
    }
  }
  
  /**
   * Sign up a new user
   */
  public async signUp(email: string, password: string, options?: SignUpOptions): Promise<AuthResult> {
    try {
      console.log(`AuthService: Attempting sign up for ${email}`);
      
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: options?.emailRedirectTo,
          data: options?.data
        }
      });
      
      if (error) {
        return { session: null, user: null, error };
      }
      
      if (!data.user) {
        return { 
          session: null, 
          user: null, 
          error: new AuthError('No user returned', 500) 
        };
      }
      
      // Create user profile
      if (data.user.id) {
        await this.createUserProfile(data.user.id, options?.data);
      }
      
      // If session exists (email confirmation disabled), enhance it
      if (data.session) {
        const enhancedSession = await this.enhanceSession(data.session);
        this.currentSession = enhancedSession;
        this.startSessionRefreshTimer();
        
        return { 
          session: enhancedSession, 
          user: enhancedSession.user, 
          error: null 
        };
      }
      
      // No session (email confirmation required)
      return { 
        session: null, 
        user: data.user as AppUser, 
        error: null 
      };
    } catch (error) {
      console.error('AuthService: Sign up error:', error);
      return { 
        session: null, 
        user: null, 
        error: error as AuthError 
      };
    }
  }
  
  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      console.log('AuthService: Signing out user');
      
      // Log sign out event before clearing session
      if (this.currentSession?.user?.id) {
        await this.logAuthEvent('logout', { user_id: this.currentSession.user.id });
      }
      
      // Sign out from Supabase
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        console.error('AuthService: Sign out error:', error);
        throw error;
      }
      
      // Clear local session
      this.currentSession = null;
      
      // Clear session refresh timer
      if (this.sessionRefreshTimer) {
        clearInterval(this.sessionRefreshTimer);
        this.sessionRefreshTimer = null;
      }
      
      // Clear CLI token if in CLI environment
      if (this.environment === 'cli') {
        this.clearCLIToken();
      }
    } catch (error) {
      console.error('AuthService: Failed to sign out:', error);
      throw error;
    }
  }
  
  /**
   * Get the current session
   */
  public async getSession(): Promise<AuthSession | null> {
    try {
      // If we have a current session, validate it
      if (this.currentSession) {
        const isValid = await this.validateSession();
        if (isValid) {
          return this.currentSession;
        }
      }
      
      // Try to get session from Supabase
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error || !session) {
        return null;
      }
      
      // Enhance and cache the session
      const enhancedSession = await this.enhanceSession(session);
      this.currentSession = enhancedSession;
      
      return enhancedSession;
    } catch (error) {
      console.error('AuthService: Error getting session:', error);
      return null;
    }
  }
  
  /**
   * Refresh the current session
   */
  public async refreshSession(): Promise<AuthSession | null> {
    try {
      console.log('AuthService: Refreshing session');
      
      const { data: { session }, error } = await this.supabase.auth.refreshSession();
      
      if (error || !session) {
        console.error('AuthService: Failed to refresh session:', error);
        this.currentSession = null;
        return null;
      }
      
      // Enhance and cache the refreshed session
      const enhancedSession = await this.enhanceSession(session);
      this.currentSession = enhancedSession;
      
      // Log session refresh
      await this.logAuthEvent('session_refreshed', { user_id: session.user.id });
      
      return enhancedSession;
    } catch (error) {
      console.error('AuthService: Error refreshing session:', error);
      return null;
    }
  }
  
  /**
   * Validate the current session
   */
  public async validateSession(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        return false;
      }
      
      // Check if session is expired
      const expiresAt = this.currentSession.expires_at;
      if (expiresAt && new Date(expiresAt * 1000) < new Date()) {
        console.log('AuthService: Session expired');
        return false;
      }
      
      // Verify with Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error || !user) {
        return false;
      }
      
      return user.id === this.currentSession.user.id;
    } catch (error) {
      console.error('AuthService: Error validating session:', error);
      return false;
    }
  }
  
  /**
   * Get the current user
   */
  public async getCurrentUser(): Promise<AppUser | null> {
    try {
      const session = await this.getSession();
      return session?.user || null;
    } catch (error) {
      console.error('AuthService: Error getting current user:', error);
      return null;
    }
  }
  
  /**
   * Update user profile
   */
  public async updateUserProfile(updates: UserProfileUpdate): Promise<AppUser> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      console.log(`AuthService: Updating profile for user ${user.id}`);
      
      // Update user_profiles table
      const { data, error } = await this.supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update cached user
      if (this.currentSession) {
        this.currentSession.user.profile = data;
      }
      
      // Log profile update
      await this.logAuthEvent('profile_updated', { user_id: user.id, updates });
      
      return this.currentSession?.user || user;
    } catch (error) {
      console.error('AuthService: Error updating user profile:', error);
      throw error;
    }
  }
  
  /**
   * Authenticate CLI with API key
   */
  public async authenticateCLI(apiKey?: string): Promise<AuthSession | null> {
    try {
      console.log('AuthService: Attempting CLI authentication');
      
      // First, try to load existing CLI token
      const existingToken = this.loadCLIToken();
      if (existingToken && await this.validateCLIToken(existingToken)) {
        console.log('AuthService: Using existing CLI token');
        return this.currentSession;
      }
      
      // If no API key provided, try environment variable
      const authKey = apiKey || process.env.DHG_CLI_API_KEY;
      if (!authKey) {
        console.error('AuthService: No CLI API key provided');
        return null;
      }
      
      // Hash the API key for comparison
      const tokenHash = this.hashToken(authKey);
      
      // Look up the token in the database
      const { data: tokenData, error } = await this.supabase
        .from('cli_auth_tokens')
        .select('*, user:user_id(*))')
        .eq('token_hash', tokenHash)
        .single();
      
      if (error || !tokenData) {
        console.error('AuthService: Invalid CLI token');
        return null;
      }
      
      // Type assertion for tokenData
      const token = tokenData as any;
      
      // Check if token is expired
      if (token.expires_at && new Date(token.expires_at) < new Date()) {
        console.error('AuthService: CLI token expired');
        return null;
      }
      
      // Update last used timestamp
      await this.supabase
        .from('cli_auth_tokens')
        .update({ last_used: new Date().toISOString() })
        .eq('id', token.id);
      
      // Create a session for the CLI user
      const cliSession: AuthSession = {
        access_token: authKey,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: '',
        user: token.user as AppUser,
        environment: 'cli',
        metadata: {
          token_id: token.id,
          token_name: token.name
        }
      };
      
      this.currentSession = cliSession;
      
      // Save token for future use
      this.saveCLIToken(authKey);
      
      // Log CLI authentication
      await this.logAuthEvent('login', { 
        user_id: token.user_id, 
        environment: 'cli',
        token_name: token.name 
      });
      
      return cliSession;
    } catch (error) {
      console.error('AuthService: CLI authentication error:', error);
      return null;
    }
  }
  
  /**
   * Authenticate as service account
   */
  public async authenticateServiceAccount(): Promise<AuthSession | null> {
    try {
      console.log('AuthService: Attempting service account authentication');
      
      // Get service account credentials from environment
      const email = process.env.SUPABASE_SERVICE_ACCOUNT_EMAIL;
      const key = process.env.SUPABASE_SERVICE_ACCOUNT_KEY;
      
      if (!email || !key) {
        console.error('AuthService: Service account credentials not configured');
        return null;
      }
      
      // Sign in with service account
      const result = await this.signIn(email, key, { 
        environment: 'cli',
        persistSession: false 
      });
      
      if (result.error || !result.session) {
        console.error('AuthService: Service account authentication failed:', result.error);
        return null;
      }
      
      return result.session;
    } catch (error) {
      console.error('AuthService: Service account authentication error:', error);
      return null;
    }
  }
  
  /**
   * Send magic link for passwordless authentication
   */
  public async sendMagicLink(options: MagicLinkOptions): Promise<AuthResult> {
    try {
      console.log(`AuthService: Sending magic link to ${options.email}`);
      
      const { error } = await this.supabase.auth.signInWithOtp({
        email: options.email,
        options: {
          emailRedirectTo: options.redirectTo,
          shouldCreateUser: options.shouldCreateUser
        }
      });
      
      if (error) {
        return { session: null, user: null, error };
      }
      
      return { session: null, user: null, error: null };
    } catch (error) {
      console.error('AuthService: Magic link error:', error);
      return { 
        session: null, 
        user: null, 
        error: error as AuthError 
      };
    }
  }
  
  /**
   * Sign in with OAuth provider
   */
  public async signInWithOAuth(options: OAuthOptions): Promise<AuthResult> {
    try {
      console.log(`AuthService: Initiating OAuth sign in with ${options.provider}`);
      
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: options.provider,
        options: {
          redirectTo: options.redirectTo,
          scopes: options.scopes
        }
      });
      
      if (error) {
        return { session: null, user: null, error };
      }
      
      // OAuth returns a URL to redirect to, not a session
      return { session: null, user: null, error: null };
    } catch (error) {
      console.error('AuthService: OAuth error:', error);
      return { 
        session: null, 
        user: null, 
        error: error as AuthError 
      };
    }
  }
  
  /**
   * Check if user has a specific permission
   */
  public async hasPermission(permission: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return false;
      }
      
      // Check if user has the permission
      // This is a simplified implementation - you might want to implement
      // a more sophisticated permission system
      const permissions = user.permissions || [];
      const hasPermission = permissions.includes(permission);
      
      // Log permission check for audit
      const check: PermissionCheck = {
        hasPermission,
        permission,
        user_id: user.id,
        checked_at: new Date().toISOString()
      };
      
      console.log(`AuthService: Permission check - ${permission}: ${hasPermission}`);
      
      return hasPermission;
    } catch (error) {
      console.error('AuthService: Error checking permission:', error);
      return false;
    }
  }
  
  /**
   * Get user roles
   */
  public async getUserRoles(): Promise<string[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return [];
      }
      
      return user.roles || [];
    } catch (error) {
      console.error('AuthService: Error getting user roles:', error);
      return [];
    }
  }
  
  /**
   * Listen for authentication state changes
   */
  public onAuthStateChange(callback: (user: AppUser | null) => void): Subscription {
    // Clean up existing subscription
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    
    // Create new subscription
    const { data } = this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`AuthService: Auth state changed - ${event}`);
      
      if (session) {
        const enhancedSession = await this.enhanceSession(session);
        this.currentSession = enhancedSession;
        callback(enhancedSession.user);
      } else {
        this.currentSession = null;
        callback(null);
      }
    });
    
    this.authStateSubscription = data.subscription;
    return this.authStateSubscription;
  }
  
  /**
   * Create a CLI authentication token
   */
  public async createCLIToken(name: string, expiresInDays: number = 90): Promise<string> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      console.log(`AuthService: Creating CLI token "${name}" for user ${user.id}`);
      
      // Generate a secure random token
      const token = this.generateSecureToken();
      const tokenHash = this.hashToken(token);
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      // Store the token hash in the database
      const { data, error } = await this.supabase
        .from('cli_auth_tokens')
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          name,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Log token creation
      await this.logAuthEvent('token_created', { 
        user_id: user.id, 
        token_id: data.id,
        token_name: name 
      });
      
      return token;
    } catch (error) {
      console.error('AuthService: Error creating CLI token:', error);
      throw error;
    }
  }
  
  /**
   * Revoke a CLI authentication token
   */
  public async revokeCLIToken(tokenId: string): Promise<void> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      console.log(`AuthService: Revoking CLI token ${tokenId}`);
      
      // Delete the token
      const { error } = await this.supabase
        .from('cli_auth_tokens')
        .delete()
        .eq('id', tokenId)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Log token revocation
      await this.logAuthEvent('token_revoked', { 
        user_id: user.id, 
        token_id: tokenId 
      });
    } catch (error) {
      console.error('AuthService: Error revoking CLI token:', error);
      throw error;
    }
  }
  
  /**
   * List user's CLI tokens
   */
  public async listCLITokens(): Promise<CLIAuthToken[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return [];
      }
      
      const { data, error } = await this.supabase
        .from('cli_auth_tokens')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('AuthService: Error listing CLI tokens:', error);
      return [];
    }
  }
  
  /**
   * Enhance a basic session with additional user data
   */
  private async enhanceSession(session: Session): Promise<AuthSession> {
    try {
      // Fetch user profile
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      // Create enhanced session
      const enhancedSession: AuthSession = {
        ...session,
        user: {
          ...session.user,
          profile: profile || undefined,
          roles: [], // TODO: Implement role fetching
          permissions: [] // TODO: Implement permission fetching
        },
        environment: this.environment
      };
      
      return enhancedSession;
    } catch (error) {
      console.error('AuthService: Error enhancing session:', error);
      // Return basic session if enhancement fails
      return session as AuthSession;
    }
  }
  
  /**
   * Create user profile for new users
   */
  private async createUserProfile(userId: string, data?: Record<string, any>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .insert({
          id: userId,
          full_name: data?.full_name || '',
          preferences: data?.preferences || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('AuthService: Error creating user profile:', error);
      }
    } catch (error) {
      console.error('AuthService: Failed to create user profile:', error);
    }
  }
  
  /**
   * Log authentication event for audit trail
   */
  private async logAuthEvent(eventType: AuthEventType, metadata?: Record<string, any>): Promise<void> {
    try {
      const event: AuthEvent = {
        user_id: this.currentSession?.user?.id || metadata?.user_id,
        event_type: eventType,
        metadata,
        ip_address: metadata?.ip_address, // Would need to be passed from the client
        user_agent: metadata?.user_agent, // Would need to be passed from the client
        created_at: new Date().toISOString()
      };
      
      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert(event);
      
      if (error) {
        console.error('AuthService: Error logging auth event:', error);
      }
    } catch (error) {
      console.error('AuthService: Failed to log auth event:', error);
    }
  }
  
  /**
   * Start session refresh timer
   */
  private startSessionRefreshTimer(): void {
    // Clear existing timer
    if (this.sessionRefreshTimer) {
      clearInterval(this.sessionRefreshTimer);
    }
    
    // Only start timer in web environment
    if (this.environment !== 'web') {
      return;
    }
    
    // Refresh session every 30 minutes
    this.sessionRefreshTimer = setInterval(async () => {
      console.log('AuthService: Auto-refreshing session');
      await this.refreshSession();
    }, 30 * 60 * 1000);
  }
  
  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    const randomBytes = require('crypto').randomBytes(32);
    return randomBytes.toString('base64url');
  }
  
  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  
  /**
   * Save CLI token to local storage
   */
  private saveCLIToken(token: string): void {
    try {
      const dir = path.dirname(this.CLI_TOKEN_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const tokenData = {
        token,
        created_at: new Date().toISOString()
      };
      
      fs.writeFileSync(this.CLI_TOKEN_PATH, JSON.stringify(tokenData), 'utf8');
      fs.chmodSync(this.CLI_TOKEN_PATH, 0o600); // Read/write for owner only
    } catch (error) {
      console.error('AuthService: Error saving CLI token:', error);
    }
  }
  
  /**
   * Load CLI token from local storage
   */
  private loadCLIToken(): string | null {
    try {
      if (!fs.existsSync(this.CLI_TOKEN_PATH)) {
        return null;
      }
      
      const content = fs.readFileSync(this.CLI_TOKEN_PATH, 'utf8');
      const tokenData = JSON.parse(content);
      
      return tokenData.token;
    } catch (error) {
      console.error('AuthService: Error loading CLI token:', error);
      return null;
    }
  }
  
  /**
   * Clear CLI token from local storage
   */
  private clearCLIToken(): void {
    try {
      if (fs.existsSync(this.CLI_TOKEN_PATH)) {
        fs.unlinkSync(this.CLI_TOKEN_PATH);
      }
    } catch (error) {
      console.error('AuthService: Error clearing CLI token:', error);
    }
  }
  
  /**
   * Validate a CLI token
   */
  private async validateCLIToken(token: string): Promise<boolean> {
    try {
      const result = await this.authenticateCLI(token);
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an email is on the allowed list
   */
  public async isEmailAllowed(email: string): Promise<boolean> {
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
  public async submitAccessRequest(requestData: AccessRequestData): Promise<{ success: boolean; error?: string }> {
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
  public async getPendingAccessRequests(): Promise<AccessRequest[]> {
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
  public async getAllowedEmails(): Promise<AllowedEmail[]> {
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
   * Add an email to the allowed list (admin only)
   */
  public async addAllowedEmail(email: string, name?: string, organization?: string, notes?: string): Promise<{ success: boolean; error?: string }> {
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
  public async approveAccessRequest(requestId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
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
  public async denyAccessRequest(requestId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
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
  public async makeMeAdmin(): Promise<{ success: boolean; error?: string }> {
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

  // ===== AUTH AUDIT LOG ENHANCEMENT METHODS =====

  /**
   * Get audit logs for the current user
   */
  public async getUserAuditLogs(limit: number = 50, offset: number = 0): Promise<AuthEvent[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('AuthService: Error fetching user audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('AuthService: Failed to fetch user audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a specific user (admin only)
   */
  public async getAuditLogsForUser(userId: string, limit: number = 50, offset: number = 0): Promise<AuthEvent[]> {
    try {
      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('AuthService: Error fetching audit logs for user:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('AuthService: Failed to fetch audit logs for user:', error);
      return [];
    }
  }

  /**
   * Get all recent audit logs (admin only)
   */
  public async getRecentAuditLogs(limit: number = 100): Promise<AuthEvent[]> {
    try {
      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('AuthService: Error fetching recent audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('AuthService: Failed to fetch recent audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs by event type
   */
  public async getAuditLogsByType(eventType: AuthEventType, limit: number = 50): Promise<AuthEvent[]> {
    try {
      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('AuthService: Error fetching audit logs by type:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('AuthService: Failed to fetch audit logs by type:', error);
      return [];
    }
  }

  /**
   * Get failed login attempts
   */
  public async getFailedLoginAttempts(limit: number = 50): Promise<AuthEvent[]> {
    return this.getAuditLogsByType('login_failed', limit);
  }

  /**
   * Get authentication summary for a user
   */
  public async getAuthSummaryForUser(userId: string): Promise<{
    totalLogins: number;
    totalFailedAttempts: number;
    lastLoginAt: string | null;
    tokensCreated: number;
    profileUpdates: number;
    recentActivity: AuthEvent[];
  }> {
    try {
      const logs = await this.getAuditLogsForUser(userId, 1000);
      
      const summary = {
        totalLogins: logs.filter(log => log.event_type === 'login').length,
        totalFailedAttempts: logs.filter(log => log.event_type === 'login_failed').length,
        lastLoginAt: logs.find(log => log.event_type === 'login')?.created_at || null,
        tokensCreated: logs.filter(log => log.event_type === 'token_created').length,
        profileUpdates: logs.filter(log => log.event_type === 'profile_updated').length,
        recentActivity: logs.slice(0, 10)
      };

      return summary;
    } catch (error) {
      console.error('AuthService: Failed to get auth summary for user:', error);
      return {
        totalLogins: 0,
        totalFailedAttempts: 0,
        lastLoginAt: null,
        tokensCreated: 0,
        profileUpdates: 0,
        recentActivity: []
      };
    }
  }

  /**
   * Get system-wide authentication statistics (admin only)
   */
  public async getSystemAuthStats(): Promise<{
    totalUsers: number;
    activeUsersToday: number;
    activeUsersThisWeek: number;
    totalLogins: number;
    totalFailedAttempts: number;
    topEventTypes: Array<{ event_type: string; count: number }>;
  }> {
    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Get all recent logs for analysis
      const { data: allLogs, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .gte('created_at', weekAgo.toISOString());

      if (error) {
        throw error;
      }

      const logs = allLogs || [];
      
      // Count unique users
      const uniqueUsersToday = new Set(
        logs
          .filter(log => log.created_at && new Date(log.created_at) >= dayAgo)
          .map(log => log.user_id)
          .filter(Boolean)
      ).size;

      const uniqueUsersThisWeek = new Set(
        logs.map(log => log.user_id).filter(Boolean)
      ).size;

      // Count event types
      const eventTypeCounts = logs.reduce((acc, log) => {
        acc[log.event_type] = (acc[log.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topEventTypes = Object.entries(eventTypeCounts)
        .map(([event_type, count]) => ({ event_type, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalUsers: uniqueUsersThisWeek,
        activeUsersToday: uniqueUsersToday,
        activeUsersThisWeek: uniqueUsersThisWeek,
        totalLogins: eventTypeCounts['login'] || 0,
        totalFailedAttempts: eventTypeCounts['login_failed'] || 0,
        topEventTypes
      };
    } catch (error) {
      console.error('AuthService: Failed to get system auth stats:', error);
      return {
        totalUsers: 0,
        activeUsersToday: 0,
        activeUsersThisWeek: 0,
        totalLogins: 0,
        totalFailedAttempts: 0,
        topEventTypes: []
      };
    }
  }

  /**
   * Log a custom authentication event
   */
  public async logCustomAuthEvent(
    eventType: AuthEventType,
    metadata?: Record<string, any>,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const event: AuthEvent = {
        user_id: userId || this.currentSession?.user?.id,
        event_type: eventType,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert(event);

      if (error) {
        console.error('AuthService: Error logging custom auth event:', error);
      }
    } catch (error) {
      console.error('AuthService: Failed to log custom auth event:', error);
    }
  }

  /**
   * Clean up old audit logs (admin only)
   * Removes logs older than specified days
   */
  public async cleanupOldAuditLogs(daysToKeep: number = 90): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        console.error('AuthService: Error cleaning up old audit logs:', error);
        return { success: false, error: error.message };
      }

      const deletedCount = data?.length || 0;
      
      // Log the cleanup event
      await this.logCustomAuthEvent('profile_updated', {
        action: 'audit_log_cleanup',
        days_kept: daysToKeep,
        deleted_count: deletedCount
      });

      console.log(`AuthService: Cleaned up ${deletedCount} old audit log entries`);
      return { success: true, deletedCount };
    } catch (error) {
      console.error('AuthService: Failed to cleanup old audit logs:', error);
      return { success: false, error: 'Failed to cleanup old audit logs' };
    }
  }

  /**
   * Export audit logs for a user (admin only)
   */
  public async exportAuditLogsForUser(userId: string): Promise<{ success: boolean; data?: AuthEvent[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('AuthService: Error exporting audit logs:', error);
        return { success: false, error: error.message };
      }

      // Log the export event
      await this.logCustomAuthEvent('profile_updated', {
        action: 'audit_log_export',
        exported_user_id: userId,
        record_count: data?.length || 0
      });

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('AuthService: Failed to export audit logs:', error);
      return { success: false, error: 'Failed to export audit logs' };
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();