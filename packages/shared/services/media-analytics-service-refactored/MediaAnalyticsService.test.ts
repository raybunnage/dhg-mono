/**
 * Test suite for MediaAnalyticsService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaAnalyticsService } from './MediaAnalyticsService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis()
};

describe('MediaAnalyticsService', () => {
  let service: MediaAnalyticsService;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Setup default mock behavior
    (mockSupabaseClient.from as any).mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();

    service = new MediaAnalyticsService(mockSupabaseClient, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should create instance with Supabase client', () => {
      expect(service).toBeInstanceOf(MediaAnalyticsService);
    });

    it('should throw error if Supabase client is not provided', () => {
      expect(() => new MediaAnalyticsService(null as any)).toThrow('MediaAnalyticsService requires a Supabase client');
    });

    it('should accept optional logger', () => {
      const serviceWithoutLogger = new MediaAnalyticsService(mockSupabaseClient);
      expect(serviceWithoutLogger).toBeInstanceOf(MediaAnalyticsService);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when database is accessible', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [{ count: 1 }], error: null });
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toBeDefined();
    });

    it('should return unhealthy status when database is not accessible', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: { message: 'Connection failed' } });
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Connection failed');
    });
  });

  describe('Media Statistics', () => {
    const mockSessions = [
      {
        id: '1',
        media_id: 'media1',
        user_id: 'user1',
        session_start: '2024-01-01T00:00:00Z',
        play_time_seconds: 300,
        completion_percentage: 75,
        google_sources: { id: 'media1', name: 'Test Video 1' }
      },
      {
        id: '2',
        media_id: 'media1',
        user_id: 'user2',
        session_start: '2024-01-01T01:00:00Z',
        play_time_seconds: 450,
        completion_percentage: 100,
        google_sources: { id: 'media1', name: 'Test Video 1' }
      },
      {
        id: '3',
        media_id: 'media2',
        user_id: 'user1',
        session_start: '2024-01-01T02:00:00Z',
        play_time_seconds: 600,
        completion_percentage: 50,
        google_sources: { id: 'media2', name: 'Test Video 2' }
      }
    ];

    const mockEvents = [
      { media_id: 'media1', event_type: 'play' },
      { media_id: 'media1', event_type: 'play' },
      { media_id: 'media1', event_type: 'pause' },
      { media_id: 'media1', event_type: 'complete' },
      { media_id: 'media2', event_type: 'play' },
      { media_id: 'media2', event_type: 'seek' }
    ];

    it('should calculate media statistics correctly', async () => {
      // Mock sessions query
      mockQueryBuilder.gte = vi.fn().mockReturnThis();
      mockQueryBuilder.eq = vi.fn().mockReturnThis();
      mockQueryBuilder.select.mockResolvedValueOnce({ data: mockSessions, error: null });
      
      // Mock events query
      mockQueryBuilder.in = vi.fn().mockReturnThis();
      mockQueryBuilder.select.mockResolvedValueOnce({ data: mockEvents, error: null });
      
      const stats = await service.getMediaStatistics();
      
      expect(stats).toHaveLength(2);
      
      // Check media1 stats
      const media1Stats = stats.find(s => s.mediaId === 'media1');
      expect(media1Stats).toBeDefined();
      expect(media1Stats?.sessionCount).toBe(2);
      expect(media1Stats?.totalPlayTime).toBe(750);
      expect(media1Stats?.averagePlayTime).toBe(375);
      expect(media1Stats?.averageCompletion).toBe(87.5);
      expect(media1Stats?.uniqueUsers).toBe(2);
      expect(media1Stats?.events.plays).toBe(2);
      expect(media1Stats?.events.completions).toBe(1);
      
      // Check metrics
      const metrics = service.getMetrics();
      expect(metrics.totalSessionsAnalyzed).toBe(3);
      expect(metrics.totalEventsProcessed).toBe(6);
      expect(metrics.totalMediaStatsCalculated).toBe(2);
    });

    it('should filter by days', async () => {
      mockQueryBuilder.select.mockResolvedValueOnce({ data: [], error: null });
      
      await service.getMediaStatistics({ days: 7 });
      
      expect(mockQueryBuilder.gte).toHaveBeenCalled();
    });

    it('should filter by mediaId', async () => {
      mockQueryBuilder.select.mockResolvedValueOnce({ data: [], error: null });
      
      await service.getMediaStatistics({ mediaId: 'media1' });
      
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('media_id', 'media1');
    });

    it('should filter by userId', async () => {
      mockQueryBuilder.select.mockResolvedValueOnce({ data: [], error: null });
      
      await service.getMediaStatistics({ userId: 'user1' });
      
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user1');
    });

    it('should handle empty results', async () => {
      mockQueryBuilder.select.mockResolvedValueOnce({ data: [], error: null });
      
      const stats = await service.getMediaStatistics();
      
      expect(stats).toEqual([]);
    });

    it('should handle errors', async () => {
      mockQueryBuilder.select.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      
      await expect(service.getMediaStatistics()).rejects.toThrow();
      expect(service.getMetrics().totalErrors).toBe(1);
    });
  });

  describe('Session Analytics', () => {
    const mockSession = {
      id: 'session1',
      media_id: 'media1',
      user_id: 'user1',
      session_start: '2024-01-01T00:00:00Z',
      session_end: '2024-01-01T00:10:00Z',
      play_time_seconds: 600,
      completion_percentage: 85
    };

    const mockSessionEvents = [
      { event_type: 'play', timestamp: '2024-01-01T00:00:00Z', event_data: {} },
      { event_type: 'pause', timestamp: '2024-01-01T00:05:00Z', event_data: { position: 300 } },
      { event_type: 'play', timestamp: '2024-01-01T00:06:00Z', event_data: {} },
      { event_type: 'ended', timestamp: '2024-01-01T00:10:00Z', event_data: {} }
    ];

    it('should fetch session analytics', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockSession, error: null });
      mockQueryBuilder.order.mockResolvedValueOnce({ data: mockSessionEvents, error: null });
      
      const analytics = await service.getSessionAnalytics('session1');
      
      expect(analytics).toBeDefined();
      expect(analytics?.sessionId).toBe('session1');
      expect(analytics?.mediaId).toBe('media1');
      expect(analytics?.userId).toBe('user1');
      expect(analytics?.duration).toBe(600);
      expect(analytics?.completionPercentage).toBe(85);
      expect(analytics?.events).toHaveLength(4);
      expect(analytics?.startTime).toBeInstanceOf(Date);
      expect(analytics?.endTime).toBeInstanceOf(Date);
    });

    it('should handle session not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      
      const analytics = await service.getSessionAnalytics('invalid');
      
      expect(analytics).toBeNull();
    });

    it('should handle events fetch error gracefully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockSession, error: null });
      mockQueryBuilder.order.mockResolvedValueOnce({ data: null, error: { message: 'Events error' } });
      
      const analytics = await service.getSessionAnalytics('session1');
      
      expect(analytics).toBeDefined();
      expect(analytics?.events).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Top Media', () => {
    it('should return top media by session count', async () => {
      const mockStats = [
        { mediaId: '1', sessionCount: 10, mediaName: 'Popular' },
        { mediaId: '2', sessionCount: 25, mediaName: 'Most Popular' },
        { mediaId: '3', sessionCount: 5, mediaName: 'Less Popular' }
      ];
      
      // Mock getMediaStatistics
      vi.spyOn(service, 'getMediaStatistics').mockResolvedValueOnce(mockStats as any);
      
      const topMedia = await service.getTopMedia(2);
      
      expect(topMedia).toHaveLength(2);
      expect(topMedia[0].sessionCount).toBe(25);
      expect(topMedia[1].sessionCount).toBe(10);
    });
  });

  describe('User Engagement', () => {
    it('should calculate user engagement metrics', async () => {
      const mockUserStats = [
        {
          mediaId: '1',
          mediaName: 'Video 1',
          sessionCount: 5,
          totalPlayTime: 1500,
          averagePlayTime: 300,
          averageCompletion: 80,
          uniqueUsers: 1,
          events: { plays: 5, pauses: 3, seeks: 1, completions: 4 }
        },
        {
          mediaId: '2',
          mediaName: 'Video 2',
          sessionCount: 3,
          totalPlayTime: 600,
          averagePlayTime: 200,
          averageCompletion: 60,
          uniqueUsers: 1,
          events: { plays: 3, pauses: 2, seeks: 0, completions: 2 }
        }
      ];
      
      vi.spyOn(service, 'getMediaStatistics').mockResolvedValueOnce(mockUserStats);
      
      const engagement = await service.getUserEngagement('user1');
      
      expect(engagement.totalSessions).toBe(8);
      expect(engagement.totalPlayTime).toBe(2100);
      expect(engagement.averageSessionLength).toBe(262.5);
      expect(engagement.mediaCount).toBe(2);
      expect(engagement.favoriteMedia?.mediaId).toBe('1');
      expect(service.getMetrics().totalUserEngagementQueries).toBe(1);
    });

    it('should handle user with no sessions', async () => {
      vi.spyOn(service, 'getMediaStatistics').mockResolvedValueOnce([]);
      
      const engagement = await service.getUserEngagement('user1');
      
      expect(engagement.totalSessions).toBe(0);
      expect(engagement.totalPlayTime).toBe(0);
      expect(engagement.averageSessionLength).toBe(0);
      expect(engagement.mediaCount).toBe(0);
      expect(engagement.favoriteMedia).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    it('should format duration correctly', () => {
      expect(service.formatDuration(30)).toBe('30s');
      expect(service.formatDuration(90)).toBe('1m 30s');
      expect(service.formatDuration(3661)).toBe('1h 1m 1s');
    });
  });

  describe('Metrics', () => {
    it('should track all operations', async () => {
      // Setup mocks
      mockQueryBuilder.select.mockResolvedValue({ data: [], error: null });
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
      
      // Perform operations
      await service.getMediaStatistics();
      await service.getSessionAnalytics('test');
      await service.getUserEngagement('user1');
      
      const metrics = service.getMetrics();
      
      expect(metrics.totalQueriesExecuted).toBeGreaterThan(0);
      expect(metrics.averageQueryTime).toBeGreaterThan(0);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should track errors', async () => {
      mockQueryBuilder.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Test error' } 
      });
      
      try {
        await service.getMediaStatistics();
      } catch (e) {
        // Expected error
      }
      
      const metrics = service.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.lastError).toBe('Test error');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (mockSupabaseClient.from as any).mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      await expect(service.getMediaStatistics()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(service.getMetrics().totalErrors).toBe(1);
    });
  });
});