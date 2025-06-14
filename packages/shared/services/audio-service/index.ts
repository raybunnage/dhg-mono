// Re-export refactored service and types
export { 
  AudioService,
  type AudioFile,
  type AudioFileOptions,
  type TranscriptData,
  type AudioServiceMetrics
} from '../audio-service-refactored';

// Import dependencies for singleton compatibility
import { AudioService } from '../audio-service-refactored';
import { SupabaseClientService } from '../supabase-client';

// Create backward-compatible singleton wrapper
class AudioServiceWrapper {
  private static instance: AudioService;
  
  public static getInstance(): AudioService {
    if (!AudioServiceWrapper.instance) {
      const supabase = SupabaseClientService.getInstance().getClient();
      AudioServiceWrapper.instance = new AudioService(supabase);
      // Auto-initialize for backward compatibility
      AudioServiceWrapper.instance.ensureInitialized().catch(console.error);
    }
    return AudioServiceWrapper.instance;
  }
}

// Export singleton instance for backward compatibility
export const audioService = AudioServiceWrapper.getInstance();