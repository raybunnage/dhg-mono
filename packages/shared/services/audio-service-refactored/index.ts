// Export the refactored AudioService
export { AudioService } from './AudioService';
export type {
  AudioFile,
  AudioFileOptions,
  TranscriptData,
  AudioServiceMetrics
} from './AudioService';

// Note: No singleton export as this is a BusinessService requiring dependency injection