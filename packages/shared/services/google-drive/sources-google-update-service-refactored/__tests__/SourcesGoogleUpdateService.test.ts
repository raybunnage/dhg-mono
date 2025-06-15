import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourcesGoogleUpdateService } from '../SourcesGoogleUpdateService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../../utils/logger';
import { GoogleDriveService } from '../../google-drive-service';
import { 
  UpdateOptions, 
  BatchUpdateOptions,
  ConflictResolution
} from '../types';

// Define FieldUpdateStrategy for tests
const FieldUpdateStrategy = {
  OVERWRITE: 'overwrite' as const,
  MERGE: 'merge' as const,
  FILL_EMPTY: 'fillEmpty' as const
};

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    order: vi.fn().mockReturnThis()
  }));

  return {
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: {}, error: null })
  } as unknown as SupabaseClient;
};

// Mock logger
const createMockLogger = (): Logger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
} as any);

// Mock Google Drive service
const createMockGoogleDriveService = () => ({
  listFiles: vi.fn().mockResolvedValue({
    files: [],
    nextPageToken: null
  }),
  getFile: vi.fn().mockResolvedValue({
    id: 'file-123',
    name: 'test.pdf',
    mimeType: 'application/pdf',
    modifiedTime: new Date().toISOString()
  }),
  getFileMetadata: vi.fn().mockResolvedValue({
    id: 'file-123',
    name: 'test.pdf',
    size: '1000',
    modifiedTime: new Date().toISOString()
  })
} as unknown as GoogleDriveService);

