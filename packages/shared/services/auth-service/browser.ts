/**
 * Browser-only exports for auth service
 * Use this file when importing in browser environments to avoid Node.js dependencies
 */

export { BrowserAuthService, getBrowserAuthService } from './browser-auth-service';
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
  AccessRequestData,
  AccessRequest,
  AllowedEmail
} from './types';