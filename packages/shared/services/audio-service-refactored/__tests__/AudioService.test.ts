import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioService, AudioFile, AudioFileOptions, TranscriptData } from '../AudioService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';

// Mock Supabase client factory
const createMockSupabase = () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockOr = vi.fn();
  const mockIs = vi.fn();
  const mockIn = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockRange = vi.fn();
  const mockLimit = vi.fn();
  const mockSingle = vi.fn();

  // Chain-able API mock
  const queryBuilder = {
    select: mockSelect.mockReturnThis(),
    or: mockOr.mockReturnThis(),
    is: mockIs.mockReturnThis(),
    in: mockIn.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    range: mockRange.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    single: mockSingle.mockReturnThis()
  };

  // Reset all methods to return queryBuilder
  Object.keys(queryBuilder).forEach(key => {
    queryBuilder[key as keyof typeof queryBuilder].mockReturnValue(queryBuilder);
  });

  mockFrom.mockReturnValue(queryBuilder);

  return {
    from: mockFrom,
    queryBuilder,
    mocks: {
      mockFrom,
      mockSelect,
      mockOr,
      mockIs,
      mockIn,
      mockEq,
      mockOrder,
      mockRange,
      mockLimit,
      mockSingle
    }
  } as any;
};

// Mock data fixtures
const createMockAudioFile = (overrides?: Partial<AudioFile>): AudioFile => ({
  id: 'test-audio-id',
  name: 'test-audio.m4a',
  web_view_link: 'https://drive.google.com/file/test',
  drive_id: 'drive-123',
  mime_type: 'audio/x-m4a',
  path: '/audio/test-audio.m4a',
  metadata: { duration: 300, bitrate: 128 },
  google_sources_experts: [{
    expert_id: 'expert-123',
    experts: {
      expert_name: 'john_doe',
      full_name: 'John Doe'
    }
  }],
  ...overrides
});

const createMockTranscript = (): TranscriptData => ({
  id: 'transcript-123',
  raw_content: 'This is the transcript content',
  processed_content: { text: 'Processed transcript', metadata: {} },
  source_id: 'test-audio-id'
});

