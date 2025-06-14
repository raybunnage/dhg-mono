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
import { SingletonService } from '../base-classes/SingletonService';
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
  createHash(algorithm: string): { update(data: string): void; digest(encoding: string): string } {
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
class AuthService extends SingletonService {
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
    super('AuthService');
    
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
    
    this.logger?.info('AuthService: Initializing authentication service', {
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
   * Initialize the service (BaseService requirement)
   */
  protected async initialize(): Promise<void> {
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

      this.logger?.info('AuthService: Service initialized successfully');
    } catch (error) {
      this.logger?.error('AuthService: Failed to initialize service', { error });
      throw error;
    }
  }

  /**
   * Release resources (SingletonService requirement)
   */
  protected async releaseResources(): Promise<void> {
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

      this.logger?.info('AuthService: Resources released successfully');
    } catch (error) {
      this.logger?.error('AuthService: Error during resource release', { error });
      throw error;
    }
  }

  /**
   * Cleanup method (BaseService requirement)
   */
  protected async cleanup(): Promise<void> {
    await this.releaseResources();
  }

  /**
   * Check service health (BaseService requirement)
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
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
      
      return { healthy, details, timestamp: new Date() };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          supabaseConnection: false,
          currentSession: false
        },
        timestamp: new Date()
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
        this.logger?.warn('AuthService: Error getting initial session', { error: error.message });
        return;
      }

      if (session) {
        this.currentSession = this.transformSession(session);
        this.metrics.activeSessions = 1;
        this.metrics.lastActivity = new Date();
        this.logger?.info('AuthService: Restored existing session', { userId: session.user.id });
      }
    } catch (error) {
      this.logger?.error('AuthService: Failed to initialize web session', { error });
    }
  }

  /**
   * Transform Supabase session to AuthSession
   */
  private transformSession(session: Session): AuthSession {
    const authSession: AuthSession = {
      ...session,
      user: this.transformUser(session.user),
      environment: this.environment
    };
    return authSession;
  }

  /**
   * Transform Supabase user to AppUser
   */
  private transformUser(user: User): AppUser {
    return {
      ...user,
      profile: undefined, // Can be populated from user_profiles table
      roles: [],
      permissions: []
    };
  }

  /**
   * Sign in with email and password
   */
  public async signIn(email: string, password: string, options?: AuthOptions): Promise<AuthResult> {
    this.ensureInitialized();
    
    try {
      this.logger?.info('AuthService: Attempting sign in', { email, hasOptions: !!options });

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        this.logger?.warn('AuthService: Sign in failed', { email, error: error.message });
        
        // Log failed attempt if audit logging enabled
        if (this.config.enableAuditLogging) {
          await this.logAuthEvent('login_failed', null, { 
            email, 
            error: error.message
          });
        }

        return {
          error,
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
        await this.logAuthEvent('login', appUser.id, {
          email
        });
      }

      this.logger?.info('AuthService: Sign in successful', { userId: appUser?.id });

      return {
        error: null,
        user: appUser,
        session: authSession
      };
    } catch (error) {
      this.logger?.error('AuthService: Sign in error', { email, error });
      return {
        error: error as AuthError,
        user: null,
        session: null
      };
    }
  }

  /**
   * Sign up with email and password
   */
  public async signUp(email: string, password: string, options?: SignUpOptions): Promise<AuthResult> {
    this.ensureInitialized();
    
    try {
      this.logger?.info('AuthService: Attempting sign up', { email, hasOptions: !!options });

      const signUpData: any = {
        email,
        password,
        options: {
          data: options?.data || {}
        }
      };

      // Add redirect URL if provided
      if (options?.emailRedirectTo) {
        signUpData.options.emailRedirectTo = options.emailRedirectTo;
      }

      const { data, error } = await this.supabase.auth.signUp(signUpData);

      if (error) {
        this.logger?.warn('AuthService: Sign up failed', { email, error: error.message });
        
        return {
          error,
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

      this.logger?.info('AuthService: Sign up successful', { 
        userId: appUser?.id, 
        emailConfirmed: !!data.user?.email_confirmed_at 
      });

      return {
        error: null,
        user: appUser,
        session: authSession
      };
    } catch (error) {
      this.logger?.error('AuthService: Sign up error', { email, error });
      return {
        error: error as AuthError,
        user: null,
        session: null
      };
    }
  }

  /**
   * Sign out current user
   */
  public async signOut(): Promise<void> {
    this.ensureInitialized();
    
    try {
      const currentUserId = this.currentSession?.user?.id;
      
      this.logger?.info('AuthService: Attempting sign out', { userId: currentUserId });

      const { error } = await this.supabase.auth.signOut();

      if (error) {
        this.logger?.warn('AuthService: Sign out failed', { error: error.message });
        throw new Error(`Sign out failed: ${error.message}`);
      }

      // Update metrics
      this.metrics.totalSignOuts++;
      this.metrics.activeSessions = 0;
      this.metrics.lastActivity = new Date();

      // Log sign out
      if (this.config.enableAuditLogging && currentUserId) {
        await this.logAuthEvent('logout', currentUserId);
      }

      // Clear current session
      this.currentSession = null;

      this.logger?.info('AuthService: Sign out successful', { userId: currentUserId });
    } catch (error) {
      this.logger?.error('AuthService: Sign out error', { error });
      throw error;
    }
  }

  /**
   * Get current session
   */
  public async getSession(): Promise<AuthSession | null> {
    this.ensureInitialized();
    
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
        this.logger?.warn('AuthService: Error getting session', { error: error.message });
        return null;
      }

      if (session) {
        this.currentSession = this.transformSession(session);
        this.metrics.lastActivity = new Date();
        return this.currentSession;
      }

      return null;
    } catch (error) {
      this.logger?.error('AuthService: Get session error', { error });
      return null;
    }
  }

  /**
   * Refresh current session
   */
  public async refreshSession(): Promise<AuthSession | null> {
    this.ensureInitialized();
    
    try {
      this.logger?.debug('AuthService: Refreshing session');

      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        this.logger?.warn('AuthService: Session refresh failed', { error: error.message });
        this.currentSession = null;
        return null;
      }

      if (data.session) {
        this.currentSession = this.transformSession(data.session);
        this.metrics.lastActivity = new Date();
        this.logger?.debug('AuthService: Session refreshed successfully');
        return this.currentSession;
      }

      return null;
    } catch (error) {
      this.logger?.error('AuthService: Session refresh error', { error });
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
      if (this.currentSession.expires_at && this.currentSession.expires_at <= Math.floor(Date.now() / 1000)) {
        this.logger?.debug('AuthService: Session expired');
        return false;
      }

      // Try to get user from Supabase to validate session
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        this.logger?.debug('AuthService: Session validation failed', { error: error?.message });
        return false;
      }

      return true;
    } catch (error) {
      this.logger?.error('AuthService: Session validation error', { error });
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
      this.logger?.error('AuthService: Get current user error', { error });
      return null;
    }
  }

  /**
   * Send magic link for passwordless authentication
   */
  public async sendMagicLink(options: MagicLinkOptions): Promise<AuthResult> {
    this.ensureInitialized();
    
    try {
      this.logger?.info('AuthService: Sending magic link', { email: options.email });

      const { data, error } = await this.supabase.auth.signInWithOtp({
        email: options.email,
        options: {
          emailRedirectTo: options.redirectTo
        }
      });

      if (error) {
        this.logger?.warn('AuthService: Magic link failed', { 
          email: options.email, 
          error: error.message 
        });

        return {
          error,
          user: null,
          session: null
        };
      }

      this.metrics.lastActivity = new Date();
      this.logger?.info('AuthService: Magic link sent successfully', { email: options.email });

      return {
        error: null,
        user: data.user ? this.transformUser(data.user) : null,
        session: data.session ? this.transformSession(data.session) : null
      };
    } catch (error) {
      this.logger?.error('AuthService: Send magic link error', { error });
      return {
        error: error as AuthError,
        user: null,
        session: null
      };
    }
  }

  /**
   * Sign in with OAuth provider
   */
  public async signInWithOAuth(options: OAuthOptions): Promise<AuthResult> {
    this.ensureInitialized();
    
    try {
      this.logger?.info('AuthService: OAuth sign in', { provider: options.provider });

      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: options.provider,
        options: {
          redirectTo: options.redirectTo,
          scopes: options.scopes
        }
      });

      if (error) {
        this.logger?.warn('AuthService: OAuth sign in failed', { 
          provider: options.provider, 
          error: error.message 
        });

        return {
          error,
          user: null,
          session: null
        };
      }

      this.metrics.lastActivity = new Date();
      this.logger?.info('AuthService: OAuth initiated successfully', { provider: options.provider });

      return {
        error: null,
        user: null,
        session: null
      };
    } catch (error) {
      this.logger?.error('AuthService: OAuth sign in error', { error });
      return {
        error: error as AuthError,
        user: null,
        session: null
      };
    }
  }

  /**
   * Subscribe to auth state changes
   */
  public onAuthStateChange(callback: (user: AppUser | null) => void): Subscription {
    const { data } = this.supabase.auth.onAuthStateChange(async (event, session) => {
      this.logger?.debug('AuthService: Auth state changed', { event });

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
        const eventType = this.mapAuthChangeEventToAuditEvent(event);
        if (eventType) {
          await this.logAuthEvent(eventType, user.id, {
            event,
            session_id: session?.access_token?.slice(-8)
          });
        }
      }

      callback(user);
    });

    this.authStateSubscription = data.subscription;
    return data.subscription;
  }

  /**
   * Map Supabase auth change event to audit event type
   */
  private mapAuthChangeEventToAuditEvent(event: AuthChangeEvent): AuthEventType | null {
    switch (event) {
      case 'SIGNED_IN':
        return 'login';
      case 'SIGNED_OUT':
        return 'logout';
      case 'TOKEN_REFRESHED':
        return 'session_refreshed';
      default:
        return null;
    }
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
        this.logger?.error('AuthService: Error logging auth event', { eventType, error });
      } else {
        this.metrics.totalAuditEvents++;
      }
    } catch (error) {
      this.logger?.error('AuthService: Failed to log auth event', { eventType, error });
    }
  }
}

// Export the class for instantiation via getInstance()
export { AuthService };