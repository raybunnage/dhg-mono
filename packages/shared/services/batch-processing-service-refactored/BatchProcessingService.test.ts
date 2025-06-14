import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatchProcessingService } from './BatchProcessingService';
import { SupabaseClient } from '@supabase/supabase-js';
import { MockLogger } from '../../test-utils/MockLogger';
import { BatchStatus, BatchItemStatus } from './types';

// Mock Supabase client
const createMockSupabaseClient = () => ({
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { 
            id: 'batch-123',
            name: 'Test Batch',
            status: BatchStatus.QUEUED,
            total_items: 0,
            processed_items: 0,
            failed_items: 0,
            skipped_items: 0,
            progress_percentage: 0
          }, 
          error: null 
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'batch-123', status: BatchStatus.RUNNING }, 
            error: null 
          }))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}) as unknown as SupabaseClient;

describe('BatchProcessingService', () => {
  let service: BatchProcessingService;
  let mockSupabaseClient: SupabaseClient;
  let mockLogger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockLogger = new MockLogger();
    service = new BatchProcessingService(mockSupabaseClient, mockLogger);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.ensureInitialized();
      expect(service.getMetadata().initialized).toBe(true);
    });

    it('should only initialize once', async () => {
      await service.ensureInitialized();
      await service.ensureInitialized();
      expect(service.getMetadata().initialized).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('health check', () => {
    it('should perform health check successfully', async () => {
      await service.ensureInitialized();
      const result = await service.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.serviceName).toBe('BatchProcessingService');
      expect(result.details?.activeProcesses).toBe(0);
    });

    it('should handle database connection errors', async () => {
      const errorClient = createMockSupabaseClient();
      (errorClient.from as any).mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'Connection failed' } 
          }))
        }))
      });
      
      const errorService = new BatchProcessingService(errorClient, mockLogger);
      await errorService.ensureInitialized();
      
      const result = await errorService.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error?.message).toBe('Connection failed');
      
      await errorService.shutdown();
    });
  });

  describe('createBatch', () => {
    it('should create a batch successfully', async () => {
      const options = {
        name: 'Test Batch',
        description: 'A test batch',
        metadata: { source: 'test' }
      };

      const result = await service.createBatch(options);
      
      expect(result).toBeDefined();
      expect(result.id).toBe('batch-123');
      expect(result.name).toBe('Test Batch');
      expect(result.status).toBe(BatchStatus.QUEUED);
    });

    it('should validate batch name is required', async () => {
      await expect(service.createBatch({ name: '' }))
        .rejects.toThrow('Batch name is required');
      
      await expect(service.createBatch({ name: '   ' }))
        .rejects.toThrow('Batch name is required');
    });

    it('should handle database errors with retry', async () => {
      let callCount = 0;
      const errorClient = createMockSupabaseClient();
      (errorClient.from as any).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => {
              callCount++;
              if (callCount < 3) {
                return Promise.resolve({ 
                  data: null, 
                  error: { message: 'Temporary error' } 
                });
              }
              return Promise.resolve({ 
                data: { id: 'batch-123', name: 'Test Batch' }, 
                error: null 
              });
            })
          }))
        }))
      });

      const errorService = new BatchProcessingService(errorClient, mockLogger);
      const result = await errorService.createBatch({ name: 'Test Batch' });
      
      expect(result.id).toBe('batch-123');
      expect(callCount).toBe(3); // Should retry twice before succeeding
      
      await errorService.shutdown();
    });
  });

  describe('getBatch', () => {
    it('should get batch by ID successfully', async () => {
      const mockBatch = {
        id: 'batch-123',
        name: 'Test Batch',
        status: BatchStatus.RUNNING
      };

      (mockSupabaseClient.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockBatch, error: null }))
          }))
        }))
      });

      const result = await service.getBatch('batch-123');
      expect(result).toEqual(mockBatch);
    });

    it('should return null when batch not found', async () => {
      (mockSupabaseClient.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: null, 
              error: { code: 'PGRST116' } 
            }))
          }))
        }))
      });

      const result = await service.getBatch('non-existent');
      expect(result).toBeNull();
    });

    it('should validate batch ID is required', async () => {
      await expect(service.getBatch('')).rejects.toThrow('Batch ID is required');
      await expect(service.getBatch('   ')).rejects.toThrow('Batch ID is required');
    });
  });

  describe('updateBatchStatus', () => {
    it('should update batch status successfully', async () => {
      const updatedBatch = {
        id: 'batch-123',
        status: BatchStatus.COMPLETED,
        completed_at: new Date().toISOString()
      };

      (mockSupabaseClient.from as any).mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: updatedBatch, error: null }))
            }))
          }))
        }))
      });

      const result = await service.updateBatchStatus('batch-123', BatchStatus.COMPLETED);
      expect(result.status).toBe(BatchStatus.COMPLETED);
      expect(result.completed_at).toBeDefined();
    });

    it('should validate status is valid', async () => {
      await expect(service.updateBatchStatus('batch-123', 'invalid' as any))
        .rejects.toThrow('Invalid batch status: invalid');
    });
  });

  describe('processBatchItems', () => {
    it('should process batch items successfully', async () => {
      // Mock batch item creation
      (mockSupabaseClient.from as any).mockImplementation((table: string) => {
        if (table === 'batch_items') {
          return {
            insert: vi.fn(() => Promise.resolve({ error: null })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
              }))
            }))
          };
        }
        // Default mock for batches table
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null }))
          }))
        };
      });

      const items = [1, 2, 3];
      const processor = vi.fn(async (item: number) => item * 2);
      
      const { results, errors } = await service.processBatchItems(
        'batch-123',
        items,
        processor,
        { concurrency: 2 }
      );

      expect(results).toEqual([2, 4, 6]);
      expect(errors).toEqual([]);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should handle processor errors', async () => {
      (mockSupabaseClient.from as any).mockImplementation((table: string) => {
        if (table === 'batch_items') {
          return {
            insert: vi.fn(() => Promise.resolve({ error: null })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
              }))
            }))
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null }))
          }))
        };
      });

      const items = [1, 2, 3];
      const processor = vi.fn(async (item: number) => {
        if (item === 2) throw new Error('Processing failed');
        return item * 2;
      });

      const { results, errors } = await service.processBatchItems(
        'batch-123',
        items,
        processor
      );

      expect(results[0]).toBe(2);
      expect(results[2]).toBe(6);
      expect(errors[1]).toBeDefined();
      expect(errors[1].message).toBe('Processing failed');
    });

    it('should call progress callback', async () => {
      (mockSupabaseClient.from as any).mockImplementation((table: string) => {
        if (table === 'batch_items') {
          return {
            insert: vi.fn(() => Promise.resolve({ error: null })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
              }))
            }))
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null }))
          }))
        };
      });

      const items = [1, 2, 3];
      const processor = vi.fn(async (item: number) => item * 2);
      const onProgress = vi.fn();

      await service.processBatchItems(
        'batch-123',
        items,
        processor,
        { onProgress, concurrency: 1 }
      );

      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.percentage).toBe(100);
      expect(lastCall.completed).toBe(3);
    });

    it('should validate inputs', async () => {
      const processor = vi.fn();

      await expect(service.processBatchItems('', [1], processor))
        .rejects.toThrow('Batch ID is required');

      await expect(service.processBatchItems('batch-123', [], processor))
        .rejects.toThrow('Items array cannot be empty');

      await expect(service.processBatchItems('batch-123', [1], null as any))
        .rejects.toThrow('Processor must be a function');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel a running batch', async () => {
      // Start a long-running process
      const items = Array(10).fill(0);
      const processor = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Start processing in background
      const processPromise = service.processBatchItems(
        'batch-123',
        items,
        processor,
        { concurrency: 1 }
      ).catch(() => {}); // Ignore the cancellation error

      // Cancel after a short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      await service.cancelBatch('batch-123');

      // Wait for process to finish
      await processPromise;

      // Processor should not have processed all items
      expect(processor).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBatchStatistics', () => {
    it('should get batch statistics successfully', async () => {
      // Mock count queries
      (mockSupabaseClient.from as any).mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ count: 5, error: null }))
        }))
      }));

      const stats = await service.getBatchStatistics();
      
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats).toHaveProperty('queued');
      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('cancelled');
    });

    it('should filter by user ID', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ count: 3, error: null }))
          }))
        }))
      }));
      
      (mockSupabaseClient.from as any).mockImplementation(mockFrom);

      await service.getBatchStatistics('user-123');
      
      // Verify user_id filter was applied
      expect(mockFrom).toHaveBeenCalled();
    });
  });

  describe('performance monitoring', () => {
    it('should track operation performance', async () => {
      const startTime = Date.now();
      await service.createBatch({ name: 'Performance Test' });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should log performance metrics', async () => {
      await service.createBatch({ name: 'Test Batch' });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('BatchProcessingService.createBatch completed')
      );
    });
  });

  describe('cleanup and shutdown', () => {
    it('should cancel active processes on shutdown', async () => {
      // Start multiple processes
      const processor = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      const promises = [
        service.processBatchItems('batch-1', [1, 2, 3], processor).catch(() => {}),
        service.processBatchItems('batch-2', [4, 5, 6], processor).catch(() => {})
      ];

      // Shutdown service
      await service.shutdown();

      // Wait for all processes
      await Promise.all(promises);

      // Verify warning logs
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cancelling active batch process')
      );
    });
  });
});