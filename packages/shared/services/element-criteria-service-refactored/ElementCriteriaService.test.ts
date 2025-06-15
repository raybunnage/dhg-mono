/**
 * Test suite for ElementCriteriaService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElementCriteriaService } from './ElementCriteriaService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  rpc: vi.fn()
};

describe('ElementCriteriaService', () => {
  let service: ElementCriteriaService;
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

    service = new ElementCriteriaService(mockSupabaseClient, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should create instance with Supabase client', () => {
      expect(service).toBeInstanceOf(ElementCriteriaService);
    });

    it('should throw error if Supabase client is not provided', () => {
      expect(() => new ElementCriteriaService(null as any)).toThrow('ElementCriteriaService requires a Supabase client');
    });

    it('should accept optional logger', () => {
      const serviceWithoutLogger = new ElementCriteriaService(mockSupabaseClient);
      expect(serviceWithoutLogger).toBeInstanceOf(ElementCriteriaService);
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

  describe('Get Element Criteria', () => {
    const mockCriteria = [
      {
        id: '1',
        element_type: 'app_feature',
        element_id: 'feature-1',
        title: 'Test Criteria',
        success_condition: 'Should work'
      }
    ];

    it('should fetch criteria for an element', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: mockCriteria, error: null });
      
      const criteria = await service.getElementCriteria('app_feature', 'feature-1');
      
      expect(criteria).toEqual(mockCriteria);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('element_success_criteria');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('element_type', 'app_feature');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('element_id', 'feature-1');
    });

    it('should handle errors gracefully', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: null, error: { message: 'Query failed' } });
      
      const criteria = await service.getElementCriteria('app_feature', 'feature-1');
      
      expect(criteria).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should update metrics', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: mockCriteria, error: null });
      
      await service.getElementCriteria('app_feature', 'feature-1');
      
      const metrics = service.getMetrics();
      expect(metrics.totalCriteriaFetched).toBe(1);
      expect(metrics.lastOperation).toBe('getElementCriteria');
    });
  });

  describe('Add Criteria', () => {
    const newCriteria = {
      element_type: 'app_feature' as const,
      element_id: 'feature-1',
      title: 'New Criteria',
      success_condition: 'Must pass tests',
      criteria_type: 'functional' as const
    };

    it('should add new criteria successfully', async () => {
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { ...newCriteria, id: '123' }, 
        error: null 
      });
      
      const result = await service.addCriteria(newCriteria);
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('123');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(newCriteria);
    });

    it('should validate required fields', async () => {
      const invalidCriteria = { element_type: 'app_feature' } as any;
      
      const result = await service.addCriteria(invalidCriteria);
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed'),
        expect.any(Error)
      );
    });

    it('should update metrics on successful add', async () => {
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { ...newCriteria, id: '123' }, 
        error: null 
      });
      
      await service.addCriteria(newCriteria);
      
      const metrics = service.getMetrics();
      expect(metrics.totalCriteriaAdded).toBe(1);
    });
  });

  describe('Apply Template', () => {
    const mockTemplate = {
      id: 'template-1',
      template_name: 'Standard App Feature',
      criteria_set: [
        { title: 'Criteria 1', success_condition: 'Condition 1' },
        { title: 'Criteria 2', success_condition: 'Condition 2' }
      ],
      gates_set: [
        { gate_name: 'Gate 1', gate_type: 'pre-commit' }
      ],
      use_count: 5
    };

    it('should apply template successfully', async () => {
      // Mock template fetch
      mockQueryBuilder.single.mockResolvedValueOnce({ 
        data: mockTemplate, 
        error: null 
      });

      // Mock successful inserts
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { id: 'new-id' }, 
        error: null 
      });

      // Mock update for use count
      mockQueryBuilder.eq.mockResolvedValue({ 
        data: null, 
        error: null 
      });

      const result = await service.applyTemplate('template-1', 'app_feature', 'feature-1');
      
      expect(result.criteriaCount).toBe(2);
      expect(result.gatesCount).toBe(1);
    });

    it('should handle missing template', async () => {
      mockQueryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: null 
      });

      const result = await service.applyTemplate('invalid-template', 'app_feature', 'feature-1');
      
      expect(result.criteriaCount).toBe(0);
      expect(result.gatesCount).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Copy Criteria', () => {
    const sourceCriteria = [
      { id: '1', title: 'Criteria 1', success_condition: 'Condition 1' },
      { id: '2', title: 'Criteria 2', success_condition: 'Condition 2' }
    ];

    const sourceGates = [
      { id: 'g1', gate_name: 'Gate 1', gate_type: 'pre-commit' }
    ];

    it('should copy criteria and gates from source to target', async () => {
      // Mock fetching source criteria
      mockQueryBuilder.order.mockResolvedValueOnce({ 
        data: sourceCriteria, 
        error: null 
      });

      // Mock fetching source gates
      mockQueryBuilder.order.mockResolvedValueOnce({ 
        data: sourceGates, 
        error: null 
      });

      // Mock successful inserts
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { id: 'new-id' }, 
        error: null 
      });

      const result = await service.copyCriteria(
        'app_feature', 'source-1',
        'app_feature', 'target-1'
      );
      
      expect(result.criteriaCount).toBe(2);
      expect(result.gatesCount).toBe(1);
    });
  });

  describe('Metrics', () => {
    it('should track all operations', async () => {
      // Perform various operations
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
      mockQueryBuilder.single.mockResolvedValue({ data: { id: '1' }, error: null });

      await service.getElementCriteria('app_feature', 'test');
      await service.getElementGates('app_feature', 'test');
      await service.addCriteria({
        element_type: 'app_feature',
        element_id: 'test',
        title: 'Test',
        success_condition: 'Test'
      });

      const metrics = service.getMetrics();
      
      expect(metrics.totalCriteriaFetched).toBe(0);
      expect(metrics.totalGatesFetched).toBe(0);
      expect(metrics.totalCriteriaAdded).toBe(1);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should track errors', async () => {
      mockQueryBuilder.order.mockResolvedValue({ 
        data: null, 
        error: { message: 'Test error' } 
      });

      await service.getElementCriteria('app_feature', 'test');
      
      const metrics = service.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.lastError).toBe('Test error');
    });
  });

  describe('RPC Functions', () => {
    it('should suggest criteria using RPC', async () => {
      const mockSuggestions = [
        { title: 'Suggested 1', description: 'Desc 1', success_condition: 'Condition 1' }
      ];

      (mockSupabaseClient as any).rpc = vi.fn().mockResolvedValue({ 
        data: mockSuggestions, 
        error: null 
      });

      const suggestions = await service.suggestCriteria('app_feature', 'feature-1', 'auth');
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggested_by).toBe('system');
      expect((mockSupabaseClient as any).rpc).toHaveBeenCalledWith('suggest_element_criteria', {
        p_element_type: 'app_feature',
        p_element_id: 'feature-1',
        p_feature_type: 'auth'
      });
    });

    it('should inherit criteria to task', async () => {
      (mockSupabaseClient as any).rpc = vi.fn().mockResolvedValue({ 
        data: 5, 
        error: null 
      });

      const count = await service.inheritToTask('task-1', 'app_feature', 'feature-1');
      
      expect(count).toBe(5);
      expect((mockSupabaseClient as any).rpc).toHaveBeenCalledWith('inherit_element_criteria', {
        p_task_id: 'task-1',
        p_element_type: 'app_feature',
        p_element_id: 'feature-1'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (mockSupabaseClient.from as any).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const criteria = await service.getElementCriteria('app_feature', 'test');
      
      expect(criteria).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(service.getMetrics().totalErrors).toBe(1);
    });

    it('should log appropriate error messages', async () => {
      mockQueryBuilder.order.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection lost' } 
      });

      await service.getElementCriteria('app_feature', 'test');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error fetching element criteria',
        expect.objectContaining({ message: 'Database connection lost' })
      );
    });
  });
});