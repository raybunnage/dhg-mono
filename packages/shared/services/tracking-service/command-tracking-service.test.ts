/**
 * CommandTrackingService Tests
 * 
 * Comprehensive test suite for command tracking functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandTrackingService, CommandTrackingRecord } from './command-tracking-service';

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  Logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../supabase-client', () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => mockSupabase)
    }))
  }
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

// Mock Supabase client
const mockSupabase = {
  from: vi.fn()
};

describe('CommandTrackingService', () => {
  let service: CommandTrackingService;
  let mockFrom: any;
  let mockInsert: any;
  let mockUpdate: any;
  let mockSelect: any;
  let mockEq: any;
  let mockSingle: any;
  let mockOrder: any;
  let mockLimit: any;
  let mockRpc: any;

  beforeEach(() => {
    // Reset singleton
    (CommandTrackingService as any).instance = null;

    // Setup mock chain
    mockSingle = vi.fn().mockResolvedValue({
      data: {
        execution_time: new Date().toISOString()
      },
      error: null
    });
    
    mockLimit = vi.fn().mockReturnThis();
    mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    mockSelect = vi.fn().mockReturnValue({ 
      eq: mockEq,
      order: mockOrder
    });
    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    
    mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect
    });
    
    mockSupabase.from = mockFrom;
    mockSupabase.rpc = mockRpc;

    // Clear all mocks
    vi.clearAllMocks();

    // Get service instance
    service = CommandTrackingService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = CommandTrackingService.getInstance();
      const instance2 = CommandTrackingService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('startTracking', () => {
    it('should create a tracking record with running status', async () => {
      const trackingId = await service.startTracking('test-pipeline', 'test-command');
      
      expect(trackingId).toBe('test-uuid-123');
      expect(mockFrom).toHaveBeenCalledWith('command_tracking');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-123',
          pipeline_name: 'test-pipeline',
          command_name: 'test-command',
          status: 'running',
          execution_time: expect.any(String),
          created_at: expect.any(String)
        })
      );
    });

    it('should return valid ID even if database insert fails', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'DB error' } });
      
      const trackingId = await service.startTracking('test-pipeline', 'test-command');
      
      expect(trackingId).toBe('test-uuid-123');
    });

    it('should handle exceptions gracefully', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Connection failed');
      });
      
      const trackingId = await service.startTracking('test-pipeline', 'test-command');
      
      expect(trackingId).toBe('test-uuid-123');
    });
  });

  describe('completeTracking', () => {
    it('should update tracking record with success status and duration', async () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      mockSingle.mockResolvedValue({
        data: { execution_time: startTime.toISOString() },
        error: null
      });
      
      // Mock Date to control duration calculation
      const endTime = new Date('2025-01-01T10:00:05Z');
      vi.setSystemTime(endTime);
      
      await service.completeTracking('test-uuid-123', {
        recordsAffected: 10,
        affectedEntity: 'documents',
        summary: 'Processed 10 documents'
      });
      
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'success',
        duration_ms: 5000, // 5 seconds
        records_affected: 10,
        affected_entity: 'documents',
        summary: 'Processed 10 documents'
      });
      
      expect(mockEq).toHaveBeenCalledWith('id', 'test-uuid-123');
      
      vi.useRealTimers();
    });

    it('should handle missing results gracefully', async () => {
      await service.completeTracking('test-uuid-123');
      
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'success',
        duration_ms: expect.any(Number),
        records_affected: null,
        affected_entity: null,
        summary: null
      });
    });

    it('should handle fetch errors gracefully', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });
      
      await service.completeTracking('test-uuid-123');
      
      // Should not attempt update if fetch fails
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('failTracking', () => {
    it('should update tracking record with error status and message', async () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      mockSingle.mockResolvedValue({
        data: { execution_time: startTime.toISOString() },
        error: null
      });
      
      const endTime = new Date('2025-01-01T10:00:03Z');
      vi.setSystemTime(endTime);
      
      await service.failTracking('test-uuid-123', 'Connection timeout');
      
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'error',
        duration_ms: 3000,
        error_message: 'Connection timeout'
      });
      
      expect(mockEq).toHaveBeenCalledWith('id', 'test-uuid-123');
      
      vi.useRealTimers();
    });
  });

  describe('trackCommand', () => {
    it('should create a complete tracking record in one call', async () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const endTime = new Date('2025-01-01T10:00:02.500Z');
      vi.setSystemTime(endTime);
      
      const trackingId = await service.trackCommand({
        pipelineName: 'document',
        commandName: 'classify',
        startTime,
        status: 'success',
        recordsAffected: 25,
        affectedEntity: 'PDFs',
        summary: 'Classified 25 PDF documents'
      });
      
      expect(trackingId).toBe('test-uuid-123');
      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        pipeline_name: 'document',
        command_name: 'classify',
        execution_time: startTime.toISOString(),
        duration_ms: 2500,
        status: 'success',
        records_affected: 25,
        affected_entity: 'PDFs',
        summary: 'Classified 25 PDF documents',
        error_message: null,
        created_at: startTime.toISOString()
      });
      
      vi.useRealTimers();
    });

    it('should handle error status with error message', async () => {
      const startTime = new Date();
      
      await service.trackCommand({
        pipelineName: 'google_sync',
        commandName: 'sync-files',
        startTime,
        status: 'error',
        errorMessage: 'API rate limit exceeded'
      });
      
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'API rate limit exceeded',
          records_affected: null,
          affected_entity: null,
          summary: null
        })
      );
    });
  });

  describe('getRecentCommands', () => {
    it('should fetch recent commands with default limit', async () => {
      const mockData = [
        { id: '1', pipeline_name: 'test', command_name: 'cmd1' },
        { id: '2', pipeline_name: 'test', command_name: 'cmd2' }
      ];
      
      mockLimit.mockResolvedValue({ data: mockData, error: null });
      
      const result = await service.getRecentCommands();
      
      expect(result).toEqual(mockData);
      expect(mockOrder).toHaveBeenCalledWith('execution_time', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it('should apply pipeline filter when provided', async () => {
      // Create a proper query chain mock
      const queryMock = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        then: vi.fn()
      };
      
      // Make each method return the query object for chaining
      queryMock.eq.mockReturnValue(queryMock);
      queryMock.order.mockReturnValue(queryMock);
      queryMock.limit.mockReturnValue(queryMock);
      
      // Mock the final promise resolution
      queryMock.then.mockImplementation((resolve) => {
        resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      });
      
      mockSelect.mockReturnValue(queryMock);
      
      await service.getRecentCommands(50, 'document');
      
      expect(queryMock.order).toHaveBeenCalledWith('execution_time', { ascending: false });
      expect(queryMock.limit).toHaveBeenCalledWith(50);
      expect(queryMock.eq).toHaveBeenCalledWith('pipeline_name', 'document');
    });

    it('should apply status filter when provided', async () => {
      // Create a proper query chain mock
      const queryMock = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        then: vi.fn()
      };
      
      // Make each method return the query object for chaining
      queryMock.eq.mockReturnValue(queryMock);
      queryMock.order.mockReturnValue(queryMock);
      queryMock.limit.mockReturnValue(queryMock);
      
      // Mock the final promise resolution
      queryMock.then.mockImplementation((resolve) => {
        resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      });
      
      mockSelect.mockReturnValue(queryMock);
      
      await service.getRecentCommands(50, undefined, 'error');
      
      expect(queryMock.eq).toHaveBeenCalledWith('status', 'error');
    });

    it('should return empty array on error', async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      
      const result = await service.getRecentCommands();
      
      expect(result).toEqual([]);
    });
  });

  describe('getCommandStats', () => {
    it('should call RPC function and return stats', async () => {
      const mockStats = [
        { pipeline: 'document', command: 'classify', count: 100 },
        { pipeline: 'google_sync', command: 'sync', count: 50 }
      ];
      
      mockRpc.mockResolvedValue({ data: mockStats, error: null });
      
      const result = await service.getCommandStats();
      
      expect(result).toEqual(mockStats);
      expect(mockRpc).toHaveBeenCalledWith('get_command_stats');
    });

    it('should return empty array on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } });
      
      const result = await service.getCommandStats();
      
      expect(result).toEqual([]);
    });

    it('should handle exceptions gracefully', async () => {
      mockRpc.mockImplementation(() => {
        throw new Error('RPC failed');
      });
      
      const result = await service.getCommandStats();
      
      expect(result).toEqual([]);
    });
  });
});