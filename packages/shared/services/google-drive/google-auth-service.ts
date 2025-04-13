/**
 * Centralized authentication service for Google Drive
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
 * - Exports a default singleton instance for easy integration
 * 
 * Usage:
 * ```typescript
 * // Get the default instance (recommended)
 * import { defaultGoogleAuth } from '../packages/shared/services/google-drive';
 * const accessToken = await defaultGoogleAuth.getAccessToken();
 * 
 * // Or create a custom instance
 * import { GoogleAuthService } from '../packages/shared/services/google-drive';
 * const auth = GoogleAuthService.getInstance({
 *   scopes: ['https://www.googleapis.com/auth/drive']
 * });
 * ```
 */

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
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenStoragePath?: string; // Used by CLI for local token storage
  serviceAccount?: ServiceAccountConfig; // Service account config (preferred when available)
}

// Storage adapter interface - allows different implementations for UI and CLI
export interface TokenStorageAdapter {
  saveToken(token: GoogleAuthToken): Promise<boolean>;
  loadToken(): Promise<GoogleAuthToken | null>;
  clearToken(): Promise<boolean>;
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
 */
export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private config: GoogleAuthConfig;
  private storage: TokenStorageAdapter;
  private token: GoogleAuthToken | null = null;
  private tokenExpiresAt: Date | null = null;
  private serviceAuthClient: JWT | null = null;
  private usingServiceAccount: boolean = false;
  private initializing: Promise<boolean> | null = null;

  private constructor(config: GoogleAuthConfig, storage: TokenStorageAdapter) {
    this.config = config;
    this.storage = storage;
    
    // Load environment variables if we're in Node
    if (typeof window === 'undefined') {
      // Try to load from .env.development first, then fall back to .env
      dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    }
    
    // Initialize authentication (async, but start immediately)
    this.initializing = this.initialize();
  }
  
  /**
   * Initialize authentication, attempting service account first, then OAuth
   */
  private async initialize(): Promise<boolean> {
    try {
      // First try service account initialization
      if (this.config.serviceAccount) {
        const serviceAccountSuccess = await this.initServiceAccountAuth(this.config.serviceAccount);
        if (serviceAccountSuccess) {
          return true;
        }
      }
      
      // If no service account config provided or it failed, check environment variables
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                               process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
                               path.resolve(process.cwd(), '.service-account.json');
      
      if (typeof window === 'undefined' && serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        const serviceAccountSuccess = await this.initServiceAccountAuth({
          keyFilePath: serviceAccountPath,
          scopes: this.config.scopes
        });
        if (serviceAccountSuccess) {
          return true;
        }
      }
      
      // If service account auth failed, try OAuth
      const token = await this.loadToken();
      return !!token;
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      return false;
    }
  }

