/**
 * Enhanced Light Auth Service Exports
 * 
 * Provides a complete authentication solution with profile management
 */

export {
  LightAuthEnhancedService,
  type LightAuthEnhancedResult,
  type UserRegistrationData,
  type LightAuthUser
} from './light-auth-enhanced-service';

// Re-export ProfileFormData for convenience
export type { ProfileFormData } from '../user-profile-service';