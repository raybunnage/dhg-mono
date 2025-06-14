/**
 * Claude Service Exports
 * 
 * Standardized export point for the Claude AI service
 * This resolves the inconsistent import paths issue
 */

// Export the singleton instance and class
export { claudeService, ClaudeService } from './claude-service';

// Re-export types if needed in the future
// export type { ClaudeOptions, ClaudeResponse } from './claude-service';