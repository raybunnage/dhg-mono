/**
 * Authentication Service (Refactored)
 * 
 * Provides unified authentication for both CLI and web applications
 * using Supabase Auth with enhanced session management and security features.
 * 
 * Refactored to extend SingletonService for proper resource management.
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
import { SingletonService } from '../base/SingletonService';
import { SupabaseClientService } from '../supabase-client';

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

// Environment abstraction for Node.js dependencies
interface EnvironmentAdapter {
  createHash(algorithm: string): { update(data: string): void; digest(encoding: string): string };
  readFileSync(path: string): string;
  writeFileSync(path: string, data: string): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: any): void;
  homedir(): string;
  joinPath(...paths: string[]): string;
}

// Node.js environment adapter
class NodeEnvironmentAdapter implements EnvironmentAdapter {
  private crypto = require('crypto');
  private fs = require('fs');
  private path = require('path');
  private os = require('os');

  createHash(algorithm: string) {
    return this.crypto.createHash(algorithm);
  }

  readFileSync(path: string): string {
    return this.fs.readFileSync(path, 'utf8');
  }

  writeFileSync(path: string, data: string): void {
    this.fs.writeFileSync(path, data, 'utf8');
  }

  existsSync(path: string): boolean {
    return this.fs.existsSync(path);
  }

  mkdirSync(path: string, options?: any): void {
    this.fs.mkdirSync(path, options);
  }

  homedir(): string {
    return this.os.homedir();
  }

  joinPath(...paths: string[]): string {
    return this.path.join(...paths);
  }
}

// Browser environment adapter (placeholder - CLI tokens not supported)
class BrowserEnvironmentAdapter implements EnvironmentAdapter {
  createHash(algorithm: string) {
    throw new Error('Hash creation not supported in browser environment');
  }

  readFileSync(path: string): string {
    throw new Error('File system access not supported in browser environment');
  }

  writeFileSync(path: string, data: string): void {
    throw new Error('File system access not supported in browser environment');
  }

  existsSync(path: string): boolean {
    return false;
  }

  mkdirSync(path: string, options?: any): void {
    throw new Error('File system access not supported in browser environment');
  }

  homedir(): string {
    throw new Error('Home directory access not supported in browser environment');
  }

  joinPath(...paths: string[]): string {
    return paths.join('/');
  }
}

interface AuthServiceConfig {
  environment?: 'cli' | 'web' | 'auto';
  enableAuditLogging?: boolean;
  sessionRefreshInterval?: number;
  cliTokenExpiryDays?: number;
}

interface ServiceMetrics {
  totalSessions: number;
  activeSessions: number;
  totalSignIns: number;
  totalSignUps: number;
  totalSignOuts: number;
  totalCLITokens: number;
  totalAuditEvents: number;
  averageSessionDuration: number;
  lastActivity: Date | null;
}

/**
 * Authentication Service
 * SingletonService implementation for authentication management
 */
export class AuthService extends SingletonService {
  private static instance: AuthService;
  private supabase: SupabaseClient;
  private config: AuthServiceConfig;
  private envAdapter: EnvironmentAdapter;
  
  // Service state
  private currentSession: AuthSession | null = null;
  private authStateSubscription: Subscription | null = null;
  private sessionRefreshTimer: NodeJS.Timeout | null = null;
  private environment: 'cli' | 'web' = 'web';
  
