import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../../supabase/types';

type Tables = Database['public']['Tables'];
type MediaSession = Tables['learn_media_sessions']['Insert'];
type PlaybackEvent = Tables['learn_media_playback_events']['Insert'];
type MediaBookmark = Tables['learn_media_bookmarks']['Insert'];

export interface MediaTrackingOptions {
  userId?: string; // Optional - will use authenticated user if not provided
  mediaId: string;
  mediaType?: 'audio' | 'video';
  deviceType?: string;
}

export interface PlaybackEventData {
  playbackSpeed?: number;
  volume?: number;
  seekFrom?: number;
  seekTo?: number;
  quality?: string;
  [key: string]: any;
}

export class MediaTrackingService {
  private supabase: SupabaseClient<Database>;
  private currentSession: string | null = null;
  private sessionStartTime: Date | null = null;
  private totalPlayTime: number = 0;
  private isPlaying: boolean = false;
  private playStartTime: Date | null = null;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Start a new media session
   */
  async startSession(options: MediaTrackingOptions): Promise<string | null> {
    try {
      // Get the current authenticated user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('No authenticated user found for media session:', userError);
        return null;
      }

      const sessionData: MediaSession = {
        user_id: user.id, // Use authenticated user ID, not passed parameter
        media_id: options.mediaId,
        session_start: new Date().toISOString(),
        device_type: options.deviceType || this.detectDeviceType(),
        session_type: 'learning',
        total_duration_seconds: 0,
        completion_percentage: 0
      };

      const { data, error } = await this.supabase
        .from('learn_media_sessions')
        .insert(sessionData)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating media session:', error);
        return null;
      }

      this.currentSession = data.id;
      this.sessionStartTime = new Date();
      this.totalPlayTime = 0;
      
      // Log session start event
      await this.logPlaybackEvent('session_start', 0);
      
      return data.id;
    } catch (error) {
      console.error('Failed to start media session:', error);
      return null;
    }
  }

  /**
   * Log a playback event
   */
  async logPlaybackEvent(
    eventType: string, 
    timestampSeconds: number,
    eventData?: PlaybackEventData
  ): Promise<void> {
    if (!this.currentSession) {
      console.warn('No active session for playback event');
      return;
    }

    try {
      // Get user ID synchronously from the session data
      const { data: { user } } = await this.supabase.auth.getUser();
      
      const event: PlaybackEvent = {
        session_id: this.currentSession,
        user_id: user?.id || null,
        event_type: eventType,
        timestamp_seconds: timestampSeconds,
        event_data: eventData || null
      };

      const { error } = await this.supabase
        .from('learn_media_playback_events')
        .insert(event);

      if (error) {
        console.error('Error logging playback event:', error);
      }
    } catch (error) {
      console.error('Failed to log playback event:', error);
    }
  }

  /**
   * Track play event
   */
  async trackPlay(timestampSeconds: number, eventData?: PlaybackEventData): Promise<void> {
    this.isPlaying = true;
    this.playStartTime = new Date();
    await this.logPlaybackEvent('play', timestampSeconds, eventData);
  }

  /**
   * Track pause event
   */
  async trackPause(timestampSeconds: number, eventData?: PlaybackEventData): Promise<void> {
    if (this.isPlaying && this.playStartTime) {
      // Calculate play duration and add to total
      const playDuration = (new Date().getTime() - this.playStartTime.getTime()) / 1000;
      this.totalPlayTime += playDuration;
    }
    
    this.isPlaying = false;
    this.playStartTime = null;
    await this.logPlaybackEvent('pause', timestampSeconds, eventData);
  }

  /**
   * Track seek event
   */
  async trackSeek(
    fromSeconds: number, 
    toSeconds: number,
    eventData?: PlaybackEventData
  ): Promise<void> {
    await this.logPlaybackEvent('seek', toSeconds, {
      ...eventData,
      seekFrom: fromSeconds,
      seekTo: toSeconds
    });
  }

  /**
   * Track playback speed change
   */
  async trackSpeedChange(
    timestampSeconds: number,
    newSpeed: number,
    eventData?: PlaybackEventData
  ): Promise<void> {
    await this.logPlaybackEvent('speed_change', timestampSeconds, {
      ...eventData,
      playbackSpeed: newSpeed
    });
  }

  /**
   * Track volume change
   */
  async trackVolumeChange(
    timestampSeconds: number,
    newVolume: number,
    eventData?: PlaybackEventData
  ): Promise<void> {
    await this.logPlaybackEvent('volume_change', timestampSeconds, {
      ...eventData,
      volume: newVolume
    });
  }

  /**
   * Add a bookmark
   */
  async addBookmark(
    mediaId: string,
    timestampSeconds: number,
    note?: string,
    bookmarkType?: string,
    tags?: string[]
  ): Promise<void> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      
      const bookmark: MediaBookmark = {
        user_id: user.user?.id || null,
        media_id: mediaId,
        timestamp_seconds: timestampSeconds,
        note: note || null,
        bookmark_type: bookmarkType || 'general',
        tags: tags || null
      };

      const { error } = await this.supabase
        .from('learn_media_bookmarks')
        .insert(bookmark);

      if (error) {
        console.error('Error adding bookmark:', error);
      }
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  }

  /**
   * End the current session
   */
  async endSession(completionPercentage?: number): Promise<void> {
    if (!this.currentSession || !this.sessionStartTime) {
      console.warn('No active session to end');
      return;
    }

    try {
      // If still playing, count the final play duration
      if (this.isPlaying && this.playStartTime) {
        const playDuration = (new Date().getTime() - this.playStartTime.getTime()) / 1000;
        this.totalPlayTime += playDuration;
      }


      // Log session end event
      await this.logPlaybackEvent('session_end', 0);

      // Update session with final data
      const { error } = await this.supabase
        .from('learn_media_sessions')
        .update({
          session_end: new Date().toISOString(),
          total_duration_seconds: Math.round(this.totalPlayTime),
          completion_percentage: completionPercentage || 0
        })
        .eq('id', this.currentSession);

      if (error) {
        console.error('Error updating session:', error);
      }

      // Reset session state
      this.currentSession = null;
      this.sessionStartTime = null;
      this.totalPlayTime = 0;
      this.isPlaying = false;
      this.playStartTime = null;
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSession;
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): string {
    const userAgent = navigator.userAgent;
    
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    
    return 'desktop';
  }
}

// Export a factory function to create service instances
export function createMediaTrackingService(supabaseClient: SupabaseClient<Database>): MediaTrackingService {
  return new MediaTrackingService(supabaseClient);
}