describe('AudioService', () => {
  let service: AudioService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    
    // Spy on setInterval to prevent actual timers
    vi.spyOn(global, 'setInterval').mockImplementation(() => 1 as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should create service instance with required dependencies', () => {
      service = new AudioService(mockSupabase as any);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AudioService);
    });

    it('should throw error when supabase client is missing', () => {
      expect(() => new AudioService(null as any)).toThrowError('Supabase client is required');
    });

    it('should initialize with cache cleanup interval', async () => {
      service = new AudioService(mockSupabase as any);
      await service['ensureInitialized']();
      
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // 1 minute cleanup interval
      );
    });
  });

  describe('getAudioFiles', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should fetch audio files with default options', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockFiles, error: null });
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      const result = await service.getAudioFiles();

      expect(mockSupabase.from).toHaveBeenCalledWith('google_sources');
      expect(mockSupabase.mocks.mockSelect).toHaveBeenCalledWith(expect.stringContaining('id'));
      expect(mockSupabase.mocks.mockOr).toHaveBeenCalled();
      expect(mockSupabase.mocks.mockIs).toHaveBeenCalledWith('is_deleted', false);
      expect(mockSupabase.mocks.mockOrder).toHaveBeenCalledWith('name', { ascending: true });
      expect(mockSupabase.mocks.mockRange).toHaveBeenCalledWith(0, 99);
      expect(result).toEqual(mockFiles);
    });

    it('should handle custom options', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      const options: AudioFileOptions = {
        limit: 50,
        offset: 100,
        includeExperts: false,
        mimeTypes: ['audio/mp3', 'audio/wav']
      };

      await service.getAudioFiles(options);

      expect(mockSupabase.mocks.mockRange).toHaveBeenCalledWith(100, 149);
      expect(mockSupabase.mocks.mockSelect).toHaveBeenCalledWith(expect.not.stringContaining('google_sources_experts'));
    });

    it('should use cache for repeated queries', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      // First call - should hit database
      const result1 = await service.getAudioFiles();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await service.getAudioFiles();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // No additional calls
      expect(result2).toEqual(result1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: null, error });

      await expect(service.getAudioFiles()).rejects.toThrowError('Failed to fetch audio files: Database connection failed');
    });
  });

  describe('getAudioFile', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should fetch single audio file by ID', async () => {
      const mockFile = createMockAudioFile();
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockFile, error: null });

      const result = await service.getAudioFile('test-audio-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('google_sources');
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('id', 'test-audio-id');
      expect(mockSupabase.mocks.mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockFile);
    });

    it('should return null when file not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116', message: 'Not found' } 
      });

      const result = await service.getAudioFile('non-existent-id');
      expect(result).toBeNull();
    });

    it('should validate input ID format', async () => {
      await expect(service.getAudioFile('')).rejects.toThrowError();
      await expect(service.getAudioFile('invalid id with spaces')).rejects.toThrowError();
    });

    it('should use cache for repeated lookups', async () => {
      const mockFile = createMockAudioFile();
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockFile, error: null });

      const result1 = await service.getAudioFile('test-audio-id');
      const result2 = await service.getAudioFile('test-audio-id');

      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(result2).toEqual(result1);
    });
  });

  describe('getTranscript', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should fetch transcript by source ID', async () => {
      const mockTranscript = createMockTranscript();
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockTranscript, error: null });

      const result = await service.getTranscript('test-audio-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('google_expert_documents');
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('source_id', 'test-audio-id');
      expect(result).toBe(mockTranscript.raw_content);
    });

    it('should fall back to processed_content when raw_content is null', async () => {
      const mockTranscript = {
        ...createMockTranscript(),
        raw_content: null,
        processed_content: 'Processed transcript text'
      };
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockTranscript, error: null });

      const result = await service.getTranscript('test-audio-id');
      expect(result).toBe('Processed transcript text');
    });

    it('should stringify object processed_content', async () => {
      const mockTranscript = {
        ...createMockTranscript(),
        raw_content: null,
        processed_content: { text: 'Processed', metadata: { duration: 300 } }
      };
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockTranscript, error: null });

      const result = await service.getTranscript('test-audio-id');
      expect(result).toBe(JSON.stringify(mockTranscript.processed_content, null, 2));
    });

    it('should return null when transcript not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116', message: 'Not found' } 
      });

      const result = await service.getTranscript('non-existent-id');
      expect(result).toBeNull();
    });

    it('should cache transcript results', async () => {
      const mockTranscript = createMockTranscript();
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: mockTranscript, error: null });

      await service.getTranscript('test-audio-id');
      await service.getTranscript('test-audio-id');

      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchAudioFiles', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should search audio files by name', async () => {
      const mockFiles = [createMockAudioFile({ name: 'matching-audio.m4a' })];
      mockSupabase.queryBuilder.limit.mockResolvedValue({ data: mockFiles, error: null });

      const result = await service.searchAudioFiles('matching');

      expect(mockSupabase.mocks.mockOr).toHaveBeenCalledWith(
        expect.stringContaining('name.ilike.%matching%')
      );
      expect(mockSupabase.mocks.mockIn).toHaveBeenCalledWith('mime_type', expect.arrayContaining(['audio/x-m4a']));
      expect(result).toEqual(mockFiles);
    });

    it('should handle search errors', async () => {
      const error = new Error('Search failed');
      mockSupabase.queryBuilder.limit.mockResolvedValue({ data: null, error });

      await expect(service.searchAudioFiles('test')).rejects.toThrowError('Failed to search audio files: Search failed');
    });
  });

  describe('getAudioFilesByExpert', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should fetch audio files for specific expert', async () => {
      const mockData = [{
        google_sources: createMockAudioFile()
      }];
      mockSupabase.queryBuilder.limit.mockResolvedValue({ data: mockData, error: null });

      const result = await service.getAudioFilesByExpert('expert-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('google_sources_experts');
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('expert_id', 'expert-123');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockData[0].google_sources);
    });

    it('should filter out non-audio files', async () => {
      const mockData = [
        { google_sources: createMockAudioFile() },
        { google_sources: { ...createMockAudioFile(), mime_type: 'application/pdf' } }
      ];
      mockSupabase.queryBuilder.limit.mockResolvedValue({ data: mockData, error: null });

      const result = await service.getAudioFilesByExpert('expert-123');
      expect(result).toHaveLength(1); // Only audio file
    });
  });

  describe('metrics', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should track query metrics', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      await service.getAudioFiles();
      const metrics = service.getMetrics();

      expect(metrics.totalQueries).toBe(1);
      expect(metrics.successfulQueries).toBe(1);
      expect(metrics.failedQueries).toBe(0);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.averageQueryTime).toBeGreaterThan(0);
    });

    it('should track cache hits', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      await service.getAudioFiles();
      await service.getAudioFiles(); // Cache hit
      
      const metrics = service.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
    });

    it('should track failed queries', async () => {
      const error = new Error('Query failed');
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: null, error });

      try {
        await service.getAudioFiles();
      } catch (e) {
        // Expected error
      }

      const metrics = service.getMetrics();
      expect(metrics.failedQueries).toBe(1);
      expect(metrics.successfulQueries).toBe(0);
    });

    it('should reset metrics', () => {
      service.resetMetrics();
      const metrics = service.getMetrics();
      
      expect(metrics.totalQueries).toBe(0);
      expect(metrics.successfulQueries).toBe(0);
      expect(metrics.failedQueries).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.averageQueryTime).toBe(0);
    });
  });

  describe('cache management', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should clear cache on demand', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      await service.getAudioFiles();
      service.clearCache();
      await service.getAudioFiles();

      expect(mockSupabase.from).toHaveBeenCalledTimes(2); // Both calls hit database
    });

    it('should automatically clean expired cache entries', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      // Add entry to cache
      await service.getAudioFiles();
      
      // Mock cache entry as expired
      const cache = service['queryCache'];
      const entry = cache.get('audio-files-{}');
      if (entry) {
        entry.timestamp = Date.now() - 400000; // 6+ minutes old
      }

      // Trigger cleanup
      service['cleanupCache']();

      // Cache should be empty
      expect(cache.size).toBe(0);
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should report healthy status when all components work', async () => {
      mockSupabase.queryBuilder.limit.mockResolvedValue({ data: [], error: null });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.initialized).toBe(true);
      expect(health.details.databaseConnection).toBe(true);
      expect(health.details.cacheSize).toBe(0);
      expect(health.details.metrics).toBeDefined();
    });

    it('should report unhealthy when database connection fails', async () => {
      const error = new Error('Connection failed');
      mockSupabase.queryBuilder.limit.mockResolvedValue({ data: null, error });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details.databaseConnection).toBe(false);
    });

    it('should handle health check exceptions', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Catastrophic failure');
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should clear cache on shutdown', async () => {
      const mockFiles = [createMockAudioFile()];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: mockFiles, error: null });

      await service.getAudioFiles();
      expect(service['queryCache'].size).toBeGreaterThan(0);

      await service['shutdown']();
      expect(service['queryCache'].size).toBe(0);
    });
  });

  describe('error handling edge cases', () => {
    beforeEach(() => {
      service = new AudioService(mockSupabase as any);
    });

    it('should handle malformed audio file data', async () => {
      const malformedData = [
        { id: 'test', name: null }, // Missing required fields
        null, // Null entry
        createMockAudioFile()
      ];
      mockSupabase.queryBuilder.range.mockResolvedValue({ data: malformedData, error: null });

      const result = await service.getAudioFiles();
      expect(result).toHaveLength(3); // Should not crash, returns all data
    });

    it('should handle network timeouts gracefully', async () => {
      mockSupabase.queryBuilder.range.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100))
      );

      await expect(service.getAudioFiles()).rejects.toThrowError('Failed to fetch audio files: Network timeout');
    });
  });
});