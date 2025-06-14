/**
 * User Profile Service (Refactored) - Index
 * 
 * Exports the refactored UserProfileService with dependency injection pattern
 */

export { UserProfileService } from './UserProfileService';
export * from './types';

// Note: Unlike the original singleton pattern, consumers must create instances:
// const service = new UserProfileService(supabaseClient, logger);