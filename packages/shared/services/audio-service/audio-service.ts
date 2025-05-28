import { SupabaseClientService } from '../supabase-client';

/**
 * Service for handling audio file operations
 */
export class AudioService {
  private static instance: AudioService;
  private supabase: any;

  private constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  /**
   * Get the singleton instance of AudioService
   */
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Get all M4A files from google_sources table
   * @param limit Optional limit of records to return
   * @returns Array of M4A audio files
   */
  async getAudioFiles(limit?: number): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('google_sources')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          google_sources_experts(
            expert_id,
            experts:expert_id(
              expert_name,
              full_name
            )
          )
        `)
        .or('mime_type.eq.audio/x-m4a,mime_type.eq.audio/mp4a,mime_type.like.%m4a%,mime_type.eq.audio/mpeg,mime_type.like.%mp3%')
        .is('is_deleted', false)
        .order('name', { ascending: true })
        .limit(limit || 100);

      if (error) {
        console.error('Error fetching audio files:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Exception in getAudioFiles:', error);
      throw error;
    }
  }

  /**
   * Get audio file by ID
   * @param id ID of the audio file
   * @returns Audio file data
   */
  async getAudioFile(id: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('google_sources')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          google_sources_experts(
            expert_id,
            experts:expert_id(
              expert_name,
              full_name
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error(`Error fetching audio file with id ${id}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Exception in getAudioFile:', error);
      throw error;
    }
  }

  /**
   * Get associated transcript for an audio file
   * @param sourceId ID of the audio file source
   * @returns Transcript text if available
   */
  async getTranscript(sourceId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('expert_documents')
        .select('id, raw_content, processed_content')
        .eq('source_id', sourceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null;
        }
        console.error(`Error fetching transcript for source ${sourceId}:`, error);
        throw error;
      }

      if (data?.raw_content) {
        return data.raw_content;
      } else if (data?.processed_content) {
        if (typeof data.processed_content === 'string') {
          return data.processed_content;
        } else {
          // If processed_content is an object, return a specific field or stringify it
          return JSON.stringify(data.processed_content);
        }
      }

      return null;
    } catch (error) {
      console.error('Exception in getTranscript:', error);
      throw error;
    }
  }
}

export const audioService = AudioService.getInstance();