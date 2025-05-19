import { supabaseBrowser } from './supabase-browser-adapter';

/**
 * Browser-compatible audio service
 * This is a simplified version of the shared audio service
 * that works in the browser environment
 */
class AudioBrowserService {
  private static instance: AudioBrowserService;
  private supabase: any;

  private constructor() {
    try {
      this.supabase = supabaseBrowser.getClient();
      console.log('Supabase client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AudioBrowserService {
    if (!AudioBrowserService.instance) {
      AudioBrowserService.instance = new AudioBrowserService();
    }
    return AudioBrowserService.instance;
  }

  /**
   * Get all audio files (MP3 and M4A)
   */
  async getAudioFiles(limit?: number): Promise<any[]> {
    try {
      // Log the query parameters for debugging
      console.log('Fetching audio files with params:', { 
        limit: limit || 100,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL
      });
      
      const query = this.supabase
        .from('sources_google')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          sources_google_experts(
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
      
      console.log('Executing Supabase query');
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audio files:', error);
        throw error;
      }

      console.log(`Successfully fetched ${data?.length || 0} audio files`);
      return data || [];
    } catch (error) {
      console.error('Exception in getAudioFiles:', error);
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Get audio file by ID
   */
  async getAudioFile(id: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('sources_google')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          sources_google_experts(
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
   * Get transcript for an audio file
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
          // If processed_content is an object, stringify it
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

// Export singleton instance
export const audioBrowserService = AudioBrowserService.getInstance();