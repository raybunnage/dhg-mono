/**
 * AuthService Refactored - Entry Point
 * 
 * Exports the refactored AuthService that extends SingletonService
 * for proper resource management and lifecycle control.
 */

export { AuthService } from './AuthService';
export * from './types';

// Re-export types for convenience
export type {
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