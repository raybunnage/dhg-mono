/**
 * Google Auth Service Types
 */

// Token interface
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
  tokenStoragePath?: string;
  serviceAccount?: ServiceAccountConfig;
  logger?: any; // Logger instance
}

// Storage adapter interface
export interface TokenStorageAdapter {
  saveToken(token: GoogleAuthToken): Promise<boolean>;
  loadToken(): Promise<GoogleAuthToken | null>;
  clearToken(): Promise<boolean>;
}

// Token expiration info
export interface TokenExpirationInfo {
  isValid: boolean;
  expiresIn: number; // seconds
  formattedTime: string;
}

// Auth method type
export type AuthMethod = 'service-account' | 'oauth' | 'environment' | 'none';

// Auth status
export interface AuthStatus {
  authenticated: boolean;
  method: AuthMethod;
  tokenExpiration?: TokenExpirationInfo;
  serviceAccountEmail?: string;
}

// Google scopes
export const GOOGLE_SCOPES = {
  DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  DRIVE_FULL: 'https://www.googleapis.com/auth/drive',
  DRIVE_METADATA: 'https://www.googleapis.com/auth/drive.metadata.readonly',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_MODIFY: 'https://www.googleapis.com/auth/gmail.modify',
  CALENDAR_READONLY: 'https://www.googleapis.com/auth/calendar.readonly',
  CALENDAR_FULL: 'https://www.googleapis.com/auth/calendar',
} as const;

// Common scope combinations
export const SCOPE_PRESETS = {
  DRIVE_READ: [GOOGLE_SCOPES.DRIVE_READONLY],
  DRIVE_WRITE: [GOOGLE_SCOPES.DRIVE_FILE],
  DRIVE_FULL: [GOOGLE_SCOPES.DRIVE_FULL],
  GMAIL_READ: [GOOGLE_SCOPES.GMAIL_READONLY],
  GMAIL_FULL: [GOOGLE_SCOPES.GMAIL_MODIFY, GOOGLE_SCOPES.GMAIL_SEND],
  ALL_READONLY: [
    GOOGLE_SCOPES.DRIVE_READONLY,
    GOOGLE_SCOPES.GMAIL_READONLY,
    GOOGLE_SCOPES.CALENDAR_READONLY
  ],
} as const;

// Environment variable names
export const ENV_VARS = {
  CLIENT_ID: 'GOOGLE_CLIENT_ID',
  CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
  REDIRECT_URI: 'GOOGLE_REDIRECT_URI',
  ACCESS_TOKEN: 'GOOGLE_ACCESS_TOKEN',
  REFRESH_TOKEN: 'GOOGLE_REFRESH_TOKEN',
  SERVICE_ACCOUNT_PATH: 'GOOGLE_APPLICATION_CREDENTIALS',
  SERVICE_ACCOUNT_PATH_ALT: 'GOOGLE_SERVICE_ACCOUNT_PATH',
  VITE_ACCESS_TOKEN: 'VITE_GOOGLE_ACCESS_TOKEN',
} as const;

// Default paths
export const DEFAULT_PATHS = {
  TOKEN_FILE: '.google-tokens.json',
  SERVICE_ACCOUNT_FILE: '.service-account.json',
} as const;