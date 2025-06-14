// Export the refactored AIProcessingService
export { AIProcessingService } from './AIProcessingService';
export type {
  ClassificationResult,
  ValidationResult,
  KeyInfoResult,
  ContentAnalysisResult,
  ProcessingMetrics,
  ProcessingOptions
} from './AIProcessingService';

// Note: No singleton export as this is a BusinessService requiring dependency injection