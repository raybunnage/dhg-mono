// Re-export from refactored service for backwards compatibility
export { 
  AudioTranscriptionService,
  type TranscriptionOptions,
  type TranscriptionResult,
  type TranscriptionJob,
  type TranscriptionServiceConfig,
  type ServiceMetrics,
  getAudioTranscriptionService
} from '../audio-transcription-refactored';