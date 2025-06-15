/**
 * BatchDatabaseService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatchDatabaseService } from './BatchDatabaseService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock progress callback
const mockProgress = vi.fn();

// Mock error callback
const mockError = vi.fn();

describe('BatchDatabaseService', () => {
  let service: BatchDatabaseService;
  let mockInsert: any;
  let mockUpdate: any;
  let mockDelete: any;
  let mockUpsert: any;
  let mockSelect: any;
  let mockEq: any;
  let mockIn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance for tests
    (BatchDatabaseService as any).instance = undefined;

    // Setup query chain mocks
    mockEq = vi.fn(() => ({ error: null }));
    mockIn = vi.fn(() => ({ error: null }));
    mockInsert = vi.fn(() => ({ error: null }));
    mockUpdate = vi.fn(() => ({ eq: mockEq }));
    mockDelete = vi.fn(() => ({ in: mockIn }));
    mockUpsert = vi.fn(() => ({ error: null }));
    mockSelect = vi.fn(() => ({ limit: vi.fn(() => ({ error: null })) }));

    (mockSupabase.from as any).mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      upsert: mockUpsert,
      select: mockSelect
    });

    service = BatchDatabaseService.getInstance(mockSupabase, {
      defaultBatchSize: 10,
      defaultRetryAttempts: 2,
      defaultRetryDelay: 100
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = BatchDatabaseService.getInstance(mockSupabase);
      const instance2 = BatchDatabaseService.getInstance(mockSupabase);
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      const config = { defaultBatchSize: 50 };
      const instance = BatchDatabaseService.getInstance(mockSupabase, config);
      expect(instance).toBeInstanceOf(BatchDatabaseService);
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      await service['initialize']();
      expect(mockSupabase.from).toHaveBeenCalledWith('sys_shared_services');
    });

    it('should handle initialization errors', async () => {
      mockSelect.mockReturnValue({ 
        limit: vi.fn(() => ({ error: { message: 'Connection failed' } }))
      });
      
      await expect(service['initialize']()).rejects.toThrow('Database connection test failed');
    });

    it('should cleanup active operations', async () => {
      // Start an operation
      const promise = service.batchInsert('test_table', [{ id: 1 }]);
      
      // Cleanup should wait for operations
      await service['cleanup']();
      
      await promise; // Let it complete
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when database is accessible', async () => {
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.database).toBe('connected');
      expect(health.details.metrics).toBeDefined();
      expect(health.details.activeOperations).toBe(0);
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy status on database errors', async () => {
      mockSelect.mockReturnValue({ 
        limit: vi.fn(() => ({ error: { message: 'Database error' } }))
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.database).toBe('error: Database error');
    });
  });

  describe('Batch Insert', () => {
    const testData = Array.from({ length: 25 }, (_, i) => ({ 
      id: i + 1, 
      name: `Item ${i + 1}` 
    }));

    it('should insert data in batches', async () => {
      const result = await service.batchInsert('test_table', testData, {
        batchSize: 10,
        onProgress: mockProgress
      });

      expect(result.successful).toBe(25);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);

      // Should be called 3 times (10 + 10 + 5)
      expect(mockInsert).toHaveBeenCalledTimes(3);
      expect(mockProgress).toHaveBeenCalled();
    });

    it('should handle insert errors with retry', async () => {
      // First attempt fails, second succeeds
      mockInsert
        .mockReturnValueOnce({ error: { message: 'Insert failed' } })
        .mockReturnValueOnce({ error: null });

      const result = await service.batchInsert('test_table', testData.slice(0, 5), {
        onError: mockError
      });

      expect(result.successful).toBe(5);
      expect(result.failed).toBe(0);
      expect(mockInsert).toHaveBeenCalledTimes(2); // Retry happened
    });

    it('should handle permanent failures', async () => {
      mockInsert.mockReturnValue({ error: { message: 'Permanent error' } });

      const result = await service.batchInsert('test_table', testData.slice(0, 5), {
        onError: mockError,
        continueOnError: true
      });

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(5);
      expect(result.errors).toHaveLength(5);
      expect(mockError).toHaveBeenCalledTimes(5);
    });

    it('should throw on error when continueOnError is false', async () => {
      mockInsert.mockReturnValue({ error: { message: 'Fatal error' } });

      await expect(
        service.batchInsert('test_table', testData.slice(0, 5), {
          continueOnError: false
        })
      ).rejects.toThrow('Batch insert failed after 2 attempts');
    });

    it('should track metrics', async () => {
      await service.batchInsert('test_table', testData);
      
      const metrics = service.getMetrics();
      expect(metrics.totalBatches).toBe(1);
      expect(metrics.totalOperations).toBe(1);
      expect(metrics.totalInserts).toBe(25);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });
  });

  describe('Batch Update', () => {
    const testUpdates = Array.from({ length: 15 }, (_, i) => ({ 
      id: `id-${i + 1}`, 
      data: { name: `Updated ${i + 1}` }
    }));

    it('should update data in batches', async () => {
      const result = await service.batchUpdate('test_table', testUpdates, {
        batchSize: 5,
        onProgress: mockProgress
      });

      expect(result.successful).toBe(15);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      
      // Updates are done individually, so 15 calls
      expect(mockUpdate).toHaveBeenCalledTimes(15);
      expect(mockEq).toHaveBeenCalledTimes(15);
    });

    it('should handle update errors with retry', async () => {
      mockEq
        .mockReturnValueOnce({ error: { message: 'Update failed' } })
        .mockReturnValue({ error: null });

      const result = await service.batchUpdate('test_table', testUpdates.slice(0, 1));

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should continue on error when specified', async () => {
      mockEq.mockReturnValue({ error: { message: 'Update error' } });

      const result = await service.batchUpdate('test_table', testUpdates.slice(0, 3), {
        onError: mockError,
        continueOnError: true
      });

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.errors).toHaveLength(3);
    });

    it('should use smaller batch size for updates', async () => {
      const defaultService = BatchDatabaseService.getInstance(mockSupabase);
      await defaultService.batchUpdate('test_table', testUpdates);
      
      // Default batch size is 100, but updates should use max 50
      const metrics = defaultService.getMetrics();
      expect(metrics.totalUpdates).toBe(15);
    });
  });

  describe('Batch Delete', () => {
    const testIds = Array.from({ length: 20 }, (_, i) => `id-${i + 1}`);

    it('should delete data in batches', async () => {
      const result = await service.batchDelete('test_table', testIds, {
        batchSize: 10,
        onProgress: mockProgress
      });

      expect(result.successful).toBe(20);
      expect(result.failed).toBe(0);
      
      // Should be called 2 times (10 + 10)
      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockIn).toHaveBeenCalledTimes(2);
    });

    it('should handle delete errors', async () => {
      mockIn.mockReturnValue({ error: { message: 'Delete failed' } });

      const result = await service.batchDelete('test_table', testIds.slice(0, 5), {
        onError: mockError,
        continueOnError: true
      });

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(5);
      expect(mockError).toHaveBeenCalledTimes(5);
    });
  });

  describe('Batch Upsert', () => {
    const testData = Array.from({ length: 30 }, (_, i) => ({ 
      id: i + 1, 
      name: `Item ${i + 1}` 
    }));

    it('should upsert data in batches', async () => {
      const result = await service.batchUpsert('test_table', testData, {
        batchSize: 10,
        onConflict: 'id'
      });

      expect(result.successful).toBe(30);
      expect(result.failed).toBe(0);
      
      // Should be called 3 times
      expect(mockUpsert).toHaveBeenCalledTimes(3);
      expect(mockUpsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: 'id' });
    });

    it('should use custom conflict column', async () => {
      await service.batchUpsert('test_table', testData.slice(0, 5), {
        onConflict: 'email'
      });

      expect(mockUpsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: 'email' });
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate progress correctly', async () => {
      const progressUpdates: any[] = [];
      
      await service.batchInsert('test_table', Array(100).fill({ data: 'test' }), {
        batchSize: 25,
        onProgress: (progress) => progressUpdates.push({ ...progress })
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.processed).toBe(100);
      expect(lastUpdate.total).toBe(100);
      expect(lastUpdate.successful).toBe(100);
      expect(lastUpdate.rate).toBeGreaterThan(0);
    });

    it('should format time estimates correctly', () => {
      const progress = service.createConsoleProgress('Test');
      
      // Mock console.log to capture output
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      
      progress({
        processed: 50,
        total: 100,
        successful: 48,
        failed: 2,
        rate: 10,
        estimatedTimeRemaining: '5s'
      });

      expect(writeSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  describe('Metrics', () => {
    it('should track all operation types', async () => {
      await service.batchInsert('table1', [{ id: 1 }]);
      await service.batchUpdate('table2', [{ id: '1', data: {} }]);
      await service.batchDelete('table3', ['1']);
      await service.batchUpsert('table4', [{ id: 1 }]);

      const metrics = service.getMetrics();
      expect(metrics.totalOperations).toBe(4);
      expect(metrics.totalInserts).toBe(1);
      expect(metrics.totalUpdates).toBe(1);
      expect(metrics.totalDeletes).toBe(1);
      expect(metrics.totalUpserts).toBe(1);
    });

    it('should reset metrics', () => {
      service.resetMetrics();
      
      const metrics = service.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.averageRate).toBe(0);
    });

    it('should track error count', async () => {
      mockInsert.mockReturnValue({ error: { message: 'Error' } });
      
      await service.batchInsert('table', [{ id: 1 }, { id: 2 }], {
        continueOnError: true
      });

      const metrics = service.getMetrics();
      expect(metrics.totalErrors).toBe(2);
    });
  });

  describe('Active Operations', () => {
    it('should track active operations', async () => {
      expect(service.getActiveOperationCount()).toBe(0);
      
      const promise = service.batchInsert('table', Array(1000).fill({}), {
        batchSize: 1
      });
      
      // Operation should be active
      expect(service.getActiveOperationCount()).toBe(1);
      
      await promise;
      
      // Operation should be complete
      expect(service.getActiveOperationCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should include item details in errors', async () => {
      mockInsert.mockReturnValue({ error: { message: 'Constraint violation' } });
      
      const items = [{ id: 1, name: 'Test' }];
      const result = await service.batchInsert('table', items, {
        continueOnError: true
      });

      expect(result.errors[0].item).toEqual(items[0]);
      expect(result.errors[0].index).toBe(0);
      expect(result.errors[0].error.message).toBe('Constraint violation');
    });

    it('should respect retry delays', async () => {
      const start = Date.now();
      
      mockInsert
        .mockReturnValueOnce({ error: { message: 'Retry me' } })
        .mockReturnValueOnce({ error: null });

      await service.batchInsert('table', [{ id: 1 }], {
        retryDelay: 50
      });

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThan(50); // At least one retry delay
    });
  });
});