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

/**
 * Adapter that leverages the shared AudioService
 */
export class AudioAdapter {
  /**
   * Get all available audio files
   */
  static async getAudioFiles(): Promise<AudioFile[]> {
    try {
      const files = await audioBrowserService.getAudioFiles();
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
    if (file.sources_google_experts && file.sources_google_experts.length > 0) {
      const expertEntry = file.sources_google_experts[0];
      if (expertEntry.experts) {
        expert = {
          id: expertEntry.expert_id,
          name: expertEntry.experts.expert_name,
          fullName: expertEntry.experts.full_name
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
    
    return {
      id: file.id,
      name: file.name,
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