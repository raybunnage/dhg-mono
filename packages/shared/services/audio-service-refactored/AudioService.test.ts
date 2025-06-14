import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioService } from './AudioService';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabase = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis()
});

describe('AudioService', () => {
  let service: AudioService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new AudioService(mockSupabase as SupabaseClient<any>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with supabase client', async () => {
      await service.ensureInitialized();
      expect(service.isInitialized()).toBe(true);
    });

    it('should throw error if supabase client not provided', () => {
      expect(() => new AudioService(null as any)).toThrow('Supabase client is required');
    });
  });

  describe('getAudioFiles', () => {
    it('should fetch audio files with default options', async () => {
      const mockData = [
        {
          id: '1',
          name: 'audio1.m4a',
          drive_id: 'drive1',
          mime_type: 'audio/x-m4a',
          path: '/audio/audio1.m4a'
        }
      ];
      
      mockSupabase.limit.mockResolvedValue({ data: mockData, error: null });
      
      await service.ensureInitialized();
      const result = await service.getAudioFiles();
      
      expect(result).toEqual(mockData);
      expect(mockSupabase.from).toHaveBeenCalledWith('google_sources');
      expect(mockSupabase.is).toHaveBeenCalledWith('is_deleted', false);
      expect(mockSupabase.order).toHaveBeenCalledWith('name', { ascending: true });
    });

    it('should use custom options', async () => {
      mockSupabase.range.mockReturnThis();
      mockSupabase.range.mockResolvedValue({ data: [], error: null });
      
      await service.ensureInitialized();
      await service.getAudioFiles({ 
        limit: 50, 
        offset: 10,
        includeExperts: false,
        mimeTypes: ['audio/mp3']
      });
      
      expect(mockSupabase.or).toHaveBeenCalledWith('mime_type.eq.audio/mp3');
      expect(mockSupabase.range).toHaveBeenCalledWith(10, 59);
    });

    it('should cache results', async () => {
      const mockData = [{ id: '1', name: 'cached.m4a' }];
      mockSupabase.limit.mockResolvedValue({ data: mockData, error: null });
      
      await service.ensureInitialized();
      
      // First call
      await service.getAudioFiles();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      await service.getAudioFiles();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      
      const metrics = service.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockSupabase.limit.mockResolvedValue({ data: null, error });
      
      await service.ensureInitialized();
      
      await expect(service.getAudioFiles()).rejects.toThrow('Failed to fetch audio files');
      
      const metrics = service.getMetrics();
      expect(metrics.failedQueries).toBe(1);
    });
  });

  describe('getAudioFile', () => {
    it('should fetch single audio file by ID', async () => {
      const mockFile = {
        id: 'file123',
        name: 'test.m4a',
        drive_id: 'drive123'
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockFile, error: null });
      
      await service.ensureInitialized();
      const result = await service.getAudioFile('file123');
      
      expect(result).toEqual(mockFile);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'file123');
      expect(mockSupabase.single).toHaveBeenCalled();
    });

    it('should return null for non-existent file', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116', message: 'Not found' } 
      });
      
      await service.ensureInitialized();
      const result = await service.getAudioFile('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should validate input', async () => {
      await service.ensureInitialized();
      
      await expect(service.getAudioFile('')).rejects.toThrow();
      await expect(service.getAudioFile(null as any)).rejects.toThrow();
    });

    it('should cache individual files', async () => {
      const mockFile = { id: '1', name: 'cached.m4a' };
      mockSupabase.single.mockResolvedValue({ data: mockFile, error: null });
      
      await service.ensureInitialized();
      
      await service.getAudioFile('1');
      await service.getAudioFile('1');
      
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTranscript', () => {
    it('should fetch transcript from raw_content', async () => {
      const mockTranscript = {
        id: 'trans1',
        raw_content: 'This is the transcript',
        processed_content: null,
        source_id: 'source1'
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockTranscript, error: null });
      
      await service.ensureInitialized();
      const result = await service.getTranscript('source1');
      
      expect(result).toBe('This is the transcript');
      expect(mockSupabase.from).toHaveBeenCalledWith('google_expert_documents');
      expect(mockSupabase.eq).toHaveBeenCalledWith('source_id', 'source1');
    });

    it('should fallback to processed_content if raw_content not available', async () => {
      const mockTranscript = {
        id: 'trans1',
        raw_content: null,
        processed_content: 'Processed transcript',
        source_id: 'source1'
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockTranscript, error: null });
      
      await service.ensureInitialized();
      const result = await service.getTranscript('source1');
      
      expect(result).toBe('Processed transcript');
    });

    it('should stringify object processed_content', async () => {
      const mockTranscript = {
        id: 'trans1',
        raw_content: null,
        processed_content: { text: 'Transcript', confidence: 0.95 },
        source_id: 'source1'
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockTranscript, error: null });
      
      await service.ensureInitialized();
      const result = await service.getTranscript('source1');
      
      expect(result).toContain('"text": "Transcript"');
      expect(result).toContain('"confidence": 0.95');
    });

    it('should return null if transcript not found', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });
      
      await service.ensureInitialized();
      const result = await service.getTranscript('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('searchAudioFiles', () => {
    it('should search audio files by name', async () => {
      const mockResults = [
        { id: '1', name: 'interview.m4a' },
        { id: '2', name: 'interview2.mp3' }
      ];
      
      mockSupabase.limit.mockResolvedValue({ data: mockResults, error: null });
      
      await service.ensureInitialized();
      const results = await service.searchAudioFiles('interview');
      
      expect(results).toEqual(mockResults);
      expect(mockSupabase.or).toHaveBeenCalledWith(
        'name.ilike.%interview%,path.ilike.%interview%'
      );
    });

    it('should handle search errors', async () => {
      mockSupabase.limit.mockResolvedValue({ 
        data: null, 
        error: new Error('Search failed') 
      });
      
      await service.ensureInitialized();
      
      await expect(service.searchAudioFiles('test'))
        .rejects.toThrow('Failed to search audio files');
    });
  });

  describe('getAudioFilesByExpert', () => {
    it('should fetch audio files for specific expert', async () => {
      const mockData = [
        {
          google_sources: {
            id: '1',
            name: 'expert-audio.m4a',
            mime_type: 'audio/x-m4a'
          }
        }
      ];
      
      mockSupabase.limit.mockResolvedValue({ data: mockData, error: null });
      
      await service.ensureInitialized();
      const results = await service.getAudioFilesByExpert('expert123');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('expert-audio.m4a');
      expect(mockSupabase.from).toHaveBeenCalledWith('google_sources_experts');
      expect(mockSupabase.eq).toHaveBeenCalledWith('expert_id', 'expert123');
    });

    it('should filter out non-audio files', async () => {
      const mockData = [
        {
          google_sources: {
            id: '1',
            name: 'audio.m4a',
            mime_type: 'audio/x-m4a'
          }
        },
        {
          google_sources: {
            id: '2',
            name: 'document.pdf',
            mime_type: 'application/pdf'
          }
        }
      ];
      
      mockSupabase.limit.mockResolvedValue({ data: mockData, error: null });
      
      await service.ensureInitialized();
      const results = await service.getAudioFilesByExpert('expert123');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('audio.m4a');
    });
  });

  describe('Metrics', () => {
    it('should track query metrics', async () => {
      mockSupabase.limit.mockResolvedValue({ data: [], error: null });
      mockSupabase.single
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('Failed') });
      
      await service.ensureInitialized();
      
      await service.getAudioFiles();
      await service.getAudioFile('1');
      await service.getAudioFile('2').catch(() => {});
      
      const metrics = service.getMetrics();
      
      expect(metrics.totalQueries).toBe(3);
      expect(metrics.successfulQueries).toBe(2);
      expect(metrics.failedQueries).toBe(1);
      expect(metrics.averageQueryTime).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      mockSupabase.limit.mockResolvedValue({ data: [], error: null });
      
      await service.ensureInitialized();
      await service.getAudioFiles();
      
      service.resetMetrics();
      const metrics = service.getMetrics();
      
      expect(metrics.totalQueries).toBe(0);
      expect(metrics.successfulQueries).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      mockSupabase.limit.mockResolvedValue({ data: [{ id: '1' }], error: null });
      
      await service.ensureInitialized();
      
      // Populate cache
      await service.getAudioFiles();
      
      // Clear cache
      service.clearCache();
      
      // Next call should hit database
      await service.getAudioFiles();
      
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should cleanup expired cache entries', async () => {
      await service.ensureInitialized();
      
      // Add cache entries manually
      service['queryCache'].set('old', {
        data: [],
        timestamp: Date.now() - 400000 // Older than 5 minutes
      });
      
      service['queryCache'].set('new', {
        data: [],
        timestamp: Date.now()
      });
      
      // Run cleanup
      service['cleanupCache']();
      
      expect(service['queryCache'].has('old')).toBe(false);
      expect(service['queryCache'].has('new')).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      mockSupabase.limit.mockResolvedValue({ data: [], error: null });
      
      await service.ensureInitialized();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.initialized).toBe(true);
      expect(health.details.databaseConnection).toBe(true);
    });

    it('should report unhealthy on database error', async () => {
      mockSupabase.limit.mockResolvedValue({ 
        data: null, 
        error: new Error('Connection failed') 
      });
      
      await service.ensureInitialized();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.databaseConnection).toBe(false);
    });
  });

  describe('Business Service Features', () => {
    it('should use withRetry for resilience', async () => {
      // Test that service inherits BusinessService retry capabilities
      expect(typeof service['withRetry']).toBe('function');
    });

    it('should validate inputs', async () => {
      // Test that service can validate inputs
      expect(typeof service['validateInput']).toBe('function');
    });
  });
});