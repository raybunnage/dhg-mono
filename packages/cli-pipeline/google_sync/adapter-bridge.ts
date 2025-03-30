/**
 * Adapter Bridge for CLI Pipeline
 * 
 * This bridge connects the CLI pipeline to the new TypeScript services.
 * It exports functions to convert between the legacy JavaScript CLI service
 * and the new TypeScript services in shared packages.
 */

import GoogleAuthCliAdapter from './auth-adapter';
import GoogleDriveCliService from './drive-service';

/**
 * Create a new GoogleAuthCliAdapter
 */
export function createAuthAdapter(config: any): GoogleAuthCliAdapter {
  return new GoogleAuthCliAdapter(config);
}

/**
 * Create a new GoogleDriveCliService
 */
export function createDriveService(config: any): GoogleDriveCliService {
  return new GoogleDriveCliService(config);
}

/**
 * Convert a JavaScript config object to a TypeScript config object
 */
export function convertConfig(jsConfig: any): any {
  // In a real implementation, this would handle any conversion needed
  // For now, just return the config directly
  return jsConfig;
}

/**
 * Generate instructions for migrating from JavaScript to TypeScript
 */
export function getMigrationInstructions(): string {
  return `
Migration Instructions for Google Sync CLI:

1. Create a transition plan:
   - Replace JS files one at a time with TypeScript equivalents
   - Use adapter pattern to maintain compatibility
   - Update documentation and examples accordingly

2. Dependency structure:
   - Keep original CLI entry points for backwards compatibility
   - Ensure all business logic is in shared packages
   - CLI should be just a thin wrapper around shared services

3. Authentication:
   - Use the centralized GoogleAuthService for all authentication
   - No direct handling of tokens in CLI code
   - Delegate all auth to the shared service

4. Data handling:
   - Use TypeScript types from supabase/types.ts
   - Use shared services for database operations
   - Avoid direct data manipulation in CLI

5. Testing:
   - Test against the same interfaces used by the main app
   - Ensure all edge cases are covered
   - Use mocks for external services during testing
`;
}

export default {
  createAuthAdapter,
  createDriveService,
  convertConfig,
  getMigrationInstructions
};