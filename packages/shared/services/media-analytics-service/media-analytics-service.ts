/**
 * Media Analytics Service - Provides analytics and statistics for media consumption
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../supabase-client';

export interface MediaStatsOptions {
  days?: number;
  mediaId?: string;
  userId?: string;
}

export interface MediaStatistics {
  mediaId: string;
  mediaName: string;
  sessionCount: number;
  totalPlayTime: number;
  averagePlayTime: number;
  averageCompletion: number;
  uniqueUsers: number;
  events: {
    plays: number;
    pauses: number;
    seeks: number;
    completions: number;
  };
}

export interface SessionAnalytics {
  sessionId: string;
  mediaId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  completionPercentage: number;
  events: Array<{
    type: string;
    timestamp: Date;
    data?: any;
  }>;
}

export class MediaAnalyticsService {
  private static instances = new Map<SupabaseClient, MediaAnalyticsService>();
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get instance for browser environments (requires Supabase client)
   * For CLI/Node environments, it will use the singleton if no client is provided
   */
  static getInstance(supabaseClient?: SupabaseClient): MediaAnalyticsService {
    if (!supabaseClient) {
      if (typeof window !== 'undefined') {
        throw new Error('Browser environment requires a Supabase client to be passed to getInstance()');
      }
      // CLI/server environment - use singleton
      supabaseClient = SupabaseClientService.getInstance().getClient();
    }

    if (!MediaAnalyticsService.instances.has(supabaseClient)) {
      MediaAnalyticsService.instances.set(supabaseClient, new MediaAnalyticsService(supabaseClient));
    }
    
    return MediaAnalyticsService.instances.get(supabaseClient)!;
  }

  /**
   * Get media statistics for the specified options
   */
  async getMediaStatistics(options: MediaStatsOptions = {}): Promise<MediaStatistics[]> {
    try {
      let sessionsQuery = this.supabase
        .from('learn_media_sessions')
        .select(`
          *,
          google_sources!media_id (
            id,
            name
          )
        `);

      if (options.days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - options.days);
        sessionsQuery = sessionsQuery.gte('session_start', startDate.toISOString());
      }

      if (options.mediaId) {
        sessionsQuery = sessionsQuery.eq('media_id', options.mediaId);
      }

      if (options.userId) {
        sessionsQuery = sessionsQuery.eq('user_id', options.userId);
      }

      const { data: sessions, error } = await sessionsQuery;

      if (error) {
        console.error('Error fetching sessions:', error);
        throw error;
      }

      if (!sessions || sessions.length === 0) {
        return [];
      }

      // Calculate statistics by media
      const mediaStatsMap: Record<string, {
        name: string;
        sessions: number;
        totalTime: number;
        completions: number;
        uniqueUsers: Set<string>;
      }> = {};

      sessions.forEach(session => {
        const mediaId = session.media_id;
        const mediaName = session.google_sources?.name || 'Unknown Media';
        
        if (!mediaStatsMap[mediaId]) {
          mediaStatsMap[mediaId] = {
            name: mediaName,
            sessions: 0,
            totalTime: 0,
            completions: 0,
            uniqueUsers: new Set()
          };
        }

        const stats = mediaStatsMap[mediaId];
        stats.sessions++;
        stats.totalTime += session.play_time_seconds || 0;
        stats.completions += session.completion_percentage || 0;
        if (session.user_id) {
          stats.uniqueUsers.add(session.user_id);
        }
      });

      // Get event counts for each media
      const mediaIds = Object.keys(mediaStatsMap);
      const eventStats = await this.getEventStatsByMedia(mediaIds, options);

      // Convert to MediaStatistics array
      return Object.entries(mediaStatsMap).map(([mediaId, stats]) => ({
        mediaId,
        mediaName: stats.name,
        sessionCount: stats.sessions,
        totalPlayTime: stats.totalTime,
        averagePlayTime: stats.sessions > 0 ? stats.totalTime / stats.sessions : 0,
        averageCompletion: stats.sessions > 0 ? stats.completions / stats.sessions : 0,
        uniqueUsers: stats.uniqueUsers.size,
        events: eventStats[mediaId] || {
          plays: 0,
          pauses: 0,
          seeks: 0,
          completions: 0
        }
      }));
    } catch (error) {
      console.error('Error in getMediaStatistics:', error);
      throw error;
    }
  }

  /**
   * Get detailed session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<SessionAnalytics | null> {
    try {
      const { data: session, error: sessionError } = await this.supabase
        .from('learn_media_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return null;
      }

      const { data: events, error: eventsError } = await this.supabase
        .from('learn_media_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      }

      return {
        sessionId: session.id,
        mediaId: session.media_id,
        userId: session.user_id,
        startTime: new Date(session.session_start),
        endTime: session.session_end ? new Date(session.session_end) : undefined,
        duration: session.play_time_seconds || 0,
        completionPercentage: session.completion_percentage || 0,
        events: (events || []).map(event => ({
          type: event.event_type,
          timestamp: new Date(event.timestamp),
          data: event.event_data
        }))
      };
    } catch (error) {
      console.error('Error in getSessionAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get event statistics grouped by media
   */
  private async getEventStatsByMedia(
    mediaIds: string[], 
    options: MediaStatsOptions = {}
  ): Promise<Record<string, MediaStatistics['events']>> {
    try {
      let eventsQuery = this.supabase
        .from('learn_media_events')
        .select('media_id, event_type')
        .in('media_id', mediaIds);

      if (options.days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - options.days);
        eventsQuery = eventsQuery.gte('timestamp', startDate.toISOString());
      }

      const { data: events, error } = await eventsQuery;

      if (error) {
        console.error('Error fetching events:', error);
        return {};
      }

      const eventStats: Record<string, MediaStatistics['events']> = {};

      (events || []).forEach(event => {
        if (!eventStats[event.media_id]) {
          eventStats[event.media_id] = {
            plays: 0,
            pauses: 0,
            seeks: 0,
            completions: 0
          };
        }

        const stats = eventStats[event.media_id];
        switch (event.event_type) {
          case 'play':
            stats.plays++;
            break;
          case 'pause':
            stats.pauses++;
            break;
          case 'seek':
            stats.seeks++;
            break;
          case 'ended':
          case 'complete':
            stats.completions++;
            break;
        }
      });

      return eventStats;
    } catch (error) {
      console.error('Error in getEventStatsByMedia:', error);
      return {};
    }
  }

  /**
   * Format duration in seconds to human-readable string
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get top media by play count
   */
  async getTopMedia(limit: number = 10, options: MediaStatsOptions = {}): Promise<MediaStatistics[]> {
    const stats = await this.getMediaStatistics(options);
    return stats
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, limit);
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(userId: string, options: MediaStatsOptions = {}): Promise<{
    totalSessions: number;
    totalPlayTime: number;
    averageSessionLength: number;
    mediaCount: number;
    favoriteMedia?: MediaStatistics;
  }> {
    const stats = await this.getMediaStatistics({ ...options, userId });
    
    const totalSessions = stats.reduce((sum, s) => sum + s.sessionCount, 0);
    const totalPlayTime = stats.reduce((sum, s) => sum + s.totalPlayTime, 0);
    
    return {
      totalSessions,
      totalPlayTime,
      averageSessionLength: totalSessions > 0 ? totalPlayTime / totalSessions : 0,
      mediaCount: stats.length,
      favoriteMedia: stats.sort((a, b) => b.sessionCount - a.sessionCount)[0]
    };
  }
}