describe('SourcesGoogleUpdateService', () => {
  let service: SourcesGoogleUpdateService;
  let mockSupabase: SupabaseClient;
  let mockLogger: Logger;
  let mockGoogleDriveService: GoogleDriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockLogger = createMockLogger();
    mockGoogleDriveService = createMockGoogleDriveService();
    
    service = new SourcesGoogleUpdateService(
      mockSupabase,
      mockGoogleDriveService,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      expect(service).toBeInstanceOf(SourcesGoogleUpdateService);
      expect(service['serviceName']).toBe('SourcesGoogleUpdateService');
    });

    it('should throw error when supabase client is not provided', () => {
      expect(() => new SourcesGoogleUpdateService(null as any, mockGoogleDriveService))
        .toThrow('Supabase client is required');
    });

    it('should throw error when google drive service is not provided', () => {
      expect(() => new SourcesGoogleUpdateService(mockSupabase, null as any))
        .toThrow('Google Drive service is required');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when all services are connected', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          error: null, 
          count: 100 
        })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.healthCheck();

      expect(result).toMatchObject({
        healthy: true,
        serviceName: 'SourcesGoogleUpdateService',
        timestamp: expect.any(Date),
        details: {
          queueSize: 0,
          isProcessing: false,
          totalRecords: 100,
          supabaseConnected: true,
          googleDriveConnected: true
        }
      });
    });

    it('should return unhealthy when database is not accessible', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          error: new Error('Database error'), 
          count: null 
        })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details.supabaseConnected).toBe(false);
    });

    it('should return unhealthy when Google Drive is not accessible', async () => {
      vi.mocked(mockGoogleDriveService.listFiles).mockRejectedValue(new Error('Auth failed'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details.googleDriveConnected).toBe(false);
    });
  });

  describe('updateSource', () => {
    it('should update a single source record', async () => {
      const fileId = 'file-123';
      const options: UpdateOptions = {
        fields: ['name', 'mimeType', 'modifiedTime'],
        skipIfUnchanged: true
      };

      // Mock existing record
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            google_id: fileId,
            name: 'old-name.pdf',
            mime_type: 'application/pdf',
            modified_time: '2024-01-01T00:00:00Z'
          },
          error: null
        }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      const result = await service.updateSource(fileId, options);

      expect(result.success).toBe(true);
      expect(result.fileId).toBe(fileId);
      expect(mockGoogleDriveService.getFileMetadata).toHaveBeenCalledWith(fileId);
    });

    it('should skip update when data is unchanged', async () => {
      const fileId = 'file-123';
      const existingData = {
        google_id: fileId,
        name: 'test.pdf',
        mime_type: 'application/pdf',
        modified_time: new Date().toISOString()
      };

      // Mock existing record with same data
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingData,
          error: null
        })
      }));
      mockSupabase.from = mockFrom;

      // Mock Google Drive to return same data
      vi.mocked(mockGoogleDriveService.getFileMetadata).mockResolvedValue({
        id: fileId,
        name: 'test.pdf',
        mimeType: 'application/pdf',
        modifiedTime: existingData.modified_time
      });

      const result = await service.updateSource(fileId, { skipIfUnchanged: true });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('No changes detected');
    });

    it('should handle missing source record', async () => {
      const fileId = 'non-existent';
      
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.updateSource(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Source not found');
    });

    it('should apply field update strategies', async () => {
      const fileId = 'file-123';
      const options: UpdateOptions = {
        fields: ['name', 'description'],
        fieldStrategies: {
          name: FieldUpdateStrategy.OVERWRITE,
          description: FieldUpdateStrategy.MERGE
        }
      };

      const existingData = {
        google_id: fileId,
        name: 'old-name.pdf',
        description: 'Existing description'
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingData,
          error: null
        }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      vi.mocked(mockGoogleDriveService.getFileMetadata).mockResolvedValue({
        id: fileId,
        name: 'new-name.pdf',
        description: 'Additional info'
      });

      await service.updateSource(fileId, options);

      // Verify update was called
      expect(mockFrom).toHaveBeenCalledWith('google_sources');
    });
  });

  describe('batchUpdate', () => {
    it('should update multiple sources in batch', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];
      const options: BatchUpdateOptions = {
        concurrency: 2,
        continueOnError: true
      };

      // Mock successful updates
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { google_id: 'file-id', name: 'test.pdf' },
          error: null
        }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      const results = await service.batchUpdate(fileIds, options);

      expect(results.total).toBe(3);
      expect(results.successful).toBe(3);
      expect(results.failed).toBe(0);
    });

    it('should handle mixed success and failure in batch', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];
      
      let callCount = 0;
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.resolve({
              data: null,
              error: new Error('Not found')
            });
          }
          return Promise.resolve({
            data: { google_id: `file-${callCount}` },
            error: null
          });
        }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      const results = await service.batchUpdate(fileIds, { continueOnError: true });

      expect(results.total).toBe(3);
      expect(results.successful).toBe(2);
      expect(results.failed).toBe(1);
    });

    it('should respect concurrency limits', async () => {
      const fileIds = Array.from({ length: 10 }, (_, i) => `file-${i}`);
      const concurrency = 3;

      let activeCount = 0;
      let maxActive = 0;

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          
          activeCount--;
          return { data: {}, error: null };
        }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      await service.batchUpdate(fileIds, { concurrency });

      expect(maxActive).toBeLessThanOrEqual(concurrency);
    });

    it('should call progress callback', async () => {
      const fileIds = ['file-1', 'file-2'];
      const onProgress = vi.fn();

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      await service.batchUpdate(fileIds, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        current: expect.any(Number),
        total: 2,
        percentage: expect.any(Number)
      }));
    });
  });

  describe('syncWithDrive', () => {
    it.skip('should sync all sources with Google Drive', async () => {
      // TODO: Implement syncWithDrive method in SourcesGoogleUpdateService
    });

    it.skip('should handle dry run mode', async () => {
      // TODO: Implement syncWithDrive method in SourcesGoogleUpdateService
    });
  });

  describe('queue management', () => {
    it('should queue updates for batch processing', async () => {
      const updates = [
        { fileId: 'file-1', data: { name: 'new1.pdf' } },
        { fileId: 'file-2', data: { name: 'new2.pdf' } }
      ];

      for (const update of updates) {
        await service.queueUpdate(update.fileId, update.data);
      }

      expect(service['updateQueue'].size).toBe(2);
    });

    it('should flush update queue', async () => {
      // Queue some updates
      await service.queueUpdate('file-1', { name: 'new1.pdf' });
      await service.queueUpdate('file-2', { name: 'new2.pdf' });

      const mockFrom = vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null })
      }));
      mockSupabase.from = mockFrom;

      await service.flushUpdateQueue();

      expect(service['updateQueue'].size).toBe(0);
      expect(mockFrom).toHaveBeenCalledWith('google_sources');
    });

    it('should auto-flush queue when size limit reached', async () => {
      const mockFrom = vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null })
      }));
      mockSupabase.from = mockFrom;

      // Queue many updates to trigger auto-flush
      for (let i = 0; i < 101; i++) {
        await service.queueUpdate(`file-${i}`, { name: `new${i}.pdf` });
      }

      // Should have auto-flushed at 100
      expect(service['updateQueue'].size).toBe(1);
    });
  });

  describe('conflict resolution', () => {
    it('should handle update conflicts based on strategy', async () => {
      const fileId = 'file-123';
      const options: UpdateOptions = {
        conflictResolution: 'USE_LATEST' as ConflictResolution,
        fields: ['modifiedTime']
      };

      const existingData = {
        google_id: fileId,
        modified_time: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingData,
          error: null
        }),
        update: vi.fn().mockReturnThis()
      }));
      mockSupabase.from = mockFrom;

      await service.updateSource(fileId, options);

      expect(mockGoogleDriveService.getFileMetadata).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Google Drive API errors', async () => {
      const fileId = 'file-123';
      
      vi.mocked(mockGoogleDriveService.getFileMetadata).mockRejectedValue(
        new Error('Drive API error')
      );

      const result = await service.updateSource(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Drive API error');
    });

    it('should handle database errors gracefully', async () => {
      const fileId = 'file-123';
      
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('Database connection lost'))
      }));
      mockSupabase.from = mockFrom;

      const result = await service.updateSource(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection lost');
    });
  });

  describe('metrics', () => {
    it.skip('should track update metrics', async () => {
      // TODO: Implement getMetrics method in SourcesGoogleUpdateService
    });
  });
});