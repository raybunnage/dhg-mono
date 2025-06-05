/**
 * Authentication Service Index
 * 
 * Export all authentication service functionality
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

if (isBrowser) {
  // Browser environment - export browser auth service
  export { BrowserAuthService, getBrowserAuthService, browserAuthService } from './browser-auth-service';
  export { browserAuthService as authService } from './browser-auth-service';
} else {
  // Node.js environment - export full auth service
  export { AuthService, authService } from './auth-service';
  export { BrowserAuthService, getBrowserAuthService, browserAuthService } from './browser-auth-service';
}

export * from './types';

// Re-export commonly used types for convenience
export type {
  AppUser,
  AuthSession,
  AuthResult,
  AuthOptions,
  SignUpOptions,
  UserProfile,
  UserProfileUpdate,
  CLIAuthToken,
  AuthEvent,
  AuthEventType,
  AccessRequestData,
  AccessRequest,
  AllowedEmail
} from './types';