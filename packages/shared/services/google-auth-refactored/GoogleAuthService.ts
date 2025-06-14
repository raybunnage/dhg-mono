/**
 * Centralized authentication service for Google Drive
 * Refactored to extend SingletonService
 * 
 * This service provides a unified authentication method for all Google Drive operations,
 * prioritizing service account authentication when available, and falling back to OAuth
 * tokens or environment variables if needed.
 * 
 * Features:
 * - Centralized authentication for all Google Drive services
 * - Prioritizes service account authentication when available
 * - Falls back to OAuth tokens if service account not configured
 * - Automatically refreshes tokens when needed
 * - Can be used in both browser and Node.js environments
 * - Supports multiple storage options (localStorage, file system)
 * - Automatically loads environment variables (.env.development, .env)
 * - Proper lifecycle management with SingletonService
 * - Comprehensive metrics and health checks
 */

import { SingletonService } from '../base-classes/SingletonService';
import { Logger } from '../logger-service/LoggerService';
import { Credentials, GoogleAuth, JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Interface for token storage
export interface GoogleAuthToken {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

// Service account configuration
export interface ServiceAccountConfig {
  keyFilePath?: string;
  keyFileContents?: string;
  scopes: string[];
}

// Configuration options
export interface GoogleAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  tokenStoragePath?: string; // Used by CLI for local token storage
  serviceAccount?: ServiceAccountConfig; // Service account config (preferred when available)
  logger?: Logger;
}

// Storage adapter interface - allows different implementations for UI and CLI
export interface TokenStorageAdapter {
  saveToken(token: GoogleAuthToken): Promise<boolean>;
  loadToken(): Promise<GoogleAuthToken | null>;
  clearToken(): Promise<boolean>;
}

// Service metrics
interface GoogleAuthServiceMetrics {
  authAttempts: number;
  authSuccesses: number;
  authFailures: number;
  tokenRefreshes: number;
  serviceAccountUsed: boolean;
  oauthUsed: boolean;
  storageOperations: number;
  accessTokenRequests: number;
  errors: number;
}

/**
 * Local storage token adapter (for UI)
 */
class LocalStorageAdapter implements TokenStorageAdapter {
  private readonly storageKey: string;

  constructor(storageKey = 'googleAuthToken') {
    this.storageKey = storageKey;
  }

  async saveToken(token: GoogleAuthToken): Promise<boolean> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(token));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save token to localStorage:', error);
      return false;
    }
  }

  async loadToken(): Promise<GoogleAuthToken | null> {
    try {
      if (typeof localStorage !== 'undefined') {
        const tokenStr = localStorage.getItem(this.storageKey);
        if (!tokenStr) return null;
        return JSON.parse(tokenStr) as GoogleAuthToken;
      }
      return null;
    } catch (error) {
      console.error('Failed to load token from localStorage:', error);
      return null;
    }
  }

  async clearToken(): Promise<boolean> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storageKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to clear token from localStorage:', error);
      return false;
    }
  }
}

/**
 * File system token adapter (for CLI)
 */
class FileSystemAdapter implements TokenStorageAdapter {
  private readonly tokenPath: string;

  constructor(tokenPath: string) {
    this.tokenPath = tokenPath;
  }

