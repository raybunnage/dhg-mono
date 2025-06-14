/**
 * DEPRECATED: This service has been refactored.
 * 
 * Please use the new refactored version:
 * import { PromptService } from '@shared/services/prompt-service-refactored';
 * 
 * Migration guide: packages/shared/services/prompt-service-refactored/MIGRATION.md
 * 
 * Original files archived in: .archived_20250614/
 */

// Temporary re-export during migration period
export { promptService } from './.archived_20250614/prompt-service';

console.warn(
  'DEPRECATED: @shared/services/prompt-service is deprecated. ' +
  'Use @shared/services/prompt-service-refactored instead.'
);