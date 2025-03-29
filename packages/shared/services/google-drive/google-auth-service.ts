/**
 * Shared service for Google Drive authentication
 * Used by both UI components and CLI tools
 */

import { Credentials } from 'google-auth-library';

// Interface for token storage
export interface GoogleAuthToken {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

// Configuration options
export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenStoragePath?: string; // Used by CLI for local token storage
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
      localStorage.setItem(this.storageKey, JSON.stringify(token));
      return true;
    } catch (error) {
      console.error('Failed to save token to localStorage:', error);
      return false;
    }
  }

  async loadToken(): Promise<GoogleAuthToken | null> {
    try {
      const tokenStr = localStorage.getItem(this.storageKey);
      if (!tokenStr) return null;
      return JSON.parse(tokenStr) as GoogleAuthToken;
    } catch (error) {
      console.error('Failed to load token from localStorage:', error);
      return null;
    }
  }

  async clearToken(): Promise<boolean> {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Failed to clear token from localStorage:', error);
      return false;
    }
  }
}

/**
 * File system token adapter (for CLI)
 * Implemented as stub - CLI will provide actual implementation
 */
class FileSystemAdapter implements TokenStorageAdapter {
  private readonly tokenPath: string;

  constructor(tokenPath: string) {
    this.tokenPath = tokenPath;
  }

  async saveToken(token: GoogleAuthToken): Promise<boolean> {
    // CLI will implement this using fs.writeFile
    console.log(`[STUB] Saving token to ${this.tokenPath}`);
    return false;
  }

  async loadToken(): Promise<GoogleAuthToken | null> {
    // CLI will implement this using fs.readFile
    console.log(`[STUB] Loading token from ${this.tokenPath}`);
    return null;
  }

  async clearToken(): Promise<boolean> {
    // CLI will implement this using fs.unlink
    console.log(`[STUB] Clearing token from ${this.tokenPath}`);
    return false;
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

  private constructor(config: GoogleAuthConfig, storage: TokenStorageAdapter) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Get singleton instance
   * @param config Configuration options
   * @param storage Storage adapter (default: localStorage)
   */
  public static getInstance(
    config: GoogleAuthConfig,
    storage?: TokenStorageAdapter
  ): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      // Default to local storage if not specified
      const storageAdapter = storage || 
        (typeof window !== 'undefined' && window.localStorage 
          ? new LocalStorageAdapter()
          : config.tokenStoragePath 
            ? new FileSystemAdapter(config.tokenStoragePath)
            : new LocalStorageAdapter());
      
      GoogleAuthService.instance = new GoogleAuthService(config, storageAdapter);
    }
    return GoogleAuthService.instance;
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
    // This is a stub - implementations will use proper OAuth libraries
    // UI will use the Google OAuth library
    // CLI will use google-auth-library
    const scopeStr = this.config.scopes.join(' ');
    return `https://accounts.google.com/o/oauth2/auth?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&scope=${encodeURIComponent(scopeStr)}&response_type=code&access_type=offline&prompt=consent`;
  }

  /**
   * Exchange authorization code for tokens
   * @param code Authorization code
   */
  public async getTokenFromCode(code: string): Promise<GoogleAuthToken | null> {
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
    this.token = token;
    this.tokenExpiresAt = new Date(token.expiry_date);
    return this.storage.saveToken(token);
  }

  /**
   * Load token from storage
   */
  public async loadToken(): Promise<GoogleAuthToken | null> {
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
    this.token = null;
    this.tokenExpiresAt = null;
    return this.storage.clearToken();
  }

  /**
   * Check if token is valid (not expired)
   */
  public async isTokenValid(): Promise<boolean> {
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
    return this.token;
  }

  /**
   * Get the access token string for API requests
   */
  public async getAccessToken(): Promise<string | null> {
    const isValid = await this.isTokenValid();
    if (!isValid) return null;
    return this.token?.access_token || null;
  }
}

export default GoogleAuthService;