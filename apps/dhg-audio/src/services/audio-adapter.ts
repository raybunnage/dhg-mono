import { audioBrowserService } from './audio-browser-service';

export interface AudioFile {
  id: string;
  name: string;
  url: string;
  directUrl?: string; // Direct Google Drive URL as fallback
  driveId: string;
  expert: {
    id: string;
    name: string;
    fullName?: string;
  } | null;
  hasTranscript: boolean;
}

export interface AudioFilesResult {
  files: AudioFile[];
  rawData: any[]; // Raw data from database for debugging
}

/**
 * Adapter that leverages the shared AudioService
 */
export class AudioAdapter {
  /**
   * Get all available audio files
   * @param rootDriveId - Optional root drive ID to filter by
   */
  static async getAudioFiles(rootDriveId?: string | null): Promise<AudioFile[]> {
    try {
      const files = await audioBrowserService.getAudioFiles(100, rootDriveId);
      return files.map(file => this.formatAudioFile(file));
    } catch (error) {
      console.error('Error in AudioAdapter.getAudioFiles:', error);
      throw error;
    }
  }


  /**
   * Get a single audio file by ID
   */
  static async getAudioFile(id: string): Promise<AudioFile | null> {
    try {
      const file = await audioBrowserService.getAudioFile(id);
      if (!file) return null;
      
      return this.formatAudioFile(file);
    } catch (error) {
      console.error(`Error in AudioAdapter.getAudioFile(${id}):`, error);
      throw error;
    }
  }

  /**
   * Get transcript for an audio file
   */
  static async getTranscript(id: string): Promise<string | null> {
    try {
      return await audioBrowserService.getTranscript(id);
    } catch (error) {
      console.error(`Error in AudioAdapter.getTranscript(${id}):`, error);
      throw error;
    }
  }

  /**
   * Format an audio file from the database into the app's format
   */
  private static formatAudioFile(file: any): AudioFile {
    // Extract expert info if available
    let expert = null;
    if (file.google_sources_experts && file.google_sources_experts.length > 0) {
      const expertEntry = file.google_sources_experts[0];
      if (expertEntry.expert_profiles) {
        expert = {
          id: expertEntry.expert_id,
          name: expertEntry.expert_profiles.expert_name,
          fullName: expertEntry.expert_profiles.full_name
        };
      }
    }

    // Extract Drive ID from the file
    const driveId = file.drive_id || (file.web_view_link ? this.extractDriveId(file.web_view_link) : null);
    
    // Determine if transcript might be available based on file data
    const hasTranscript = true;
    
    // Create URLs for both direct Google Drive and our proxy server
    const googleDriveUrl = driveId ? `https://docs.google.com/uc?export=open&id=${driveId}` : '';
    
    // Use our proxy server URL which avoids tracking prevention issues
    // This will run through our server endpoint which fetches from Google Drive
    const proxyUrl = driveId ? `/api/audio/${driveId}` : '';
    
    // Extract title: prefer video title, then expert documents, then filename
    let displayName = file.name;
    if (file.video_title) {
      // Use the title from the associated video file
      displayName = file.video_title;
    } else if (file.google_expert_documents && file.google_expert_documents.length > 0 && file.google_expert_documents[0].title) {
      // Fallback to audio file's own expert documents (rare)
      displayName = file.google_expert_documents[0].title;
    }
    
    return {
      id: file.id,
      name: displayName,
      url: proxyUrl || googleDriveUrl, // Prefer our proxy, fallback to direct
      directUrl: googleDriveUrl, // Keep the direct URL as a fallback
      driveId: driveId || '',
      expert,
      hasTranscript
    };
  }

  /**
   * Extract Drive ID from a Google Drive URL
   */
  private static extractDriveId(url: string): string | null {
    if (!url) return null;
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  }
}