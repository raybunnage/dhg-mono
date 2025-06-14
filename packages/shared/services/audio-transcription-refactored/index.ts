// Export the refactored AudioTranscriptionService
export { AudioTranscriptionService } from './AudioTranscriptionService';
export type {
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionJob,
  TranscriptionServiceConfig,
  ServiceMetrics
} from './AudioTranscriptionService';

// Export convenience function for backward compatibility
export const getAudioTranscriptionService = () => 
  AudioTranscriptionService.getInstance();