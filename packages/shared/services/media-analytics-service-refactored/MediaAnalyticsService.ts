/**
 * Media Analytics Service - Provides analytics and statistics for media consumption
 * Refactored to extend BusinessService with proper dependency injection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { Logger } from '../base-classes/BaseService';

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

export interface UserEngagementMetrics {
  totalSessions: number;
  totalPlayTime: number;
  averageSessionLength: number;
  mediaCount: number;
  favoriteMedia?: MediaStatistics;
}

interface ServiceMetrics {
  totalQueriesExecuted: number;
  totalSessionsAnalyzed: number;
  totalEventsProcessed: number;
  totalMediaStatsCalculated: number;
  totalUserEngagementQueries: number;
  totalErrors: number;
  averageQueryTime: number;
  lastError?: string;
  lastOperation?: string;
  lastOperationTime?: Date;
}

export class MediaAnalyticsService extends BusinessService {
  private metrics: ServiceMetrics = {
    totalQueriesExecuted: 0,
    totalSessionsAnalyzed: 0,
    totalEventsProcessed: 0,
    totalMediaStatsCalculated: 0,
    totalUserEngagementQueries: 0,
    totalErrors: 0,
    averageQueryTime: 0
  };

  private queryTimes: number[] = [];

  constructor(
    private supabase: SupabaseClient,
    logger?: Logger
  ) {
    super('MediaAnalyticsService', { supabase }, logger);
  }

  /**
   * Validate required dependencies
   */
  protected validateDependencies(): void {
    if (!this.supabase) {
      throw new Error('MediaAnalyticsService requires a Supabase client');
    }
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('MediaAnalyticsService initialized');
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connectivity by checking a table
      const { error } = await this.supabase
        .from('learn_media_sessions')
        .select('count')
        .limit(1);

      const healthy = !error;
      
      return {
        healthy,
        details: {
          ...this.metrics,
          queryTimesCount: this.queryTimes.length,
          error: error?.message
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          ...this.metrics,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get media statistics for the specified options
   */
  async getMediaStatistics(options: MediaStatsOptions = {}): Promise<MediaStatistics[]> {
    this.metrics.lastOperation = 'getMediaStatistics';
    this.metrics.lastOperationTime = new Date();
    const startTime = Date.now();

    try {
      this.metrics.totalQueriesExecuted++;
      
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
        this.handleError('Error fetching sessions', error);
        throw error;
      }

      if (!sessions || sessions.length === 0) {
        this.recordQueryTime(startTime);
        return [];
      }

      this.metrics.totalSessionsAnalyzed += sessions.length;

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
      const results = Object.entries(mediaStatsMap).map(([mediaId, stats]) => ({
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

      this.metrics.totalMediaStatsCalculated += results.length;
      this.recordQueryTime(startTime);
      this.logger?.info(`Calculated statistics for ${results.length} media items`);
      
      return results;
    } catch (error) {
      this.handleError('Error in getMediaStatistics', error);
      throw error;
    }
  }

  /**
   * Get detailed session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<SessionAnalytics | null> {
    this.metrics.lastOperation = 'getSessionAnalytics';
    this.metrics.lastOperationTime = new Date();
    const startTime = Date.now();

    try {
      this.metrics.totalQueriesExecuted++;

      const { data: session, error: sessionError } = await this.supabase
        .from('learn_media_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        if (sessionError) {
          this.handleError('Error fetching session', sessionError);
        }
        this.recordQueryTime(startTime);
        return null;
      }

      this.metrics.totalSessionsAnalyzed++;

      const { data: events, error: eventsError } = await this.supabase
        .from('learn_media_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (eventsError) {
        this.handleError('Error fetching events', eventsError);
      }

      this.metrics.totalEventsProcessed += (events || []).length;
      this.recordQueryTime(startTime);

      const analytics: SessionAnalytics = {
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

      this.logger?.info(`Fetched analytics for session ${sessionId} with ${analytics.events.length} events`);
      return analytics;
    } catch (error) {
      this.handleError('Error in getSessionAnalytics', error);
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
      this.metrics.totalQueriesExecuted++;

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
        this.handleError('Error fetching events', error);
        return {};
      }

      this.metrics.totalEventsProcessed += (events || []).length;

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
      this.handleError('Error in getEventStatsByMedia', error);
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
    this.metrics.lastOperation = 'getTopMedia';
    this.metrics.lastOperationTime = new Date();

    try {
      const stats = await this.getMediaStatistics(options);
      const topMedia = stats
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, limit);
      
      this.logger?.info(`Retrieved top ${topMedia.length} media items`);
      return topMedia;
    } catch (error) {
      this.handleError('Error in getTopMedia', error);
      throw error;
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(userId: string, options: MediaStatsOptions = {}): Promise<UserEngagementMetrics> {
    this.metrics.lastOperation = 'getUserEngagement';
    this.metrics.lastOperationTime = new Date();
    this.metrics.totalUserEngagementQueries++;

    try {
      const stats = await this.getMediaStatistics({ ...options, userId });
      
      const totalSessions = stats.reduce((sum, s) => sum + s.sessionCount, 0);
      const totalPlayTime = stats.reduce((sum, s) => sum + s.totalPlayTime, 0);
      
      const engagement: UserEngagementMetrics = {
        totalSessions,
        totalPlayTime,
        averageSessionLength: totalSessions > 0 ? totalPlayTime / totalSessions : 0,
        mediaCount: stats.length,
        favoriteMedia: stats.sort((a, b) => b.sessionCount - a.sessionCount)[0]
      };

      this.logger?.info(`Calculated engagement metrics for user ${userId}: ${totalSessions} sessions, ${this.formatDuration(totalPlayTime)} total time`);
      return engagement;
    } catch (error) {
      this.handleError('Error in getUserEngagement', error);
      throw error;
    }
  }

  /**
   * Record query execution time
   */
  private recordQueryTime(startTime: number): void {
    const duration = Date.now() - startTime;
    this.queryTimes.push(duration);
    
    // Keep only last 100 query times
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }
    
    // Update average
    this.metrics.averageQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  /**
   * Handle errors consistently
   */
  private handleError(message: string, error: any): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = error?.message || String(error);
    this.logger?.error(message, error);
  }
}