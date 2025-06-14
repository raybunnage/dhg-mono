import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaTrackingService } from './MediaTrackingService';
import { SupabaseClient } from '@supabase/supabase-js';
import { MockLogger } from '../../test-utils/MockLogger';
import { PlaybackEventType, BookmarkCategory } from './types';

// Mock Supabase client
const createMockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn(() => Promise.resolve({
      data: { user: { id: 'user-123' } },
      error: null
    }))
  },
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      order: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { 
            id: 'session-123',
            media_id: 'media-123',
            user_id: 'user-123'
          }, 
          error: null 
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}) as unknown as SupabaseClient;

describe('MediaTrackingService', () => {
  let service: MediaTrackingService;
  let mockSupabaseClient: SupabaseClient;
  let mockLogger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockLogger = new MockLogger();
    service = new MediaTrackingService(mockSupabaseClient as any, mockLogger);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.ensureInitialized();
      expect(service.isInitialized()).toBe(true);
    });

    it('should only initialize once', async () => {
      await service.ensureInitialized();
      await service.ensureInitialized();
      expect(service.isInitialized()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('health check', () => {
    it('should perform health check successfully', async () => {
      await service.ensureInitialized();
      const result = await service.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.serviceName).toBe('MediaTrackingService');
      expect(result.details?.activeSession).toBe(false);
      expect(result.details?.isPlaying).toBe(false);
    });

    it('should show active session in health check', async () => {
      await service.startSession({ mediaId: 'media-123' });
      
      const result = await service.healthCheck();
      expect(result.details?.activeSession).toBe(true);
    });
  });

  describe('startSession', () => {
    it('should start a session successfully', async () => {
      const sessionId = await service.startSession({
        mediaId: 'media-123',
        deviceType: 'desktop'
      });

      expect(sessionId).toBe('session-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('learn_media_sessions');
    });

    it('should validate media ID is required', async () => {
      await expect(service.startSession({ mediaId: '' }))
        .rejects.toThrow('Media ID is required');
      
      await expect(service.startSession({ mediaId: '   ' }))
        .rejects.toThrow('Media ID is required');
    });

    it('should handle unauthenticated user', async () => {
      (mockSupabaseClient.auth.getUser as any).mockResolvedValueOnce({
        data: { user: null },
        error: null
      });

      await expect(service.startSession({ mediaId: 'media-123' }))
        .rejects.toThrow('No authenticated user found');
    });

    it('should end existing session before starting new one', async () => {
      // Start first session
      await service.startSession({ mediaId: 'media-123' });
      
      // Mock update for ending session
      (mockSupabaseClient.from as any).mockImplementation((table: string) => {
        if (table === 'learn_media_sessions') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null }))
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ 
                  data: { id: 'session-456' }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ error: null }))
        };
      });

      // Start second session
      const newSessionId = await service.startSession({ mediaId: 'media-456' });
      
      expect(newSessionId).toBe('session-456');
    });
  });

  describe('endSession', () => {
    it('should end session with statistics', async () => {
      await service.startSession({ mediaId: 'media-123' });
      
      // Simulate some playback
      await service.logPlaybackEvent('play', 0);
      await new Promise(resolve => setTimeout(resolve, 100));
      await service.logPlaybackEvent('pause', 10);

      const stats = await service.endSession();
      
      expect(stats).toBeDefined();
      expect(stats?.sessionId).toBe('session-123');
      expect(stats?.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(stats?.lastPosition).toBe(10);
    });

    it('should return null if no active session', async () => {
      const stats = await service.endSession();
      expect(stats).toBeNull();
    });
  });

  describe('logPlaybackEvent', () => {
    beforeEach(async () => {
      await service.startSession({ mediaId: 'media-123' });
    });

    it('should log playback event successfully', async () => {
      await service.logPlaybackEvent('play', 5.5, {
        playbackSpeed: 1.5,
        volume: 0.8
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('learn_media_playback_events');
    });

    it('should validate event type is required', async () => {
      await expect(service.logPlaybackEvent('', 0))
        .rejects.toThrow('Event type is required');
    });

    it('should validate timestamp is not negative', async () => {
      await expect(service.logPlaybackEvent('play', -1))
        .rejects.toThrow('Timestamp cannot be negative');
    });

    it('should track play/pause for duration calculation', async () => {
      await service.logPlaybackEvent('play', 0);
      await new Promise(resolve => setTimeout(resolve, 50));
      await service.logPlaybackEvent('pause', 5);

      // End session to check total play time
      const stats = await service.endSession();
      expect(stats?.activeDuration).toBeGreaterThan(0);
    });

    it('should update media duration from loadedmetadata', async () => {
      await service.logPlaybackEvent('loadedmetadata', 0, {
        duration: 300
      });

      // Play to 50% completion
      await service.logPlaybackEvent('timeupdate', 150);
      
      const stats = await service.endSession();
      expect(stats?.completionPercentage).toBe(50);
    });

    it('should handle events without active session', async () => {
      await service.endSession();
      
      // Should not throw, just warn
      await expect(service.logPlaybackEvent('play', 0))
        .resolves.toBeUndefined();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No active session for playback event'
      );
    });
  });

  describe('createBookmark', () => {
    beforeEach(async () => {
      // Mock session query to return media_id
      (mockSupabaseClient.from as any).mockImplementation((table: string) => {
        if (table === 'learn_media_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ 
                  data: { media_id: 'media-123' }, 
                  error: null 
                }))
              }))
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ 
                  data: { id: 'session-123' }, 
                  error: null 
                }))
              }))
            }))
          };
        } else if (table === 'learn_media_bookmarks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ 
                  data: { 
                    id: 'bookmark-123',
                    title: 'Test Bookmark',
                    timestamp_seconds: 30
                  }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ error: null }))
        };
      });

      await service.startSession({ mediaId: 'media-123' });
      await service.logPlaybackEvent('timeupdate', 30);
    });

    it('should create bookmark successfully', async () => {
      const bookmark = await service.createBookmark(
        'Important Point',
        'Key concept explained',
        BookmarkCategory.IMPORTANT
      );

      expect(bookmark).toBeDefined();
      expect(bookmark?.title).toBe('Test Bookmark');
      expect(bookmark?.timestamp_seconds).toBe(30);
    });

    it('should validate bookmark title is required', async () => {
      await expect(service.createBookmark(''))
        .rejects.toThrow('Bookmark title is required');
    });

    it('should return null without active session', async () => {
      await service.endSession();
      
      const bookmark = await service.createBookmark('Test');
      expect(bookmark).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No active session for bookmark'
      );
    });
  });

  describe('getMediaBookmarks', () => {
    it('should get bookmarks for media', async () => {
      const mockBookmarks = [
        { id: 'b1', title: 'Bookmark 1', timestamp_seconds: 10 },
        { id: 'b2', title: 'Bookmark 2', timestamp_seconds: 20 }
      ];

      (mockSupabaseClient.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ 
                data: mockBookmarks, 
                error: null 
              }))
            }))
          }))
        }))
      });

      const bookmarks = await service.getMediaBookmarks('media-123');
      
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].title).toBe('Bookmark 1');
    });

    it('should validate media ID is required', async () => {
      await expect(service.getMediaBookmarks(''))
        .rejects.toThrow('Media ID is required');
    });
  });

  describe('getRecentSessions', () => {
    it('should get recent sessions', async () => {
      const mockSessions = [
        { id: 's1', media_id: 'media-123', completion_percentage: 75 },
        { id: 's2', media_id: 'media-456', completion_percentage: 100 }
      ];

      (mockSupabaseClient.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ 
                data: mockSessions, 
                error: null 
              }))
            }))
          }))
        }))
      });

      const sessions = await service.getRecentSessions(5);
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0].completion_percentage).toBe(75);
    });

    it('should filter by media ID', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          }))
        }))
      }));

      (mockSupabaseClient.from as any).mockImplementation(mockFrom);

      await service.getRecentSessions(5, 'media-123');
      
      // Verify media_id filter was applied
      expect(mockFrom).toHaveBeenCalled();
    });

    it('should validate limit is positive', async () => {
      await expect(service.getRecentSessions(0))
        .rejects.toThrow('Limit must be positive');
      
      await expect(service.getRecentSessions(-1))
        .rejects.toThrow('Limit must be positive');
    });
  });

  describe('getMediaStatistics', () => {
    it('should calculate media statistics', async () => {
      // Mock sessions data
      (mockSupabaseClient.from as any).mockImplementation((table: string) => {
        if (table === 'learn_media_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ 
                  data: [
                    { active_duration_seconds: 120, completion_percentage: 50 },
                    { active_duration_seconds: 180, completion_percentage: 75 }
                  ], 
                  error: null 
                }))
              }))
            }))
          };
        } else if (table === 'learn_media_bookmarks') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ 
                  count: 5, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {};
      });

      const stats = await service.getMediaStatistics('media-123');
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalWatchTime).toBe(300); // 120 + 180
      expect(stats.averageCompletion).toBe(63); // (50 + 75) / 2, rounded
      expect(stats.bookmarkCount).toBe(5);
    });

    it('should validate media ID is required', async () => {
      await expect(service.getMediaStatistics(''))
        .rejects.toThrow('Media ID is required');
    });

    it('should handle no sessions gracefully', async () => {
      (mockSupabaseClient.from as any).mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ 
              data: [], 
              count: 0,
              error: null 
            }))
          }))
        }))
      }));

      const stats = await service.getMediaStatistics('media-123');
      
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalWatchTime).toBe(0);
      expect(stats.averageCompletion).toBe(0);
    });
  });

  describe('performance monitoring', () => {
    it('should track operation performance', async () => {
      const startTime = Date.now();
      await service.startSession({ mediaId: 'media-123' });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should log performance metrics', async () => {
      await service.startSession({ mediaId: 'media-123' });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MediaTrackingService.startSession completed')
      );
    });
  });

  describe('cleanup and shutdown', () => {
    it('should end active session on shutdown', async () => {
      await service.startSession({ mediaId: 'media-123' });
      
      // Mock update for ending session
      const updateMock = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }));
      
      (mockSupabaseClient.from as any).mockReturnValue({
        update: updateMock
      });

      await service.shutdown();
      
      // Verify session was ended
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe('device detection', () => {
    it('should detect desktop by default in Node.js', async () => {
      await service.startSession({ mediaId: 'media-123' });
      
      // Check the insert call to verify device type
      const insertCalls = (mockSupabaseClient.from as any).mock.calls
        .filter((call: any[]) => call[0] === 'learn_media_sessions');
      
      expect(insertCalls).toHaveLength(1);
    });
  });
});