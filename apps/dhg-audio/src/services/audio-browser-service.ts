import { supabase } from '../lib/supabase';

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
      this.supabase = supabase;
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
   * @param limit - Maximum number of files to return
   * @param rootDriveId - Optional root drive ID to filter by
   */
  async getAudioFiles(limit?: number, rootDriveId?: string | null): Promise<any[]> {
    try {
      
      let query = this.supabase
        .from('google_sources')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          parent_folder_id,
          root_drive_id,
          path_array,
          google_sources_experts(
            expert_id,
            expert_profiles:expert_id(
              expert_name,
              full_name
            )
          ),
          google_expert_documents!expert_documents_source_id_fkey(
            title
          )
        `)
        .or('mime_type.eq.audio/x-m4a,mime_type.eq.audio/mp4a,mime_type.like.%m4a%,mime_type.eq.audio/mpeg,mime_type.like.%mp3%')
        .is('is_deleted', false)
        .order('name', { ascending: true })
        .limit(limit || 100);

      // Apply root drive ID filter if provided
      if (rootDriveId) {
        query = query.eq('root_drive_id', rootDriveId);
      }
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audio files:', error);
        throw error;
      }

      
      // For m4a files without titles, try to find corresponding mp4 files
      const enrichedData = await Promise.all((data || []).map(async (audioFile: any) => {
        // For all audio files, try to find corresponding mp4
        if (audioFile.mime_type?.includes('m4a') || audioFile.mime_type?.includes('mp3')) {
          
          // Extract base name without extension
          const baseName = audioFile.name.replace(/\.(m4a|mp3)$/i, '');
          
          // Look for mp4 file in same folder with same base name
          const { data: mp4Files } = await this.supabase
            .from('google_sources')
            .select(`
              id,
              name,
              drive_id,
              google_expert_documents!expert_documents_source_id_fkey(
                title,
                source_id
              )
            `)
            .eq('parent_folder_id', audioFile.parent_folder_id)
            .ilike('name', `${baseName}.mp4`)
            .is('is_deleted', false)
            .limit(1);
            
          if (mp4Files && mp4Files.length > 0) {
            // Add the main video ID (the mp4 file's ID)
            audioFile.main_video_id = mp4Files[0].id;
            audioFile.main_video_name = mp4Files[0].name;
            audioFile.main_video_drive_id = mp4Files[0].drive_id;
            
            // Add the title from the video's expert documents
            if (mp4Files[0].google_expert_documents?.[0]?.title) {
              audioFile.video_title = mp4Files[0].google_expert_documents[0].title;
            }
          }
        }
        
        return audioFile;
      }));
      
      return enrichedData;
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
        .from('google_sources')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          parent_folder_id,
          root_drive_id,
          path_array,
          google_sources_experts(
            expert_id,
            expert_profiles:expert_id(
              expert_name,
              full_name
            )
          ),
          google_expert_documents!expert_documents_source_id_fkey(
            title
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error(`Error fetching audio file with id ${id}:`, error);
        throw error;
      }

      // For m4a files without titles, try to find corresponding mp4 file
      if (data && data.mime_type?.includes('m4a') && 
          (!data.expert_documents || data.expert_documents.length === 0 || !data.expert_documents[0]?.title)) {
        
        // Extract base name without extension
        const baseName = data.name.replace(/\.m4a$/i, '');
        
        // Look for mp4 file in same folder
        const { data: mp4Files } = await this.supabase
          .from('google_sources')
          .select(`
            id,
            name,
            google_expert_documents!expert_documents_source_id_fkey(
              title
            )
          `)
          .eq('parent_folder_id', data.parent_folder_id)
          .ilike('name', `${baseName}.mp4`)
          .is('is_deleted', false)
          .limit(1);
          
        if (mp4Files && mp4Files.length > 0 && mp4Files[0].expert_documents?.[0]?.title) {
          // Add the mp4's title to the m4a file data
          data.mp4_title = mp4Files[0].expert_documents[0].title;
        }
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
        .from('google_expert_documents')
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

// Export a factory function instead of immediate instance creation
export const audioBrowserService = {
  getInstance: () => AudioBrowserService.getInstance(),
  getAudioFiles: async (limit?: number, rootDriveId?: string | null) => AudioBrowserService.getInstance().getAudioFiles(limit, rootDriveId),
  getAudioFile: async (id: string) => AudioBrowserService.getInstance().getAudioFile(id),
  getTranscript: async (sourceId: string) => AudioBrowserService.getInstance().getTranscript(sourceId)
};