  async saveToken(token: GoogleAuthToken): Promise<boolean> {
    try {
      fs.writeFileSync(this.tokenPath, JSON.stringify(token, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to save token to ${this.tokenPath}:`, error);
      return false;
    }
  }

  async loadToken(): Promise<GoogleAuthToken | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) {
        return null;
      }
      const data = fs.readFileSync(this.tokenPath, 'utf8');
      return JSON.parse(data) as GoogleAuthToken;
    } catch (error) {
      console.error(`Failed to load token from ${this.tokenPath}:`, error);
      return null;
    }
  }

  async clearToken(): Promise<boolean> {
    try {
      if (fs.existsSync(this.tokenPath)) {
        fs.unlinkSync(this.tokenPath);
      }
      return true;
    } catch (error) {
      console.error(`Failed to clear token from ${this.tokenPath}:`, error);
      return false;
    }
  }
}

/**
 * Shared Google Auth Service
 * Can be used by both UI and CLI
 * Extends SingletonService for proper resource management
 */
export class GoogleAuthService extends SingletonService {
  private static instance: GoogleAuthService;
  private config: GoogleAuthConfig;
  private storage: TokenStorageAdapter;
  private token: GoogleAuthToken | null = null;
  private tokenExpiresAt: Date | null = null;
  private serviceAuthClient: JWT | null = null;
  private usingServiceAccount: boolean = false;
  private initializing: Promise<boolean> | null = null;
  
  // Metrics tracking
  private metrics: GoogleAuthServiceMetrics = {
    authAttempts: 0,
    authSuccesses: 0,
    authFailures: 0,
    tokenRefreshes: 0,
    serviceAccountUsed: false,
    oauthUsed: false,
    storageOperations: 0,
    accessTokenRequests: 0,
    errors: 0
  };

  protected constructor(config: GoogleAuthConfig, storage: TokenStorageAdapter) {
    super('GoogleAuthService', config.logger);
    this.config = this.normalizeConfig(config);
    this.storage = storage;
    
    // Load environment variables if we're in Node
    if (typeof window === 'undefined') {
      // Try to load from .env.development first, then fall back to .env
      dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    }
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: GoogleAuthConfig): GoogleAuthConfig {
    return {
      clientId: config.clientId || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: config.redirectUri || process.env.GOOGLE_REDIRECT_URI || '',
      scopes: config.scopes || ['https://www.googleapis.com/auth/drive.readonly'],
      tokenStoragePath: config.tokenStoragePath || path.resolve(process.cwd(), '.google-tokens.json'),
      serviceAccount: config.serviceAccount,
      logger: config.logger
    };
  }
  
  /**
   * Get singleton instance
   * @param config Configuration options
   * @param storage Storage adapter (default: localStorage or file system)
   */
  public static getInstance(
    config?: GoogleAuthConfig,
    storage?: TokenStorageAdapter
  ): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      const mergedConfig = {
        ...config,
        logger: config?.logger
      };
      
      // Default to local storage if not specified
      const storageAdapter = storage || 
        (typeof window !== 'undefined' && window.localStorage 
          ? new LocalStorageAdapter()
          : new FileSystemAdapter(
              config?.tokenStoragePath || path.resolve(process.cwd(), '.google-tokens.json')
            ));
      
      GoogleAuthService.instance = new GoogleAuthService(mergedConfig, storageAdapter);
    }
    
    return GoogleAuthService.instance;
  }

  /**
   * BaseService requirement: Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('GoogleAuthService: Initializing service');
    
    try {
      this.metrics.authAttempts++;
      
      // First try service account initialization
      if (this.config.serviceAccount) {
        const serviceAccountSuccess = await this.initServiceAccountAuth(this.config.serviceAccount);
        if (serviceAccountSuccess) {
          this.metrics.authSuccesses++;
          this.metrics.serviceAccountUsed = true;
          return;
        }
      }
      
      // If no service account config provided or it failed, check environment variables
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                               process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
                               path.resolve(process.cwd(), '.service-account.json');
      
      if (typeof window === 'undefined' && serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        const serviceAccountSuccess = await this.initServiceAccountAuth({
          keyFilePath: serviceAccountPath,
          scopes: this.config.scopes || []
        });
        if (serviceAccountSuccess) {
          this.metrics.authSuccesses++;
          this.metrics.serviceAccountUsed = true;
          return;
        }
      }
      
      // If service account auth failed, try OAuth
      const token = await this.loadToken();
      if (token) {
        this.metrics.authSuccesses++;
        this.metrics.oauthUsed = true;
      } else {
        this.metrics.authFailures++;
      }
    } catch (error) {
      this.logger?.error('GoogleAuthService: Failed to initialize auth service', error);
      this.metrics.authFailures++;
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * BaseService requirement: Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    this.logger?.info('GoogleAuthService: Cleaning up resources');
    
    // Clear sensitive data
    this.token = null;
    this.tokenExpiresAt = null;
    
    // Clear service account client
    if (this.serviceAuthClient) {
      this.serviceAuthClient = null;
    }
  }

  /**
   * SingletonService requirement: Release expensive resources
   */
  protected async releaseResources(): Promise<void> {
    this.logger?.info('GoogleAuthService: Releasing resources');
    
    // Clear any cached credentials
    this.token = null;
    this.tokenExpiresAt = null;
    this.serviceAuthClient = null;
    this.usingServiceAccount = false;
  }

  /**
   * BaseService requirement: Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Check if we have valid authentication
      const hasValidAuth = await this.hasValidToken();
      
      // Try to get an access token
      let canGetToken = false;
      try {
        const token = await this.getAccessToken();
        canGetToken = !!token;
      } catch (e) {
        // Token retrieval failed
      }

      const healthy = hasValidAuth || canGetToken;

      return {
        healthy,
        details: {
          authenticationMethod: this.usingServiceAccount ? 'service-account' : 'oauth',
          hasValidToken: hasValidAuth,
          canRetrieveToken: canGetToken,
          tokenExpiration: this.getTokenExpirationTime(),
          metrics: this.getMetrics()
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger?.error('GoogleAuthService: Health check failed', error);
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          metrics: this.getMetrics()
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): GoogleAuthServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Initialize service account authentication
   */
  private async initServiceAccountAuth(serviceAccountConfig: ServiceAccountConfig): Promise<boolean> {
    try {
      this.logger?.debug('GoogleAuthService: Attempting service account authentication');
      
      let keyFileContents: any = null;
      
      // If key file contents are provided directly
      if (serviceAccountConfig.keyFileContents) {
        try {
          keyFileContents = JSON.parse(serviceAccountConfig.keyFileContents);
        } catch (error) {
          this.logger?.error('GoogleAuthService: Failed to parse service account key file contents', error);
          this.metrics.errors++;
          return false;
        }
      }
      // If key file path is provided
      else if (serviceAccountConfig.keyFilePath) {
        try {
          // Resolve path - support both absolute paths and relative paths
          const filePath = serviceAccountConfig.keyFilePath.startsWith('/') 
            ? serviceAccountConfig.keyFilePath
            : path.resolve(process.cwd(), serviceAccountConfig.keyFilePath);
            
          // Check if file exists
          if (!fs.existsSync(filePath)) {
            this.logger?.warn('GoogleAuthService: Service account key file not found', { filePath });
            return false;
          }
          
          // Read and parse the file
          const fileData = fs.readFileSync(filePath, 'utf8');
          keyFileContents = JSON.parse(fileData);
        } catch (error) {
          this.logger?.error('GoogleAuthService: Failed to read service account key file', error);
          this.metrics.errors++;
          return false;
        }
      } 
      // If environment variable is set
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
          if (!fs.existsSync(filePath)) {
            this.logger?.warn('GoogleAuthService: Service account key file not found', { filePath });
            return false;
          }
          
          // Read and parse the file
          const fileData = fs.readFileSync(filePath, 'utf8');
          keyFileContents = JSON.parse(fileData);
        } catch (error) {
          this.logger?.error('GoogleAuthService: Failed to read service account key file', error);
          this.metrics.errors++;
          return false;
        }
      }
      else {
        this.logger?.debug('GoogleAuthService: No service account key file provided');
        return false;
      }
      
      // Check if we have valid key file contents
      if (!keyFileContents || !keyFileContents.client_email || !keyFileContents.private_key) {
        this.logger?.warn('GoogleAuthService: Invalid service account key file contents');
        return false;
      }
      
      // Create JWT auth client with the service account
      this.serviceAuthClient = new JWT(
        keyFileContents.client_email,
        undefined,
        keyFileContents.private_key,
        serviceAccountConfig.scopes,
      );
      
      // Test the auth client
      try {
        await this.serviceAuthClient.authorize();
        this.logger?.info('GoogleAuthService: Service account authentication initialized successfully');
        this.usingServiceAccount = true;
        return true;
      } catch (error) {
        this.logger?.error('GoogleAuthService: Service account authentication failed', error);
        this.serviceAuthClient = null;
        this.metrics.errors++;
        return false;
      }
    } catch (error) {
      this.logger?.error('GoogleAuthService: Failed to initialize service account authentication', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Check if service account is being used
   */
  public isUsingServiceAccount(): boolean {
    return this.usingServiceAccount;
  }

  /**
   * Set a new storage adapter
   * @param storage New storage adapter
   */
  public setStorageAdapter(storage: TokenStorageAdapter): void {
    this.storage = storage;
    this.logger?.debug('GoogleAuthService: Storage adapter updated');
  }

  /**
   * Generate OAuth URL for authentication
   */
  public generateAuthUrl(): string {
    // If service account is being used, OAuth flow isn't needed
    if (this.usingServiceAccount) {
      this.logger?.debug('GoogleAuthService: Using service account - OAuth flow not needed');
      return '';
    }
    
    // OAuth URL for web application flow
    const scopeStr = this.config.scopes?.join(' ') || '';
    const url = `https://accounts.google.com/o/oauth2/auth?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri || '')}&scope=${encodeURIComponent(scopeStr)}&response_type=code&access_type=offline&prompt=consent`;
    
    this.logger?.debug('GoogleAuthService: Generated OAuth URL');
    return url;
  }

  /**
   * Exchange authorization code for tokens
   * @param code Authorization code
   */
  public async getTokenFromCode(code: string): Promise<GoogleAuthToken | null> {
    // If service account is being used, OAuth flow isn't needed
    if (this.usingServiceAccount) {
      this.logger?.debug('GoogleAuthService: Using service account - OAuth token exchange not needed');
      return null;
    }
    
    try {
      this.logger?.debug('GoogleAuthService: Getting token from authorization code');
      
      // This is a stub - implementations will use proper OAuth libraries
      // Mock token for interface definition
      const token: GoogleAuthToken = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        scope: this.config.scopes?.join(' ') || '',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600 * 1000,
      };
      
      await this.saveToken(token);
      return token;
    } catch (error) {
      this.logger?.error('GoogleAuthService: Failed to get token from code', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Save token to storage
   * @param token Token to save
   */
  public async saveToken(token: GoogleAuthToken): Promise<boolean> {
    // If service account is being used, we don't need to save OAuth tokens
    if (this.usingServiceAccount) {
      return true;
    }
    
    try {
      this.token = token;
      this.tokenExpiresAt = new Date(token.expiry_date);
      this.metrics.storageOperations++;
      const result = await this.storage.saveToken(token);
      
      if (result) {
        this.logger?.debug('GoogleAuthService: Token saved successfully');
      } else {
        this.logger?.warn('GoogleAuthService: Failed to save token');
      }
      
      return result;
    } catch (error) {
      this.logger?.error('GoogleAuthService: Error saving token', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Load token from storage
   */
  public async loadToken(): Promise<GoogleAuthToken | null> {
    // If service account is being used, we don't need to load OAuth tokens
    if (this.usingServiceAccount) {
      return null;
    }
    
    try {
      this.metrics.storageOperations++;
      const token = await this.storage.loadToken();
      if (token) {
        this.token = token;
        this.tokenExpiresAt = new Date(token.expiry_date);
        this.logger?.debug('GoogleAuthService: Token loaded successfully');
      }
      return token;
    } catch (error) {
      this.logger?.error('GoogleAuthService: Error loading token', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Clear token from storage
   */
  public async clearToken(): Promise<boolean> {
    // If service account is being used, we don't need to clear OAuth tokens
    if (this.usingServiceAccount) {
      return true;
    }
    
    try {
      this.token = null;
      this.tokenExpiresAt = null;
      this.metrics.storageOperations++;
      const result = await this.storage.clearToken();
      
      if (result) {
        this.logger?.debug('GoogleAuthService: Token cleared successfully');
      }
      
      return result;
    } catch (error) {
      this.logger?.error('GoogleAuthService: Error clearing token', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Check if we have a valid token
   */
  public async hasValidToken(): Promise<boolean> {
    // If service account is being used, we don't need to check OAuth token validity
    if (this.usingServiceAccount) {
      return true;
    }
    
    if (!this.token) {
      const token = await this.loadToken();
      if (!token) return false;
    }

    if (this.tokenExpiresAt) {
      const now = new Date();
      const isExpired = now >= this.tokenExpiresAt;
      
      // If expired but we have a refresh token, try refreshing
      if (isExpired && this.token?.refresh_token) {
        const refreshed = await this.refreshToken();
        return refreshed;
      }
      
      return !isExpired;
    }
    
    return false;
  }

  /**
   * Refresh the token
   */
  public async refreshToken(): Promise<boolean> {
    try {
      this.metrics.tokenRefreshes++;
      
      // If service account is being used, we don't need to refresh OAuth tokens
      if (this.usingServiceAccount) {
        try {
          // Refresh service account credentials
          if (this.serviceAuthClient) {
            await this.serviceAuthClient.authorize();
            this.logger?.debug('GoogleAuthService: Service account credentials refreshed');
            return true;
          }
          return false;
        } catch (error) {
          this.logger?.error('GoogleAuthService: Failed to refresh service account credentials', error);
          this.metrics.errors++;
          return false;
        }
      }
      
      if (!this.token?.refresh_token) {
        this.logger?.warn('GoogleAuthService: No refresh token available');
        return false;
      }
      
      try {
        this.logger?.debug('GoogleAuthService: Refreshing OAuth token');
        
        // This is a stub - implementations will use proper OAuth libraries
        // Mock refreshed token
        const refreshedToken: GoogleAuthToken = {
          ...this.token,
          access_token: 'new_access_token_' + Date.now(),
          expiry_date: Date.now() + 3600 * 1000,
        };
        
        await this.saveToken(refreshedToken);
        return true;
      } catch (error) {
        this.logger?.error('GoogleAuthService: Failed to refresh token', error);
        this.metrics.errors++;
        return false;
      }
    } catch (error) {
      this.logger?.error('GoogleAuthService: Unexpected error refreshing token', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get the time until token expiration
   */
  public getTokenExpirationTime(): { isValid: boolean; expiresIn: number; formattedTime: string } {
    // If service account is being used, tokens don't expire in the same way
    if (this.usingServiceAccount) {
      return {
        isValid: true,
        expiresIn: 3600, // Service account tokens typically last 1 hour
        formattedTime: 'Service account (auto-refresh)'
      };
    }
    
    if (!this.token || !this.tokenExpiresAt) {
      return {
        isValid: false,
        expiresIn: 0,
        formattedTime: 'Token not available'
      };
    }
    
    const now = new Date();
    const expiresIn = Math.floor((this.tokenExpiresAt.getTime() - now.getTime()) / 1000);
    
    if (expiresIn <= 0) {
      return {
        isValid: false,
        expiresIn: 0,
        formattedTime: 'Token expired'
      };
    }
    
    // Format time remaining
    let formattedTime;
    if (expiresIn > 3600) {
      formattedTime = `${Math.floor(expiresIn / 3600)}h ${Math.floor((expiresIn % 3600) / 60)}m`;
    } else if (expiresIn > 60) {
      formattedTime = `${Math.floor(expiresIn / 60)}m ${expiresIn % 60}s`;
    } else {
      formattedTime = `${expiresIn}s`;
    }
    
    return {
      isValid: true,
      expiresIn,
      formattedTime
    };
  }

  /**
   * Get the current token
   */
  public getToken(): GoogleAuthToken | null {
    // If service account is being used, return a token format from the service account
    if (this.usingServiceAccount && this.serviceAuthClient) {
      try {
        const credentials = this.serviceAuthClient.credentials;
        if (credentials && credentials.access_token) {
          // Convert service account token to GoogleAuthToken format
          return {
            access_token: credentials.access_token,
            token_type: 'Bearer',
            expiry_date: credentials.expiry_date || (Date.now() + 3600 * 1000),
            scope: this.config.scopes?.join(' ') || ''
          };
        }
      } catch (error) {
        this.logger?.error('GoogleAuthService: Failed to get service account token', error);
        this.metrics.errors++;
      }
    }
    
    return this.token;
  }

  /**
   * Get the access token string for API requests
   */
  public async getAccessToken(): Promise<string | null> {
    try {
      this.metrics.accessTokenRequests++;
      
      // Try service account first
      if (this.usingServiceAccount && this.serviceAuthClient) {
        try {
          // This will refresh the token if needed
          const credentials = await this.serviceAuthClient.authorize();
          return credentials.access_token || null;
        } catch (error) {
          this.logger?.error('GoogleAuthService: Failed to get service account access token', error);
          this.metrics.errors++;
        }
      }
      
      // Try OAuth token
      try {
        const isValid = await this.hasValidToken();
        if (isValid && this.token?.access_token) {
          return this.token.access_token;
        }
      } catch (error) {
        this.logger?.error('GoogleAuthService: Failed to get OAuth token', error);
        this.metrics.errors++;
      }
      
      // Try environment variables as last resort
      const envToken = process.env.GOOGLE_ACCESS_TOKEN || process.env.VITE_GOOGLE_ACCESS_TOKEN;
      if (envToken) {
        this.logger?.debug('GoogleAuthService: Using token from environment variable');
        return envToken;
      }
      
      // No valid token found
      this.logger?.error('GoogleAuthService: No valid Google access token available');
      return null;
    } catch (error) {
      this.logger?.error('GoogleAuthService: Unexpected error getting access token', error);
      this.metrics.errors++;
      return null;
    }
  }
  
  /**
   * Check if the auth service is ready to use
   */
  public async isReady(): Promise<boolean> {
    return this.usingServiceAccount || (await this.hasValidToken());
  }
}

// Export default instance
export default GoogleAuthService;