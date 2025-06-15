/**
 * Media Tracking Service - Refactored with BusinessService base class
 * 
 * Tracks media playback sessions, events, and bookmarks with proper
 * dependency injection, retry logic, and performance monitoring.
 */

import { BusinessService } from '../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../base-classes/BaseService';
import { Database } from '../../../../supabase/types';
import {
  MediaTrackingOptions,
  PlaybackEventData,
  MediaSession,
  MediaBookmark,
  SessionStatistics
} from './types';

type Tables = Database['public']['Tables'];

/**
 * MediaTrackingService - Tracks user media consumption for learning analytics
 * 
 * Features:
 * - Session lifecycle management
 * - Playback event tracking
 * - Bookmark management
 * - Progress calculation
 * - Analytics and reporting
 * - Automatic retry logic
 * - Performance monitoring
 */
export class MediaTrackingService extends BusinessService {
  private currentSession: string | null = null;
  private sessionStartTime: Date | null = null;
  private totalPlayTime: number = 0;
  private isPlaying: boolean = false;
  private playStartTime: Date | null = null;
  private lastPosition: number = 0;
  private mediaDuration: number | null = null;

  constructor(supabaseClient: SupabaseClient<Database>, logger?: Logger) {
    super('MediaTrackingService', { supabaseClient }, logger);
  }

  /**
   * Validate that all required dependencies are provided
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabaseClient) {
      throw new Error('SupabaseClient is required');
    }
  }

  protected async initialize(): Promise<void> {
    // No special initialization needed
    this.logger?.info('MediaTrackingService initialized');
  }

  protected async cleanup(): Promise<void> {
    // End any active session
    if (this.currentSession) {
      await this.endSession();
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    serviceName: string;
    timestamp: Date;
    details?: Record<string, any>;
    error?: string;
  }> {
    try {
      // Check if we can query the media sessions table
      const { error } = await this.dependencies.supabaseClient
        .from('learn_media_sessions')
        .select('id')
        .limit(1);

      return {
        healthy: !error,
        serviceName: this.serviceName,
        timestamp: new Date(),
        details: {
          activeSession: this.currentSession !== null,
          isPlaying: this.isPlaying,
          supabaseConnected: !error
        },
        error: error?.message
      };
    } catch (error: any) {
      return {
        healthy: false,
        serviceName: this.serviceName,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Start a new media session with validation
   */
  async startSession(options: MediaTrackingOptions): Promise<string | null> {
    this.validateInput({ options }, () => {
      if (!options.mediaId || !options.mediaId.trim()) {
        throw new Error('Media ID is required');
      }
    });

    return this.withTransaction(async () => {
      // End any existing session
      if (this.currentSession) {
        await this.endSession();
      }

      return this.withRetry(async () => {
        // Get the current authenticated user
        const { data: { user }, error: userError } = await this.dependencies.supabaseClient.auth.getUser();
        
        if (userError || !user) {
          throw new Error('No authenticated user found for media session');
        }

        const sessionData: Tables['learn_media_sessions']['Insert'] = {
          user_id: user.id,
          media_id: options.mediaId,
          session_start: new Date().toISOString(),
          device_type: options.deviceType || this.detectDeviceType(),
          session_type: 'learning',
          total_duration_seconds: 0,
          completion_percentage: 0
        };

        const { data, error } = await this.dependencies.supabaseClient
          .from('learn_media_sessions')
          .insert(sessionData)
          .select('id')
          .single();

        if (error) throw error;

        this.currentSession = data.id;
        this.sessionStartTime = new Date();
        this.totalPlayTime = 0;
        this.lastPosition = 0;
        this.mediaDuration = null;
        
        // Log session start event
        await this.logPlaybackEvent('session_start', 0);
        
        this.logger?.info(`Started media session: ${data.id} for media: ${options.mediaId}`);
        return data.id;
      });
    });
  }

