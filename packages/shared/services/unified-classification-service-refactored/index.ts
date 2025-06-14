/**
 * Unified Classification Service (Refactored) - Index
 * 
 * Exports the refactored UnifiedClassificationService with dependency injection pattern
 */

export { UnifiedClassificationService } from './UnifiedClassificationService';
export * from './types';

// Note: Unlike the original singleton pattern, consumers must create instances:
// const service = new UnifiedClassificationService(supabaseClient, config, logger);