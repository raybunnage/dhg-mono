/**
 * Authentication Service Index
 * 
 * Export all authentication service functionality
 */

export { AuthService, authService } from './auth-service';
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
  AuthEventType
} from './types';