  /**
   * End the current session and calculate final statistics
   */
  async endSession(): Promise<SessionStatistics | null> {
    if (!this.currentSession) {
      return null;
    }

    return this.withTransaction(async () => {
      // Calculate final play time
      if (this.isPlaying && this.playStartTime) {
        this.totalPlayTime += (Date.now() - this.playStartTime.getTime()) / 1000;
        this.isPlaying = false;
      }

      const sessionEndTime = new Date();
      const sessionDuration = this.sessionStartTime 
        ? (sessionEndTime.getTime() - this.sessionStartTime.getTime()) / 1000
        : 0;

      const completionPercentage = this.mediaDuration && this.mediaDuration > 0
        ? Math.min(100, Math.round((this.lastPosition / this.mediaDuration) * 100))
        : 0;

      return this.withRetry(async () => {
        // Update session with final data
        const { error: updateError } = await this.dependencies.supabaseClient
          .from('learn_media_sessions')
          .update({
            session_end: sessionEndTime.toISOString(),
            total_duration_seconds: Math.round(sessionDuration),
            active_duration_seconds: Math.round(this.totalPlayTime),
            completion_percentage: completionPercentage,
            last_position_seconds: this.lastPosition
          })
          .eq('id', this.currentSession!);

        if (updateError) throw updateError;

        // Log session end event
        await this.logPlaybackEvent('session_end', this.lastPosition);

        const stats: SessionStatistics = {
          sessionId: this.currentSession!,
          totalDuration: sessionDuration,
          activeDuration: this.totalPlayTime,
          completionPercentage,
          lastPosition: this.lastPosition
        };

        // Reset session state
        this.currentSession = null;
        this.sessionStartTime = null;
        this.totalPlayTime = 0;
        this.lastPosition = 0;
        this.mediaDuration = null;

        this.logger?.info(`Ended media session with ${completionPercentage}% completion`);
        return stats;
      });
    });
  }