  // Metrics
  private metrics: ServiceMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    totalSignIns: 0,
    totalSignUps: 0,
    totalSignOuts: 0,
    totalCLITokens: 0,
    totalAuditEvents: 0,
    averageSessionDuration: 0,
    lastActivity: null
  };

  protected constructor(config: AuthServiceConfig = {}) {
    super('AuthService', 'Authentication and authorization management');
    
    this.config = {
      environment: 'auto',
      enableAuditLogging: true,
      sessionRefreshInterval: 5 * 60 * 1000, // 5 minutes
      cliTokenExpiryDays: 90,
      ...config
    };

    // Initialize Supabase client
    this.supabase = SupabaseClientService.getInstance().getClient();
    
    // Detect and set up environment
    this.environment = this.config.environment === 'auto' ? this.detectEnvironment() : this.config.environment!;
    this.envAdapter = this.environment === 'cli' ? new NodeEnvironmentAdapter() : new BrowserEnvironmentAdapter();
    
    this.logger.info('AuthService: Initializing authentication service', {
      environment: this.environment,
      auditLogging: this.config.enableAuditLogging
    });
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: AuthServiceConfig): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(config);
    }
    return AuthService.instance;
  }

  /**
   * Initialize the service
   */
  protected async doInitialize(): Promise<void> {
    try {
      // Initialize session if in web environment
      if (this.environment === 'web') {
        await this.initializeWebSession();
      }

      // Set up session refresh timer
      if (this.config.sessionRefreshInterval && this.config.sessionRefreshInterval > 0) {
        this.sessionRefreshTimer = setInterval(
          () => this.refreshSession(),
          this.config.sessionRefreshInterval
        );
      }

      this.logger.info('AuthService: Service initialized successfully');
    } catch (error) {
      this.logger.error('AuthService: Failed to initialize service', { error });
      throw error;
    }
  }

  /**
   * Shutdown the service
   */
  protected async doShutdown(): Promise<void> {
    try {
      // Clear session refresh timer
      if (this.sessionRefreshTimer) {
        clearInterval(this.sessionRefreshTimer);
        this.sessionRefreshTimer = null;
      }

      // Unsubscribe from auth state changes
      if (this.authStateSubscription) {
        this.authStateSubscription.unsubscribe();
        this.authStateSubscription = null;
      }

      // Clear current session
      this.currentSession = null;

      this.logger.info('AuthService: Service shutdown complete');
    } catch (error) {
      this.logger.error('AuthService: Error during shutdown', { error });
      throw error;
    }
  }

  /**
   * Check service health
   */
  public async checkHealth(): Promise<{ healthy: boolean; details: any }> {
    try {
      // Test Supabase connection
      const { data, error } = await this.supabase.auth.getSession();
      
      const details = {
        supabaseConnection: !error,
        currentSession: !!this.currentSession,
        environment: this.environment,
        metrics: this.metrics,
        config: {
          auditLogging: this.config.enableAuditLogging,
          sessionRefreshInterval: this.config.sessionRefreshInterval
        }
      };

      const healthy = !error;
      
      return { healthy, details };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          supabaseConnection: false,
          currentSession: false
        }
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  // CLI token storage location (only available in Node.js environment)
  private get CLI_TOKEN_PATH(): string {
    if (this.environment !== 'cli') {
      throw new Error('CLI token path only available in CLI environment');
    }
    return this.envAdapter.joinPath(this.envAdapter.homedir(), '.dhg', 'auth.json');
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
        this.logger.warn('AuthService: Error getting initial session', { error: error.message });
        return;
      }

      if (session) {
        this.currentSession = this.transformSession(session);
        this.metrics.activeSessions = 1;
        this.metrics.lastActivity = new Date();
        this.logger.info('AuthService: Restored existing session', { userId: session.user.id });
      }
    } catch (error) {
      this.logger.error('AuthService: Failed to initialize web session', { error });
    }
  }

  /**
   * Transform Supabase session to AuthSession
   */
  private transformSession(session: Session): AuthSession {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      user: this.transformUser(session.user),
      tokenType: session.token_type || 'bearer'
    };
  }

  /**
   * Transform Supabase user to AppUser
   */
  private transformUser(user: User): AppUser {
    return {
      id: user.id,
      email: user.email || '',
      emailVerified: !!user.email_confirmed_at,
      phoneVerified: !!user.phone_confirmed_at,
      lastSignIn: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
      metadata: user.user_metadata || {},
      appMetadata: user.app_metadata || {}
    };
  }

  /**
   * Sign in with email and password
   */
  public async signIn(email: string, password: string, options?: AuthOptions): Promise<AuthResult> {
    try {
      this.logger.info('AuthService: Attempting sign in', { email, hasOptions: !!options });

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: options?.captchaToken
        }
      });

      if (error) {
        this.logger.warn('AuthService: Sign in failed', { email, error: error.message });
        
        // Log failed attempt if audit logging enabled
        if (this.config.enableAuditLogging) {
          await this.logAuthEvent('sign_in_failed', null, { 
            email, 
            error: error.message,
            ip_address: options?.ipAddress
          });
        }

        return {
          success: false,
          error: error.message,
          user: null,
          session: null
        };
      }

      // Update metrics
      this.metrics.totalSignIns++;
      this.metrics.totalSessions++;
      this.metrics.activeSessions = 1;
      this.metrics.lastActivity = new Date();

      const authSession = data.session ? this.transformSession(data.session) : null;
      const appUser = data.user ? this.transformUser(data.user) : null;

      this.currentSession = authSession;

      // Log successful sign in
      if (this.config.enableAuditLogging && appUser) {
        await this.logAuthEvent('sign_in_success', appUser.id, {
          email,
          ip_address: options?.ipAddress,
          user_agent: options?.userAgent
        });
      }

      this.logger.info('AuthService: Sign in successful', { userId: appUser?.id });

      return {
        success: true,
        error: null,
        user: appUser,
        session: authSession
      };
    } catch (error) {
      this.logger.error('AuthService: Sign in error', { email, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed',
        user: null,
        session: null
      };
    }
  }

  /**
   * Sign up with email and password
   */
  public async signUp(email: string, password: string, options?: SignUpOptions): Promise<AuthResult> {
    try {
      this.logger.info('AuthService: Attempting sign up', { email, hasOptions: !!options });

      const signUpData: any = {
        email,
        password,
        options: {
          captchaToken: options?.captchaToken,
          data: options?.userData || {}
        }
      };

      // Add redirect URL if provided
      if (options?.redirectTo) {
        signUpData.options.emailRedirectTo = options.redirectTo;
      }

      const { data, error } = await this.supabase.auth.signUp(signUpData);

      if (error) {
        this.logger.warn('AuthService: Sign up failed', { email, error: error.message });
        
        // Log failed attempt
        if (this.config.enableAuditLogging) {
          await this.logAuthEvent('sign_up_failed', null, { 
            email, 
            error: error.message,
            ip_address: options?.ipAddress
          });
        }

        return {
          success: false,
          error: error.message,
          user: null,
          session: null
        };
      }

      // Update metrics
      this.metrics.totalSignUps++;
      if (data.session) {
        this.metrics.totalSessions++;
        this.metrics.activeSessions = 1;
      }
      this.metrics.lastActivity = new Date();

      const authSession = data.session ? this.transformSession(data.session) : null;
      const appUser = data.user ? this.transformUser(data.user) : null;

      this.currentSession = authSession;

      // Log successful sign up
      if (this.config.enableAuditLogging && appUser) {
        await this.logAuthEvent('sign_up_success', appUser.id, {
          email,
          email_confirmed: !!data.user?.email_confirmed_at,
          ip_address: options?.ipAddress,
          user_agent: options?.userAgent
        });
      }

      this.logger.info('AuthService: Sign up successful', { 
        userId: appUser?.id, 
        emailConfirmed: !!data.user?.email_confirmed_at 
      });

      return {
        success: true,
        error: null,
        user: appUser,
        session: authSession
      };
    } catch (error) {
      this.logger.error('AuthService: Sign up error', { email, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign up failed',
        user: null,
        session: null
      };
    }
  }

  /**
   * Sign out current user
   */
  public async signOut(): Promise<void> {
    try {
      const currentUserId = this.currentSession?.user?.id;
      
      this.logger.info('AuthService: Attempting sign out', { userId: currentUserId });

      const { error } = await this.supabase.auth.signOut();

      if (error) {
        this.logger.warn('AuthService: Sign out failed', { error: error.message });
        throw new Error(`Sign out failed: ${error.message}`);
      }

      // Update metrics
      this.metrics.totalSignOuts++;
      this.metrics.activeSessions = 0;
      this.metrics.lastActivity = new Date();

      // Log sign out
      if (this.config.enableAuditLogging && currentUserId) {
        await this.logAuthEvent('sign_out', currentUserId);
      }

      // Clear current session
      this.currentSession = null;

      this.logger.info('AuthService: Sign out successful', { userId: currentUserId });
    } catch (error) {
      this.logger.error('AuthService: Sign out error', { error });
      throw error;
    }
  }

  /**
   * Get current session
   */
  public async getSession(): Promise<AuthSession | null> {
    try {
      if (this.currentSession) {
        // Check if session is still valid
        const isValid = await this.validateSession();
        if (isValid) {
          return this.currentSession;
        }
      }

      // Try to get session from Supabase
      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (error) {
        this.logger.warn('AuthService: Error getting session', { error: error.message });
        return null;
      }

      if (session) {
        this.currentSession = this.transformSession(session);
        this.metrics.lastActivity = new Date();
        return this.currentSession;
      }

      return null;
    } catch (error) {
      this.logger.error('AuthService: Get session error', { error });
      return null;
    }
  }

  /**
   * Refresh current session
   */
  public async refreshSession(): Promise<AuthSession | null> {
    try {
      this.logger.debug('AuthService: Refreshing session');

      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        this.logger.warn('AuthService: Session refresh failed', { error: error.message });
        this.currentSession = null;
        return null;
      }

      if (data.session) {
        this.currentSession = this.transformSession(data.session);
        this.metrics.lastActivity = new Date();
        this.logger.debug('AuthService: Session refreshed successfully');
        return this.currentSession;
      }

      return null;
    } catch (error) {
      this.logger.error('AuthService: Session refresh error', { error });
      return null;
    }
  }

  /**
   * Validate current session
   */
  public async validateSession(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        return false;
      }

      // Check if session has expired
      if (this.currentSession.expiresAt && this.currentSession.expiresAt <= new Date()) {
        this.logger.debug('AuthService: Session expired');
        return false;
      }

      // Try to get user from Supabase to validate session
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        this.logger.debug('AuthService: Session validation failed', { error: error?.message });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('AuthService: Session validation error', { error });
      return false;
    }
  }

  /**
   * Get current user
   */
  public async getCurrentUser(): Promise<AppUser | null> {
    try {
      const session = await this.getSession();
      return session?.user || null;
    } catch (error) {
      this.logger.error('AuthService: Get current user error', { error });
      return null;
    }
  }

  /**
   * Update user profile
   */
  public async updateUserProfile(updates: UserProfileUpdate): Promise<AppUser> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      this.logger.info('AuthService: Updating user profile', { userId: currentUser.id });

      const updateData: any = {};

      if (updates.email) {
        updateData.email = updates.email;
      }

      if (updates.password) {
        updateData.password = updates.password;
      }

      if (updates.metadata) {
        updateData.data = { ...currentUser.metadata, ...updates.metadata };
      }

      const { data, error } = await this.supabase.auth.updateUser(updateData);

      if (error) {
        this.logger.warn('AuthService: Profile update failed', { 
          userId: currentUser.id, 
          error: error.message 
        });
        throw new Error(`Profile update failed: ${error.message}`);
      }

      const updatedUser = data.user ? this.transformUser(data.user) : currentUser;

      // Update current session user
      if (this.currentSession) {
        this.currentSession.user = updatedUser;
      }

      // Log profile update
      if (this.config.enableAuditLogging) {
        await this.logAuthEvent('profile_updated', currentUser.id, {
          updated_fields: Object.keys(updates),
          email_changed: !!updates.email,
          password_changed: !!updates.password
        });
      }

      this.metrics.lastActivity = new Date();
      this.logger.info('AuthService: Profile updated successfully', { userId: currentUser.id });

      return updatedUser;
    } catch (error) {
      this.logger.error('AuthService: Update user profile error', { error });
      throw error;
    }
  }

  /**
   * Authenticate CLI with API key
   */
  public async authenticateCLI(apiKey?: string): Promise<AuthSession | null> {
    if (this.environment !== 'cli') {
      throw new Error('CLI authentication only available in CLI environment');
    }

    try {
      let token: string;

      if (apiKey) {
        // Use provided API key
        token = apiKey;
        this.logger.info('AuthService: Using provided API key for CLI authentication');
      } else {
        // Try to load stored CLI token
        try {
          const tokenData = this.loadCLIToken();
          if (!tokenData || !tokenData.token || new Date(tokenData.expiresAt) <= new Date()) {
            throw new Error('No valid CLI token found');
          }
          token = tokenData.token;
          this.logger.info('AuthService: Using stored CLI token');
        } catch (error) {
          throw new Error('No valid CLI token found. Please provide an API key or create a CLI token.');
        }
      }

      // Authenticate with the token
      const { data, error } = await this.supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
      });

      if (error || !data.session) {
        this.logger.warn('AuthService: CLI authentication failed', { error: error?.message });
        throw new Error(`CLI authentication failed: ${error?.message || 'Unknown error'}`);
      }

      this.currentSession = this.transformSession(data.session);
      this.metrics.totalSessions++;
      this.metrics.activeSessions = 1;
      this.metrics.lastActivity = new Date();

      // Log successful CLI authentication
      if (this.config.enableAuditLogging) {
        await this.logAuthEvent('cli_auth_success', this.currentSession.user.id, {
          auth_method: apiKey ? 'api_key' : 'cli_token'
        });
      }

      this.logger.info('AuthService: CLI authentication successful', { 
        userId: this.currentSession.user.id 
      });

      return this.currentSession;
    } catch (error) {
      this.logger.error('AuthService: CLI authentication error', { error });
      throw error;
    }
  }

  /**
   * Load CLI token from file system
   */
  private loadCLIToken(): { token: string; expiresAt: string } | null {
    try {
      if (!this.envAdapter.existsSync(this.CLI_TOKEN_PATH)) {
        return null;
      }

      const tokenData = JSON.parse(this.envAdapter.readFileSync(this.CLI_TOKEN_PATH));
      return tokenData;
    } catch (error) {
      this.logger.warn('AuthService: Error loading CLI token', { error });
      return null;
    }
  }

  /**
   * Save CLI token to file system
   */
  private saveCLIToken(token: string, expiresAt: string): void {
    try {
      const tokenDir = this.envAdapter.joinPath(this.envAdapter.homedir(), '.dhg');
      
      if (!this.envAdapter.existsSync(tokenDir)) {
        this.envAdapter.mkdirSync(tokenDir, { recursive: true });
      }

      const tokenData = {
        token,
        expiresAt,
        createdAt: new Date().toISOString()
      };

      this.envAdapter.writeFileSync(this.CLI_TOKEN_PATH, JSON.stringify(tokenData, null, 2));
      this.logger.info('AuthService: CLI token saved');
    } catch (error) {
      this.logger.error('AuthService: Error saving CLI token', { error });
      throw error;
    }
  }

  /**
   * Create CLI token
   */
  public async createCLIToken(name: string, expiresInDays: number = 90): Promise<string> {
    if (this.environment !== 'cli') {
      throw new Error('CLI token creation only available in CLI environment');
    }

    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('Must be authenticated to create CLI token');
      }

      this.logger.info('AuthService: Creating CLI token', { 
        userId: currentUser.id, 
        name, 
        expiresInDays 
      });

      // Generate a secure token
      const hash = this.envAdapter.createHash('sha256');
      hash.update(`${currentUser.id}-${name}-${Date.now()}-${Math.random()}`);
      const token = hash.digest('hex');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Store token in database
      const { data, error } = await this.supabase
        .from('cli_auth_tokens')
        .insert({
          user_id: currentUser.id,
          token_name: name,
          token_hash: token,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        this.logger.error('AuthService: Error storing CLI token', { error });
        throw new Error(`Failed to create CLI token: ${error.message}`);
      }

      // Save token locally
      this.saveCLIToken(token, expiresAt.toISOString());

      this.metrics.totalCLITokens++;
      this.metrics.lastActivity = new Date();

      // Log token creation
      if (this.config.enableAuditLogging) {
        await this.logAuthEvent('cli_token_created', currentUser.id, {
          token_name: name,
          expires_in_days: expiresInDays,
          token_id: data.id
        });
      }

      this.logger.info('AuthService: CLI token created successfully', { 
        userId: currentUser.id, 
        tokenId: data.id 
      });

      return token;
    } catch (error) {
      this.logger.error('AuthService: Create CLI token error', { error });
      throw error;
    }
  }

  /**
   * Revoke CLI token
   */
  public async revokeCLIToken(tokenId: string): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('Must be authenticated to revoke CLI token');
      }

      this.logger.info('AuthService: Revoking CLI token', { userId: currentUser.id, tokenId });

      const { error } = await this.supabase
        .from('cli_auth_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', tokenId)
        .eq('user_id', currentUser.id);

      if (error) {
        this.logger.error('AuthService: Error revoking CLI token', { error });
        throw new Error(`Failed to revoke CLI token: ${error.message}`);
      }

      // Log token revocation
      if (this.config.enableAuditLogging) {
        await this.logAuthEvent('cli_token_revoked', currentUser.id, {
          token_id: tokenId
        });
      }

      this.metrics.lastActivity = new Date();
      this.logger.info('AuthService: CLI token revoked successfully', { 
        userId: currentUser.id, 
        tokenId 
      });
    } catch (error) {
      this.logger.error('AuthService: Revoke CLI token error', { error });
      throw error;
    }
  }

  /**
   * List CLI tokens for current user
   */
  public async listCLITokens(): Promise<CLIAuthToken[]> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('Must be authenticated to list CLI tokens');
      }

      const { data, error } = await this.supabase
        .from('cli_auth_tokens')
        .select('id, token_name, expires_at, created_at, revoked_at, last_used_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('AuthService: Error listing CLI tokens', { error });
        throw new Error(`Failed to list CLI tokens: ${error.message}`);
      }

      return (data || []).map(token => ({
        id: token.id,
        name: token.token_name,
        expiresAt: new Date(token.expires_at),
        createdAt: new Date(token.created_at),
        revokedAt: token.revoked_at ? new Date(token.revoked_at) : null,
        lastUsedAt: token.last_used_at ? new Date(token.last_used_at) : null,
        isExpired: new Date(token.expires_at) <= new Date(),
        isRevoked: !!token.revoked_at
      }));
    } catch (error) {
      this.logger.error('AuthService: List CLI tokens error', { error });
      throw error;
    }
  }

  /**
   * Send magic link for passwordless authentication
   */
  public async sendMagicLink(options: MagicLinkOptions): Promise<AuthResult> {
    try {
      this.logger.info('AuthService: Sending magic link', { email: options.email });

      const { data, error } = await this.supabase.auth.signInWithOtp({
        email: options.email,
        options: {
          emailRedirectTo: options.redirectTo,
          captchaToken: options.captchaToken
        }
      });

      if (error) {
        this.logger.warn('AuthService: Magic link failed', { 
          email: options.email, 
          error: error.message 
        });

        // Log failed attempt
        if (this.config.enableAuditLogging) {
          await this.logAuthEvent('magic_link_failed', null, {
            email: options.email,
            error: error.message
          });
        }

        return {
          success: false,
          error: error.message,
          user: null,
          session: null
        };
      }

      // Log magic link sent
      if (this.config.enableAuditLogging) {
        await this.logAuthEvent('magic_link_sent', null, {
          email: options.email,
          redirect_to: options.redirectTo
        });
      }

      this.metrics.lastActivity = new Date();
      this.logger.info('AuthService: Magic link sent successfully', { email: options.email });

      return {
        success: true,
        error: null,
        user: data.user ? this.transformUser(data.user) : null,
        session: data.session ? this.transformSession(data.session) : null
      };
    } catch (error) {
      this.logger.error('AuthService: Send magic link error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Magic link failed',
        user: null,
        session: null
      };
    }
  }

  /**
   * Sign in with OAuth provider
   */
  public async signInWithOAuth(options: OAuthOptions): Promise<AuthResult> {
    try {
      this.logger.info('AuthService: OAuth sign in', { provider: options.provider });

      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: options.provider,
        options: {
          redirectTo: options.redirectTo,
          scopes: options.scopes,
          queryParams: options.queryParams
        }
      });

      if (error) {
        this.logger.warn('AuthService: OAuth sign in failed', { 
          provider: options.provider, 
          error: error.message 
        });

        // Log failed attempt
        if (this.config.enableAuditLogging) {
          await this.logAuthEvent('oauth_failed', null, {
            provider: options.provider,
            error: error.message
          });
        }

        return {
          success: false,
          error: error.message,
          user: null,
          session: null
        };
      }

      // Log OAuth attempt
      if (this.config.enableAuditLogging) {
        await this.logAuthEvent('oauth_initiated', null, {
          provider: options.provider,
          redirect_to: options.redirectTo
        });
      }

      this.metrics.lastActivity = new Date();
      this.logger.info('AuthService: OAuth initiated successfully', { provider: options.provider });

      return {
        success: true,
        error: null,
        user: data.user ? this.transformUser(data.user) : null,
        session: data.session ? this.transformSession(data.session) : null
      };
    } catch (error) {
      this.logger.error('AuthService: OAuth sign in error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth sign in failed',
        user: null,
        session: null
      };
    }
  }

  /**
   * Check if user has specific permission
   */
  public async hasPermission(permission: string): Promise<boolean> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return false;
      }

      // Check user permissions (implementation depends on your permission system)
      const { data, error } = await this.supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', currentUser.id)
        .eq('permission', permission)
        .single();

      return !error && !!data;
    } catch (error) {
      this.logger.error('AuthService: Permission check error', { permission, error });
      return false;
    }
  }

  /**
   * Get user roles
   */
  public async getUserRoles(): Promise<string[]> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);

      if (error) {
        this.logger.error('AuthService: Get roles error', { error });
        return [];
      }

      return (data || []).map(item => item.role);
    } catch (error) {
      this.logger.error('AuthService: Get user roles error', { error });
      return [];
    }
  }

  /**
   * Subscribe to auth state changes
   */
  public onAuthStateChange(callback: (user: AppUser | null) => void): Subscription {
    const { data } = this.supabase.auth.onAuthStateChange(async (event, session) => {
      this.logger.debug('AuthService: Auth state changed', { event });

      let user: AppUser | null = null;

      if (session?.user) {
        user = this.transformUser(session.user);
        this.currentSession = this.transformSession(session);
        this.metrics.activeSessions = 1;
      } else {
        this.currentSession = null;
        this.metrics.activeSessions = 0;
      }

      this.metrics.lastActivity = new Date();

      // Log auth state change
      if (this.config.enableAuditLogging && user) {
        await this.logAuthEvent(`auth_${event}` as AuthEventType, user.id, {
          event,
          session_id: session?.access_token?.slice(-8)
        });
      }

      callback(user);
    });

    this.authStateSubscription = data.subscription;
    return data.subscription;
  }

  /**
   * Log authentication event for audit trail
   */
  private async logAuthEvent(eventType: AuthEventType, userId: string | null, metadata?: Record<string, any>): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert({
          user_id: userId,
          event_type: eventType,
          ip_address: metadata?.ip_address || null,
          user_agent: metadata?.user_agent || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          created_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('AuthService: Error logging auth event', { eventType, error });
      } else {
        this.metrics.totalAuditEvents++;
      }
    } catch (error) {
      this.logger.error('AuthService: Failed to log auth event', { eventType, error });
    }
  }

  /**
   * Log custom authentication event
   */
  public async logCustomAuthEvent(eventType: AuthEventType, metadata?: Record<string, any>): Promise<void> {
    const currentUser = await this.getCurrentUser();
    await this.logAuthEvent(eventType, currentUser?.id || null, metadata);
  }

  /**
   * Clean up old audit logs (admin only)
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
        this.logger.error('AuthService: Error cleaning up old audit logs', { error });
        return { success: false, error: error.message };
      }

      const deletedCount = data?.length || 0;
      
      // Log the cleanup event
      await this.logCustomAuthEvent('profile_updated', {
        action: 'audit_log_cleanup',
        days_kept: daysToKeep,
        deleted_count: deletedCount
      });

      this.logger.info('AuthService: Cleaned up old audit log entries', { deletedCount });
      return { success: true, deletedCount };
    } catch (error) {
      this.logger.error('AuthService: Failed to cleanup old audit logs', { error });
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
        this.logger.error('AuthService: Error exporting audit logs', { error });
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
      this.logger.error('AuthService: Failed to export audit logs', { error });
      return { success: false, error: 'Failed to export audit logs' };
    }
  }
}

// DO NOT export instance - use getInstance() instead
export { AuthService };