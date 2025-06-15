import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchProcessingService } from '../BatchProcessingService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';
import { BatchStatus, BatchItemStatus, BatchOptions, ItemProcessor } from '../types';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null })
  }));

  return {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    },
    rpc: vi.fn().mockResolvedValue({ data: {}, error: null })
  } as unknown as SupabaseClient;
};

// Mock logger
const createMockLogger = (): Logger => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
});

describe('BatchProcessingService', () => {
  let service: BatchProcessingService;
  let mockSupabase: SupabaseClient;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockLogger = createMockLogger();
    service = new BatchProcessingService(mockSupabase, mockLogger);
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      expect(service).toBeInstanceOf(BatchProcessingService);
      expect(service['serviceName']).toBe('BatchProcessingService');
    });

    it('should throw error when supabase client is not provided', () => {
      expect(() => new BatchProcessingService(null as any)).toThrow('SupabaseClient is required');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when database is accessible', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ error: null })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: true,
        serviceName: 'BatchProcessingService',
        timestamp: expect.any(Date),
        details: {
          activeProcesses: 0,
          supabaseConnected: true
        }
      });
      expect(mockFrom).toHaveBeenCalledWith('batches');
    });

    it('should return unhealthy when database is not accessible', async () => {
      const error = new Error('Database connection failed');
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ error })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: false,
        serviceName: 'BatchProcessingService',
        timestamp: expect.any(Date),
        details: {
          activeProcesses: 0,
          supabaseConnected: false
        },
        error: 'Database connection failed'
      });
    });
  });

  describe('createBatch', () => {
    it('should create a new batch successfully', async () => {
      const batchData = {
        id: 'batch-123',
        name: 'Test Batch',
        description: 'Test Description',
        status: BatchStatus.QUEUED,
        total_items: 0,
        processed_items: 0,
        failed_items: 0,
        skipped_items: 0,
        progress_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockFrom = vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: batchData, error: null })
      }));
      mockSupabase.from = mockFrom;

      const options: BatchOptions = {
        name: 'Test Batch',
        description: 'Test Description'
      };

      const result = await service.createBatch(options);

      expect(result).toEqual(batchData);
      expect(mockFrom).toHaveBeenCalledWith('batches');
      expect(mockLogger.info).toHaveBeenCalledWith(`Created batch: ${batchData.id} - ${batchData.name}`);
    });

    it('should throw error when batch name is not provided', async () => {
      const options: BatchOptions = {
        name: ''
      };

      await expect(service.createBatch(options)).rejects.toThrow('Batch name is required');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      const mockFrom = vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error })
      }));
      mockSupabase.from = mockFrom;

      const options: BatchOptions = {
        name: 'Test Batch'
      };

      await expect(service.createBatch(options)).rejects.toThrow('Database error');
    });
  });

  describe('getBatch', () => {
    it('should retrieve a batch by ID', async () => {
      const batchData = {
        id: 'batch-123',
        name: 'Test Batch',
        status: BatchStatus.QUEUED
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: batchData, error: null })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.getBatch('batch-123');

      expect(result).toEqual(batchData);
      expect(mockFrom).toHaveBeenCalledWith('batches');
    });

    it('should return null when batch not found', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.getBatch('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error when batch ID is empty', async () => {
      await expect(service.getBatch('')).rejects.toThrow('Batch ID is required');
    });
  });

  describe('updateBatchStatus', () => {
    it('should update batch status successfully', async () => {
      const updatedBatch = {
        id: 'batch-123',
        status: BatchStatus.RUNNING,
        updated_at: new Date().toISOString()
      };

      const mockFrom = vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedBatch, error: null })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.updateBatchStatus('batch-123', BatchStatus.RUNNING);

      expect(result).toEqual(updatedBatch);
      expect(mockLogger.info).toHaveBeenCalledWith('Updated batch batch-123 status to running');
    });

    it('should set completed_at when status is completed', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockFrom = vi.fn(() => ({
        update: mockUpdate,
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null })
      }));
      mockSupabase.from = mockFrom;

      await service.updateBatchStatus('batch-123', BatchStatus.COMPLETED);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: BatchStatus.COMPLETED,
        completed_at: expect.any(String),
        updated_at: expect.any(String)
      }));
    });

    it('should throw error for invalid status', async () => {
      await expect(service.updateBatchStatus('batch-123', 'invalid' as any)).rejects.toThrow('Invalid batch status');
    });
  });

  describe('processBatchItems', () => {
    it('should process batch items successfully', async () => {
      const items = ['item1', 'item2', 'item3'];
      const processor: ItemProcessor<string, string> = vi.fn(async (item) => `processed-${item}`);
      
      // Mock batch operations
      const mockFrom = vi.fn((table) => {
        if (table === 'batches') {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: {}, error: null })
          };
        } else if (table === 'batch_items') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null })
              }))
            }))
          };
        }
      });
      mockSupabase.from = mockFrom as any;

      const result = await service.processBatchItems(
        'batch-123',
        items,
        processor,
        { concurrency: 2 }
      );

      expect(result.results).toEqual(['processed-item1', 'processed-item2', 'processed-item3']);
      expect(result.errors).toEqual([]);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should handle item processing errors', async () => {
      const items = ['item1', 'item2'];
      const processor: ItemProcessor<string, string> = vi.fn(async (item) => {
        if (item === 'item2') throw new Error('Processing failed');
        return `processed-${item}`;
      });

      // Mock batch operations
      const mockFrom = vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null })
      }));
      mockSupabase.from = mockFrom as any;

      const result = await service.processBatchItems(
        'batch-123',
        items,
        processor
      );

      expect(result.results[0]).toBe('processed-item1');
      expect(result.results[1]).toBeUndefined();
      expect(result.errors[1]).toBeInstanceOf(Error);
      expect(result.errors[1].message).toBe('Processing failed');
    });

    it('should call progress callback', async () => {
      const items = ['item1', 'item2'];
      const processor: ItemProcessor<string, string> = vi.fn(async (item) => `processed-${item}`);
      const onProgress = vi.fn();

      // Mock batch operations
      const mockFrom = vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null })
      }));
      mockSupabase.from = mockFrom as any;

      await service.processBatchItems(
        'batch-123',
        items,
        processor,
        { onProgress }
      );

      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        batchId: 'batch-123',
        total: 2,
        percentage: expect.any(Number)
      }));
    });

    it('should throw error when batch ID is empty', async () => {
      await expect(service.processBatchItems('', [], vi.fn())).rejects.toThrow('Batch ID is required');
    });

    it('should throw error when items array is empty', async () => {
      await expect(service.processBatchItems('batch-123', [], vi.fn())).rejects.toThrow('Items array cannot be empty');
    });

    it('should throw error when processor is not a function', async () => {
      await expect(service.processBatchItems('batch-123', ['item'], null as any)).rejects.toThrow('Processor must be a function');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel a running batch', async () => {
      // Create a mock active process
      const mockCancel = vi.fn();
      service['activeProcesses'].set('batch-123', { cancel: mockCancel });

      const mockFrom = vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null })
      }));
      mockSupabase.from = mockFrom;

      await service.cancelBatch('batch-123');

      expect(mockCancel).toHaveBeenCalled();
      expect(service['activeProcesses'].has('batch-123')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Cancelled batch: batch-123');
    });

    it('should update status even if no active process', async () => {
      const mockFrom = vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null })
      }));
      mockSupabase.from = mockFrom;

      await service.cancelBatch('batch-123');

      expect(mockFrom).toHaveBeenCalledWith('batches');
    });

    it('should throw error when batch ID is empty', async () => {
      await expect(service.cancelBatch('')).rejects.toThrow('Batch ID is required');
    });
  });

  describe('getBatchStatistics', () => {
    it('should retrieve batch statistics', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis()
      }));

      // Mock total count
      mockFrom.mockReturnValueOnce({
        select: vi.fn(() => ({ count: 10, error: null }))
      });

      // Mock status counts
      const statusCounts = [2, 1, 5, 1, 1]; // queued, running, completed, failed, cancelled
      statusCounts.forEach(count => {
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(() => ({ count, error: null }))
        });
      });

      mockSupabase.from = mockFrom as any;

      const result = await service.getBatchStatistics();

      expect(result).toEqual({
        total: 10,
        queued: 2,
        running: 1,
        completed: 5,
        failed: 1,
        cancelled: 1
      });
    });

    it('should filter by user ID when provided', async () => {
      const userIdCalls: string[] = [];
      
      const mockFrom = vi.fn(() => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field, value) => {
            if (field === 'user_id') {
              userIdCalls.push(value);
            }
            return mockQuery;
          })
        };
        
        // Add final count response
        Object.defineProperty(mockQuery, 'count', {
          get: () => 1
        });
        Object.defineProperty(mockQuery, 'error', {
          get: () => null
        });
        
        return mockQuery;
      });

      mockSupabase.from = mockFrom as any;

      await service.getBatchStatistics('user-123');

      // Verify user filter was applied multiple times (once for total, once for each status)
      expect(userIdCalls.length).toBeGreaterThan(0);
      expect(userIdCalls.every(id => id === 'user-123')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cancel all active processes on cleanup', async () => {
      const mockCancel1 = vi.fn();
      const mockCancel2 = vi.fn();
      
      service['activeProcesses'].set('batch-1', { cancel: mockCancel1 });
      service['activeProcesses'].set('batch-2', { cancel: mockCancel2 });

      await service['cleanup']();

      expect(mockCancel1).toHaveBeenCalled();
      expect(mockCancel2).toHaveBeenCalled();
      expect(service['activeProcesses'].size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

});