  /**
   * Log a playback event with retry logic
   */
  async logPlaybackEvent(
    eventType: string,
    timestampSeconds: number,
    eventData?: PlaybackEventData
  ): Promise<void> {
    if (!this.currentSession) {
      this.logger?.warn('No active session for playback event');
      return;
    }

    this.validateInput({ eventType, timestampSeconds }, () => {
      if (!eventType || !eventType.trim()) {
        throw new Error('Event type is required');
      }
      if (timestampSeconds < 0) {
        throw new Error('Timestamp cannot be negative');
      }
    });
    
    return this.withRetry(async () => {
      const { data: { user } } = await this.dependencies.supabaseClient.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user for playback event');
      }

      // Update last position
      this.lastPosition = timestampSeconds;

      // Handle play/pause events for duration tracking
      if (eventType === 'play') {
        this.isPlaying = true;
        this.playStartTime = new Date();
      } else if (eventType === 'pause' || eventType === 'ended') {
        if (this.isPlaying && this.playStartTime) {
          this.totalPlayTime += (Date.now() - this.playStartTime.getTime()) / 1000;
        }
        this.isPlaying = false;
        this.playStartTime = null;
      }

      // Handle duration updates
      if (eventType === 'loadedmetadata' && eventData?.duration) {
        this.mediaDuration = eventData.duration;
      }

      const playbackEvent: Tables['learn_media_playback_events']['Insert'] = {
        session_id: this.currentSession,
        user_id: user.id,
        event_type: eventType,
        timestamp_seconds: timestampSeconds,
        event_data: eventData ? {
          ...eventData,
          playbackSpeed: eventData.playbackSpeed,
          volume: eventData.volume
        } : {}
      };

      const { error } = await this.dependencies.supabaseClient
        .from('learn_media_playback_events')
        .insert(playbackEvent);

      if (error) throw error;

      // Update session progress periodically
      if (eventType === 'timeupdate' || eventType === 'pause' || eventType === 'ended') {
        await this.updateSessionProgress();
      }
    }, { 
      maxAttempts: 2 // Reduce retries for events to avoid flooding
    }));
  }

  /**
   * Create a bookmark at the current position
   */
  async createBookmark(
    title: string,
    description?: string,
    category?: string
  ): Promise<MediaBookmark | null> {
    if (!this.currentSession) {
      this.logger?.warn('No active session for bookmark');
      return null;
    }

    this.validateInput({ title }, () => {
      if (!title || !title.trim()) {
        throw new Error('Bookmark title is required');
      }
    });
    
    return this.withTransaction(async () => {
      return this.withRetry(async () => {
        const { data: { user } } = await this.dependencies.supabaseClient.auth.getUser();
        
        if (!user) {
          throw new Error('No authenticated user for bookmark');
        }

        // Get media ID from current session
        const { data: session, error: sessionError } = await this.dependencies.supabaseClient
          .from('learn_media_sessions')
          .select('media_id')
          .eq('id', this.currentSession!)
          .single();

        if (sessionError || !session) {
          throw new Error('Failed to get session details');
        }

        const bookmark: Tables['learn_media_bookmarks']['Insert'] = {
          user_id: user.id,
          media_id: session.media_id,
          timestamp_seconds: this.lastPosition,
          note: `${title}${description ? `: ${description}` : ''}`,
          bookmark_type: category,
          tags: tags
        };

        const { data, error } = await this.dependencies.supabaseClient
          .from('learn_media_bookmarks')
          .insert(bookmark)
          .select()
          .single();

        if (error) throw error;

        this.logger?.info(`Created bookmark at ${this.lastPosition}s: ${title}`);
        return data as MediaBookmark;
      });
    }));
  }

  /**
   * Get bookmarks for the current media
   */
  async getMediaBookmarks(mediaId: string): Promise<MediaBookmark[]> {
    this.validateInput({ mediaId }, () => {
      if (!mediaId || !mediaId.trim()) {
        throw new Error('Media ID is required');
      }
    });
    
    return this.withRetry(async () => {
      const { data: { user } } = await this.dependencies.supabaseClient.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data, error } = await this.dependencies.supabaseClient
        .from('learn_media_bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('media_id', mediaId)
        .order('timestamp_seconds');

      if (error) throw error;

      return (data as MediaBookmark[]) || [];
    }));
  }

  /**
   * Get user's recent media sessions
   */
  async getRecentSessions(
    limit: number = 10,
    mediaId?: string
  ): Promise<MediaSession[]> {
    this.validateInput({ limit }, () => {
      if (limit <= 0) {
        throw new Error('Limit must be positive');
      }
    });
    
    return this.withRetry(async () => {
      const { data: { user } } = await this.dependencies.supabaseClient.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      let query = this.dependencies.supabaseClient
        .from('learn_media_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_start', { ascending: false })
        .limit(limit);

      if (mediaId) {
        query = query.eq('media_id', mediaId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data as MediaSession[]) || [];
    }));
  }

  /**
   * Get aggregated statistics for a media item
   */
  async getMediaStatistics(mediaId: string): Promise<{
    totalSessions: number;
    totalWatchTime: number;
    averageCompletion: number;
    bookmarkCount: number;
  }> {
    this.validateInput({ mediaId }, () => {
      if (!mediaId || !mediaId.trim()) {
        throw new Error('Media ID is required');
      }
    });
    
    return this.withRetry(async () => {
      const { data: { user } } = await this.dependencies.supabaseClient.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Get session statistics
      const { data: sessions, error: sessionsError } = await this.dependencies.supabaseClient
        .from('learn_media_sessions')
        .select('active_duration_seconds, completion_percentage')
        .eq('user_id', user.id)
        .eq('media_id', mediaId);

      if (sessionsError) throw sessionsError;

      // Get bookmark count
      const { count: bookmarkCount, error: bookmarkError } = await this.dependencies.supabaseClient
        .from('learn_media_bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('media_id', mediaId);

      if (bookmarkError) throw bookmarkError;

      // Calculate statistics
      const totalSessions = sessions?.length || 0;
      const totalWatchTime = sessions?.reduce(
        (sum: number, s: any) => sum + (s.active_duration_seconds || 0), 
        0
      ) || 0;
      const averageCompletion = totalSessions > 0
        ? sessions!.reduce((sum: number, s: any) => sum + (s.completion_percentage || 0), 0) / totalSessions
        : 0;

      return {
        totalSessions,
        totalWatchTime,
        averageCompletion: Math.round(averageCompletion),
        bookmarkCount: bookmarkCount || 0
      };
    }));
  }

  /**
   * Helper: Update session progress
   */
  private async updateSessionProgress(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const completionPercentage = this.mediaDuration && this.mediaDuration > 0
        ? Math.min(100, Math.round((this.lastPosition / this.mediaDuration) * 100))
        : 0;

      const { error } = await this.dependencies.supabaseClient
        .from('learn_media_sessions')
        .update({
          last_position_seconds: this.lastPosition,
          completion_percentage: completionPercentage,
          active_duration_seconds: Math.round(this.totalPlayTime)
        })
        .eq('id', this.currentSession);

      if (error) {
        this.logger?.error(`Failed to update session progress: ${error.message}`);
      }
    } catch (error: any) {
      this.logger?.error(`Error updating session progress: ${error.message}`);
    }
  }

  /**
   * Helper: Detect device type
   */
  private detectDeviceType(): string {
    // In Node.js environment, default to 'desktop'
    if (typeof window === 'undefined') {
      return 'desktop';
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|ipod/.test(userAgent)) {
      return 'mobile';
    } else if (/tablet/.test(userAgent)) {
      return 'tablet';
    }
    
    return 'desktop';
  }
}