/**
 * GitOperationsService - Singleton service for git operations
 * 
 * Provides comprehensive git operations including worktrees, branches, commits, and merges
 * with caching, metrics, and health monitoring.
 */

export { GitOperationsService } from './GitOperationsService';
export * from './types';

// Re-export for backwards compatibility
export { GitOperationsService as default } from './GitOperationsService';