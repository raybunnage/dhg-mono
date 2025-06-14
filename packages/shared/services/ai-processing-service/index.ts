// Re-export refactored service and types
export { 
  AIProcessingService,
  type ClassificationResult,
  type ValidationResult,
  type KeyInfoResult,
  type ContentAnalysisResult,
  type ProcessingMetrics,
  type ProcessingOptions
} from '../ai-processing-service-refactored';

// Import dependencies for singleton compatibility
import { AIProcessingService } from '../ai-processing-service-refactored';
import { ClaudeService } from '../claude-service-refactored';

// Create backward-compatible singleton instance
// Note: This maintains the same API but uses the new implementation
class AIProcessingServiceWrapper {
  private static instance: AIProcessingService;
  
  public static getInstance(): AIProcessingService {
    if (!AIProcessingServiceWrapper.instance) {
      const claudeService = ClaudeService.getInstance();
      AIProcessingServiceWrapper.instance = new AIProcessingService(claudeService);
      // Auto-initialize for backward compatibility
      AIProcessingServiceWrapper.instance.initialize().catch(console.error);
    }
    return AIProcessingServiceWrapper.instance;
  }
}

// Export singleton for backward compatibility
export const aiProcessing = AIProcessingServiceWrapper.getInstance();