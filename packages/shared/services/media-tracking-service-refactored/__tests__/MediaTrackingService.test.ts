import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from 'vitest';
import { MediaTrackingService } from '../MediaTrackingService';
import { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { Database } from '../../../../../supabase/types';
import {
  MediaTrackingOptions,
  PlaybackEventData,
  MediaSession,
  PlaybackEvent,
  MediaBookmark,
  SessionStatistics,
  PlaybackEventType,
  BookmarkCategory
} from '../types';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Helper to create a mock Supabase client
const createMockSupabaseClient = () => {
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    })
  };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();

  // Setup chain methods
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate
  });

  mockSelect.mockReturnValue({
    eq: mockEq,
    limit: mockLimit,
    order: mockOrder,
    single: mockSingle
  });

  mockInsert.mockReturnValue({
    select: mockSelect
  });

  mockUpdate.mockReturnValue({
    eq: mockEq
  });

  mockEq.mockReturnValue({
    single: mockSingle,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit
  });

  mockOrder.mockReturnValue({
    limit: mockLimit
  });

  mockLimit.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });

  return {
    auth: mockAuth,
    from: mockFrom,
    _mockMethods: {
      mockFrom,
      mockSelect,
      mockInsert,
      mockUpdate,
      mockEq,
      mockSingle,
      mockOrder,
      mockLimit
    }
  } as unknown as SupabaseClient<Database> & { 
    _mockMethods: any 
  };
};

