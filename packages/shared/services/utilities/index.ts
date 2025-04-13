/**
 * Shared Utility Services
 * 
 * This module provides utility services that can be used by any part of the application.
 * These services are designed to be reusable and general-purpose.
 */

import batchProcessingService, { 
  BatchProcessingService,
  ProgressCallback,
  ProgressInfo,
  BatchOptions,
  BatchResult
} from './batch-processing-service';

// Export services
export {
  // Services
  BatchProcessingService,
  batchProcessingService,
  
  // Types
  ProgressCallback,
  ProgressInfo,
  BatchOptions,
  BatchResult
};

// Helper function to get the BatchProcessingService instance
export function getBatchProcessingService(): typeof batchProcessingService {
  return batchProcessingService;
}

// Default export
export default {
  batchProcessingService
};