  /**
   * Initialize service account authentication
   */
  private async initServiceAccountAuth(serviceAccountConfig: ServiceAccountConfig): Promise<boolean> {
    try {
      let keyFileContents: any = null;
      
      // If key file contents are provided directly
      if (serviceAccountConfig.keyFileContents) {
        try {
          keyFileContents = JSON.parse(serviceAccountConfig.keyFileContents);
        } catch (error) {
          console.error('Failed to parse service account key file contents:', error);
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
            console.log(`Service account key file not found at: ${filePath}`);
            return false;
          }
          
          // Read and parse the file
          const fileData = fs.readFileSync(filePath, 'utf8');
          keyFileContents = JSON.parse(fileData);
        } catch (error) {
          console.error(`Failed to read service account key file: ${error}`);
          return false;
        }
      } 
      // If environment variable is set
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
          if (!fs.existsSync(filePath)) {
            console.log(`Service account key file not found at: ${filePath}`);
            return false;
          }
          
          // Read and parse the file
          const fileData = fs.readFileSync(filePath, 'utf8');
          keyFileContents = JSON.parse(fileData);
        } catch (error) {
          console.error(`Failed to read service account key file: ${error}`);
          return false;
        }
      }
      else {
        console.log('No service account key file provided');
        return false;
      }
      
      // Check if we have valid key file contents
      if (!keyFileContents || !keyFileContents.client_email || !keyFileContents.private_key) {
        console.log('Invalid service account key file contents');
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
        console.log('✅ Service account authentication initialized successfully');
        this.usingServiceAccount = true;
        return true;
      } catch (error) {
        console.error('Service account authentication failed:', error);
        this.serviceAuthClient = null;
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize service account authentication:', error);
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
   * Get singleton instance
   * @param config Configuration options
   * @param storage Storage adapter (default: localStorage)
   */
  public static getInstance(
    config?: Partial<GoogleAuthConfig>,
    storage?: TokenStorageAdapter
  ): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      // Default config with minimum required values
      const defaultConfig: GoogleAuthConfig = {
        clientId: config?.clientId || process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: config?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: config?.redirectUri || process.env.GOOGLE_REDIRECT_URI || '',
        scopes: config?.scopes || ['https://www.googleapis.com/auth/drive.readonly'],
        tokenStoragePath: config?.tokenStoragePath || path.resolve(process.cwd(), '.google-tokens.json'),
        serviceAccount: config?.serviceAccount
      };
      
      // Default to local storage if not specified
      const storageAdapter = storage || 
        (typeof window !== 'undefined' && window.localStorage 
          ? new LocalStorageAdapter()
          : defaultConfig.tokenStoragePath 
            ? new FileSystemAdapter(defaultConfig.tokenStoragePath)
            : new LocalStorageAdapter());
      
      GoogleAuthService.instance = new GoogleAuthService(defaultConfig, storageAdapter);
    }
    
    return GoogleAuthService.instance;
  }
  
  /**
   * Get singleton instance with automatic configuration
   * This is a simplified method that will attempt to load configuration from environment variables
   */
  public static getDefaultInstance(): GoogleAuthService {
    return GoogleAuthService.getInstance();
  }

  /**
   * Set a new storage adapter
   * @param storage New storage adapter
   */
  public setStorageAdapter(storage: TokenStorageAdapter): void {
    this.storage = storage;
  }

  /**
   * Generate OAuth URL for authentication
   */
  public generateAuthUrl(): string {
    // If service account is being used, OAuth flow isn't needed
    if (this.usingServiceAccount) {
      console.log('Using service account authentication - OAuth flow not needed');
      return '';
    }
    
    // OAuth URL for web application flow
    const scopeStr = this.config.scopes.join(' ');
    return `https://accounts.google.com/o/oauth2/auth?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&scope=${encodeURIComponent(scopeStr)}&response_type=code&access_type=offline&prompt=consent`;
  }

  /**
   * Exchange authorization code for tokens
   * @param code Authorization code
   */
  public async getTokenFromCode(code: string): Promise<GoogleAuthToken | null> {
    // If service account is being used, OAuth flow isn't needed
    if (this.usingServiceAccount) {
      console.log('Using service account authentication - OAuth token exchange not needed');
      return null;
    }
    
    try {
      // This is a stub - implementations will use proper OAuth libraries
      console.log('Getting token from code:', code);
      // Mock token for interface definition
      const token: GoogleAuthToken = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        scope: this.config.scopes.join(' '),
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600 * 1000,
      };
      
      await this.saveToken(token);
      return token;
    } catch (error) {
      console.error('Failed to get token from code:', error);
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
    
    this.token = token;
    this.tokenExpiresAt = new Date(token.expiry_date);
    return this.storage.saveToken(token);
  }

  /**
   * Load token from storage
   */
  public async loadToken(): Promise<GoogleAuthToken | null> {
    // If service account is being used, we don't need to load OAuth tokens
    if (this.usingServiceAccount) {
      return null;
    }
    
    const token = await this.storage.loadToken();
    if (token) {
      this.token = token;
      this.tokenExpiresAt = new Date(token.expiry_date);
    }
    return token;
  }

  /**
   * Clear token from storage
   */
  public async clearToken(): Promise<boolean> {
    // If service account is being used, we don't need to clear OAuth tokens
    if (this.usingServiceAccount) {
      return true;
    }
    
    this.token = null;
    this.tokenExpiresAt = null;
    return this.storage.clearToken();
  }

  /**
   * Check if token is valid (not expired)
   */
  public async isTokenValid(): Promise<boolean> {
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
    // If service account is being used, we don't need to refresh OAuth tokens
    if (this.usingServiceAccount) {
      try {
        // Refresh service account credentials
        if (this.serviceAuthClient) {
          await this.serviceAuthClient.authorize();
          return true;
        }
        return false;
      } catch (error) {
        console.error('Failed to refresh service account credentials:', error);
        return false;
      }
    }
    
    if (!this.token?.refresh_token) {
      console.log('No refresh token available');
      return false;
    }
    
    try {
      // This is a stub - implementations will use proper OAuth libraries
      console.log('Refreshing token with refresh token:', this.token.refresh_token);
      
      // Mock refreshed token
      const refreshedToken: GoogleAuthToken = {
        ...this.token,
        access_token: 'new_access_token_' + Date.now(),
        expiry_date: Date.now() + 3600 * 1000,
      };
      
      await this.saveToken(refreshedToken);
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
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
            scope: this.config.scopes.join(' ')
          };
        }
      } catch (error) {
        console.error('Failed to get service account token:', error);
      }
    }
    
    return this.token;
  }

  /**
   * Get the access token string for API requests
   */
  public async getAccessToken(): Promise<string | null> {
    // Wait for initialization to complete if it's still in progress
    if (this.initializing) {
      await this.initializing;
    }
    
    // Try service account first
    if (this.usingServiceAccount && this.serviceAuthClient) {
      try {
        // This will refresh the token if needed
        const credentials = await this.serviceAuthClient.authorize();
        return credentials.access_token || null;
      } catch (error) {
        console.error('Failed to get service account access token:', error);
      }
    }
    
    // Try OAuth token
    try {
      const isValid = await this.isTokenValid();
      if (isValid && this.token?.access_token) {
        return this.token.access_token;
      }
    } catch (error) {
      console.error('Failed to get OAuth token:', error);
    }
    
    // Try environment variables as last resort
    const envToken = process.env.GOOGLE_ACCESS_TOKEN || process.env.VITE_GOOGLE_ACCESS_TOKEN;
    if (envToken) {
      return envToken;
    }
    
    // No valid token found
    console.error('No valid Google access token available. Authentication failed.');
    return null;
  }
  
  /**
   * Get a configured Google Drive client
   * 
   * @param version Drive API version to use (default: v3)
   * @returns Google Drive client or null if initialization fails
   */
  public async getDriveClient(version: string = 'v3'): Promise<any | null> {
    try {
      // Import the googleapis library dynamically to avoid issues in browser environments
      const { google } = require('googleapis');
      
      // If using a service account, use JWT auth
      if (this.usingServiceAccount && this.serviceAuthClient) {
        return google.drive({ version, auth: this.serviceAuthClient });
      }
      
      // Otherwise, use OAuth token
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        console.error('Failed to get access token for Drive client');
        return null;
      }
      
      // Create auth object with the access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      // Return configured drive client
      return google.drive({ version, auth });
    } catch (error) {
      console.error('Error creating Google Drive client:', error);
      return null;
    }
  }
  
  /**
   * Check if the auth service is ready to use
   */
  public async isReady(): Promise<boolean> {
    if (this.initializing) {
      return await this.initializing;
    }
    return this.usingServiceAccount || (await this.isTokenValid());
  }
}

export default GoogleAuthService;