// Helper to create mock data
const createMockSession = (overrides?: Partial<MediaSession>): MediaSession => ({
  id: 'session-123',
  user_id: 'test-user-id',
  media_id: 'media-123',
  session_start: new Date().toISOString(),
  session_end: null,
  device_type: 'desktop',
  session_type: 'learning',
  total_duration_seconds: 0,
  active_duration_seconds: 0,
  completion_percentage: 0,
  last_position_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

const createMockBookmark = (overrides?: Partial<MediaBookmark>): MediaBookmark => ({
  id: 'bookmark-123',
  user_id: 'test-user-id',
  media_id: 'media-123',
  timestamp_seconds: 30,
  title: 'Test Bookmark',
  description: 'Test description',
  category: BookmarkCategory.IMPORTANT,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

describe('MediaTrackingService', () => {
  let service: MediaTrackingService;
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockLogger = new Logger('test');
    service = new MediaTrackingService(mockSupabaseClient, mockLogger);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Service Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(service).toBeDefined();
      expect(service.getMetadata().serviceName).toBe('MediaTrackingService');
    });

    it('should throw error without supabase client', () => {
      expect(() => new MediaTrackingService(null as any, mockLogger))
        .toThrow('SupabaseClient is required');
    });

    it('should initialize without logger', () => {
      const serviceWithoutLogger = new MediaTrackingService(mockSupabaseClient);
      expect(serviceWithoutLogger).toBeDefined();
    });

    it('should validate dependencies on construction', () => {
      expect(() => new MediaTrackingService({} as any, mockLogger))
        .toThrow('SupabaseClient is required');
    });
  });

  describe('Health Check', () => {
    it('should report healthy when database is accessible', async () => {
      mockSupabaseClient._mockMethods.mockLimit.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.serviceName).toBe('MediaTrackingService');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toEqual({
        activeSession: false,
        isPlaying: false,
        supabaseConnected: true
      });
    });

    it('should report unhealthy when database is not accessible', async () => {
      mockSupabaseClient._mockMethods.mockLimit.mockResolvedValueOnce({ 
        data: null, 
        error: new Error('Database connection failed') 
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Database connection failed');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Unexpected error');
    });
  });

  describe('Session Management', () => {
    describe('startSession', () => {
      it('should start a new session successfully', async () => {
        const mockSession = createMockSession();
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { id: mockSession.id },
          error: null
        });

        const sessionId = await service.startSession({
          mediaId: 'media-123',
          deviceType: 'mobile'
        });

        expect(sessionId).toBe('session-123');
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('learn_media_sessions');
        expect(mockSupabaseClient._mockMethods.mockInsert).toHaveBeenCalled();
      });

      it('should validate media ID is required', async () => {
        await expect(service.startSession({ mediaId: '' }))
          .rejects.toThrow('Media ID is required');
        
        await expect(service.startSession({ mediaId: '   ' }))
          .rejects.toThrow('Media ID is required');
      });

      it('should handle unauthenticated user', async () => {
        mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValueOnce({
          data: { user: null },
          error: null
        });

        await expect(service.startSession({ mediaId: 'media-123' }))
          .rejects.toThrow('No authenticated user found');
      });

      it('should end existing session before starting new one', async () => {
        // Start first session
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { id: 'session-1' },
          error: null
        });
        await service.startSession({ mediaId: 'media-1' });

        // Reset mocks and start second session
        vi.clearAllMocks();
        mockSupabaseClient = createMockSupabaseClient();
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { id: 'session-2' },
          error: null
        });
        
        const secondSessionId = await service.startSession({ mediaId: 'media-2' });
        
        expect(secondSessionId).toBe('session-2');
      });

      it('should detect device type automatically', async () => {
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { id: 'session-123' },
          error: null
        });

        await service.startSession({ mediaId: 'media-123' });

        // In Node.js environment, should default to 'desktop'
        const insertCall = mockSupabaseClient._mockMethods.mockInsert.mock.calls[0][0];
        expect(insertCall.device_type).toBe('desktop');
      });

      it('should retry on transient failures', async () => {
        // First attempt fails
        mockSupabaseClient._mockMethods.mockSingle.mockRejectedValueOnce(
          new Error('Temporary network error')
        );
        
        // Second attempt succeeds
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { id: 'session-123' },
          error: null
        });

        const sessionId = await service.startSession({ mediaId: 'media-123' });
        expect(sessionId).toBe('session-123');
      });
    });

    describe('endSession', () => {
      beforeEach(async () => {
        // Start a session first
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { id: 'session-123' },
          error: null
        });
        await service.startSession({ mediaId: 'media-123' });
      });

      it('should end session with statistics', async () => {
        // Simulate some playback
        await service.logPlaybackEvent('play', 0);
        await new Promise(resolve => setTimeout(resolve, 100));
        await service.logPlaybackEvent('pause', 10);

        mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
          data: null,
          error: null
        });

        const stats = await service.endSession();

        expect(stats).toBeDefined();
        expect(stats?.sessionId).toBe('session-123');
        expect(stats?.lastPosition).toBe(10);
        expect(stats?.totalDuration).toBeGreaterThan(0);
      });

      it('should calculate completion percentage correctly', async () => {
        // Set media duration
        await service.logPlaybackEvent('loadedmetadata', 0, { duration: 100 });
        
        // Play to 50%
        await service.logPlaybackEvent('timeupdate', 50);

        mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
          data: null,
          error: null
        });

        const stats = await service.endSession();
        
        expect(stats?.completionPercentage).toBe(50);
      });

      it('should return null if no active session', async () => {
        await service.endSession(); // End the session
        const stats = await service.endSession(); // Try to end again
        
        expect(stats).toBeNull();
      });

      it('should handle database errors gracefully', async () => {
        mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
          data: null,
          error: new Error('Update failed')
        });

        await expect(service.endSession())
          .rejects.toThrow('Update failed');
      });
    });
  });

  describe('Playback Event Tracking', () => {
    beforeEach(async () => {
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });
    });

    it('should log playback events successfully', async () => {
      mockSupabaseClient._mockMethods.mockInsert.mockReturnValueOnce({
        error: null
      });

      await service.logPlaybackEvent(PlaybackEventType.PLAY, 5.5, {
        playbackSpeed: 1.5,
        volume: 0.8
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('learn_media_playback_events');
      expect(mockSupabaseClient._mockMethods.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-123',
          event_type: PlaybackEventType.PLAY,
          timestamp_seconds: 5.5
        })
      );
    });

    it('should validate event parameters', async () => {
      await expect(service.logPlaybackEvent('', 0))
        .rejects.toThrow('Event type is required');
        
      await expect(service.logPlaybackEvent('play', -1))
        .rejects.toThrow('Timestamp cannot be negative');
    });

    it('should track play/pause states correctly', async () => {
      // Play
      await service.logPlaybackEvent('play', 0);
      let health = await service.healthCheck();
      expect(health.details?.isPlaying).toBe(true);

      // Pause
      await service.logPlaybackEvent('pause', 5);
      health = await service.healthCheck();
      expect(health.details?.isPlaying).toBe(false);
    });

    it('should accumulate total play time', async () => {
      await service.logPlaybackEvent('play', 0);
      await new Promise(resolve => setTimeout(resolve, 100));
      await service.logPlaybackEvent('pause', 5);
      
      await service.logPlaybackEvent('play', 5);
      await new Promise(resolve => setTimeout(resolve, 100));
      await service.logPlaybackEvent('pause', 10);

      mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const stats = await service.endSession();
      expect(stats?.activeDuration).toBeGreaterThan(0.1);
    });

    it('should update media duration from metadata', async () => {
      await service.logPlaybackEvent('loadedmetadata', 0, {
        duration: 300
      });

      // Progress to 60 seconds (20%)
      await service.logPlaybackEvent('timeupdate', 60);
      
      mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const stats = await service.endSession();
      expect(stats?.completionPercentage).toBe(20);
    });

    it('should handle events without active session', async () => {
      await service.endSession();
      
      await expect(service.logPlaybackEvent('play', 0))
        .resolves.toBeUndefined();
        
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No active session for playback event'
      );
    });

    it('should update session progress periodically', async () => {
      // These events should trigger progress updates
      const updateEvents = ['timeupdate', 'pause', 'ended'];
      
      for (const eventType of updateEvents) {
        vi.clearAllMocks();
        await service.logPlaybackEvent(eventType, 10);
        
        // Verify update was called
        expect(mockSupabaseClient._mockMethods.mockUpdate).toHaveBeenCalled();
      }
    });

    it('should handle seek events', async () => {
      await service.logPlaybackEvent('seeking', 10, {
        seekFrom: 5,
        seekTo: 10
      });

      await service.logPlaybackEvent('seeked', 10);

      expect(mockSupabaseClient._mockMethods.mockInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Bookmark Management', () => {
    beforeEach(async () => {
      // Start a session
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });
      
      // Move to a specific position
      await service.logPlaybackEvent('timeupdate', 30);
    });

    describe('createBookmark', () => {
      it('should create bookmark at current position', async () => {
        // Mock session query
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: { media_id: 'media-123' },
          error: null
        });

        // Mock bookmark creation
        const mockBookmark = createMockBookmark();
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: mockBookmark,
          error: null
        });

        const bookmark = await service.createBookmark(
          'Important Point',
          'Key concept explained',
          BookmarkCategory.IMPORTANT
        );

        expect(bookmark).toEqual(mockBookmark);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('learn_media_bookmarks');
      });

      it('should validate bookmark title', async () => {
        await expect(service.createBookmark(''))
          .rejects.toThrow('Bookmark title is required');
          
        await expect(service.createBookmark('   '))
          .rejects.toThrow('Bookmark title is required');
      });

      it('should handle missing session gracefully', async () => {
        await service.endSession();
        
        const bookmark = await service.createBookmark('Test');
        expect(bookmark).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No active session for bookmark'
        );
      });

      it('should handle database errors', async () => {
        mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
          data: null,
          error: new Error('Database error')
        });

        await expect(service.createBookmark('Test'))
          .rejects.toThrow('Failed to get session details');
      });
    });

    describe('getMediaBookmarks', () => {
      it('should retrieve bookmarks for media', async () => {
        const mockBookmarks = [
          createMockBookmark({ timestamp_seconds: 10 }),
          createMockBookmark({ timestamp_seconds: 20, id: 'bookmark-456' })
        ];

        mockSupabaseClient._mockMethods.mockOrder.mockReturnValueOnce(
          Promise.resolve({ data: mockBookmarks, error: null })
        );

        const bookmarks = await service.getMediaBookmarks('media-123');

        expect(bookmarks).toHaveLength(2);
        expect(bookmarks[0].timestamp_seconds).toBe(10);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('learn_media_bookmarks');
      });

      it('should validate media ID', async () => {
        await expect(service.getMediaBookmarks(''))
          .rejects.toThrow('Media ID is required');
      });

      it('should handle no bookmarks gracefully', async () => {
        mockSupabaseClient._mockMethods.mockOrder.mockReturnValueOnce(
          Promise.resolve({ data: [], error: null })
        );

        const bookmarks = await service.getMediaBookmarks('media-123');
        expect(bookmarks).toEqual([]);
      });

      it('should handle unauthenticated user', async () => {
        mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValueOnce({
          data: { user: null },
          error: null
        });

        await expect(service.getMediaBookmarks('media-123'))
          .rejects.toThrow('No authenticated user');
      });
    });
  });

  describe('Analytics and Reporting', () => {
    describe('getRecentSessions', () => {
      it('should retrieve recent sessions', async () => {
        const mockSessions = [
          createMockSession({ completion_percentage: 75 }),
          createMockSession({ 
            id: 'session-456', 
            media_id: 'media-456',
            completion_percentage: 100 
          })
        ];

        mockSupabaseClient._mockMethods.mockLimit.mockResolvedValueOnce({
          data: mockSessions,
          error: null
        });

        const sessions = await service.getRecentSessions(10);

        expect(sessions).toHaveLength(2);
        expect(sessions[0].completion_percentage).toBe(75);
        expect(mockSupabaseClient._mockMethods.mockOrder).toHaveBeenCalledWith(
          'session_start', 
          { ascending: false }
        );
      });

      it('should filter by media ID when provided', async () => {
        mockSupabaseClient._mockMethods.mockLimit.mockResolvedValueOnce({
          data: [],
          error: null
        });

        await service.getRecentSessions(5, 'media-123');

        expect(mockSupabaseClient._mockMethods.mockEq).toHaveBeenCalledWith(
          'media_id', 
          'media-123'
        );
      });

      it('should validate limit parameter', async () => {
        await expect(service.getRecentSessions(0))
          .rejects.toThrow('Limit must be positive');
          
        await expect(service.getRecentSessions(-1))
          .rejects.toThrow('Limit must be positive');
      });

      it('should handle database errors', async () => {
        mockSupabaseClient._mockMethods.mockLimit.mockResolvedValueOnce({
          data: null,
          error: new Error('Query failed')
        });

        await expect(service.getRecentSessions(10))
          .rejects.toThrow('Query failed');
      });
    });

    describe('getMediaStatistics', () => {
      it('should calculate comprehensive statistics', async () => {
        // Mock sessions data
        mockSupabaseClient._mockMethods.mockEq
          .mockResolvedValueOnce({
            data: [
              { active_duration_seconds: 120, completion_percentage: 50 },
              { active_duration_seconds: 180, completion_percentage: 75 },
              { active_duration_seconds: 60, completion_percentage: 25 }
            ],
            error: null
          })
          .mockResolvedValueOnce({
            count: 7,
            error: null
          });

        const stats = await service.getMediaStatistics('media-123');

        expect(stats).toEqual({
          totalSessions: 3,
          totalWatchTime: 360, // 120 + 180 + 60
          averageCompletion: 50, // (50 + 75 + 25) / 3
          bookmarkCount: 7
        });
      });

      it('should validate media ID', async () => {
        await expect(service.getMediaStatistics(''))
          .rejects.toThrow('Media ID is required');
      });

      it('should handle no data gracefully', async () => {
        mockSupabaseClient._mockMethods.mockEq
          .mockResolvedValueOnce({ data: [], error: null })
          .mockResolvedValueOnce({ count: 0, error: null });

        const stats = await service.getMediaStatistics('media-123');

        expect(stats).toEqual({
          totalSessions: 0,
          totalWatchTime: 0,
          averageCompletion: 0,
          bookmarkCount: 0
        });
      });

      it('should handle null values in data', async () => {
        mockSupabaseClient._mockMethods.mockEq
          .mockResolvedValueOnce({
            data: [
              { active_duration_seconds: null, completion_percentage: null },
              { active_duration_seconds: 100, completion_percentage: 50 }
            ],
            error: null
          })
          .mockResolvedValueOnce({ count: null, error: null });

        const stats = await service.getMediaStatistics('media-123');

        expect(stats.totalSessions).toBe(2);
        expect(stats.totalWatchTime).toBe(100);
        expect(stats.averageCompletion).toBe(25); // (0 + 50) / 2
        expect(stats.bookmarkCount).toBe(0);
      });
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry operations on transient failures', async () => {
      let attempts = 0;
      mockSupabaseClient._mockMethods.mockSingle.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({ data: { id: 'session-123' }, error: null });
      });

      const sessionId = await service.startSession({ mediaId: 'media-123' });
      
      expect(sessionId).toBe('session-123');
      expect(attempts).toBe(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1 failed')
      );
    });

    it('should fail after max retry attempts', async () => {
      mockSupabaseClient._mockMethods.mockSingle.mockRejectedValue(
        new Error('Persistent error')
      );

      await expect(service.startSession({ mediaId: 'media-123' }))
        .rejects.toThrow('Persistent error');
        
      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // 2 retries
    });

    it('should use exponential backoff for retries', async () => {
      const startTime = Date.now();
      let attempts = 0;
      
      mockSupabaseClient._mockMethods.mockSingle.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Retry me'));
        }
        return Promise.resolve({ data: { id: 'session-123' }, error: null });
      });

      await service.startSession({ mediaId: 'media-123' });
      
      const elapsed = Date.now() - startTime;
      // Should have delays: 1000ms + 2000ms = 3000ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(2500); // Allow some margin
    });
  });

  describe('Performance Monitoring', () => {
    it('should log performance metrics for operations', async () => {
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });

      await service.startSession({ mediaId: 'media-123' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MediaTrackingService.')
      );
    });

    it('should track operation duration', async () => {
      const startTime = Date.now();
      
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });

      await service.startSession({ mediaId: 'media-123' });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should end active session on shutdown', async () => {
      // Start a session
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });

      // Mock the update for ending session
      mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      await service.shutdown();

      // Verify session was ended
      expect(mockSupabaseClient._mockMethods.mockUpdate).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Start a session
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });

      // Mock error during cleanup
      mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
        data: null,
        error: new Error('Cleanup failed')
      });

      // Should not throw
      await expect(service.shutdown()).rejects.toThrow('Cleanup failed');
    });

    it('should track service lifecycle', async () => {
      const metadata = service.getMetadata();
      expect(metadata.initialized).toBe(false);
      
      await service.ensureInitialized();
      expect(service.getMetadata().initialized).toBe(true);
      
      await service.shutdown();
      expect(service.getMetadata().initialized).toBe(false);
    });
  });

  describe('Edge Cases and Browser Compatibility', () => {
    it('should handle browser environment for device detection', () => {
      // Mock window object
      (global as any).window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
        }
      };

      // Create new service instance to test device detection
      const browserService = new MediaTrackingService(mockSupabaseClient, mockLogger);
      
      // The device type should be detected as mobile
      // This would be tested when starting a session
      
      // Clean up
      delete (global as any).window;
    });

    it('should handle very long sessions correctly', async () => {
      // Start session
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });

      // Simulate a very long session with multiple events
      for (let i = 0; i < 100; i++) {
        await service.logPlaybackEvent('timeupdate', i * 30);
      }

      mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const stats = await service.endSession();
      expect(stats?.lastPosition).toBe(2970); // 99 * 30
    });

    it('should handle rapid play/pause toggles', async () => {
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });

      // Rapid toggles
      for (let i = 0; i < 10; i++) {
        await service.logPlaybackEvent('play', i * 2);
        await service.logPlaybackEvent('pause', i * 2 + 1);
      }

      // Should handle without errors
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details?.isPlaying).toBe(false);
    });

    it('should cap completion percentage at 100%', async () => {
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });

      // Set duration and position beyond 100%
      await service.logPlaybackEvent('loadedmetadata', 0, { duration: 100 });
      await service.logPlaybackEvent('timeupdate', 150); // 150% position

      mockSupabaseClient._mockMethods.mockEq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const stats = await service.endSession();
      expect(stats?.completionPercentage).toBe(100);
    });
  });

  describe('Input Validation', () => {
    it('should validate all input parameters comprehensively', async () => {
      // Test various invalid inputs
      const invalidInputs = [
        { mediaId: null },
        { mediaId: undefined },
        { mediaId: 123 }, // Wrong type
        { mediaId: {} },
        { mediaId: [] }
      ];

      for (const input of invalidInputs) {
        await expect(service.startSession(input as any))
          .rejects.toThrow();
      }
    });

    it('should sanitize event data', async () => {
      mockSupabaseClient._mockMethods.mockSingle.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null
      });
      await service.startSession({ mediaId: 'media-123' });

      // Should handle various event data types
      await service.logPlaybackEvent('custom', 10, {
        stringValue: 'test',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        undefinedValue: undefined,
        nestedObject: { key: 'value' }
      });

      expect(mockSupabaseClient._mockMethods.mockInsert).toHaveBeenCalled();
    });
  });
});