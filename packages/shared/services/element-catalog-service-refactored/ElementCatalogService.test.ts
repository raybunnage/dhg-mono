/**
 * Test suite for ElementCatalogService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElementCatalogService } from './ElementCatalogService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn()
} as unknown as SupabaseClient;

// Mock query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis()
};

describe('ElementCatalogService', () => {
  let service: ElementCatalogService;
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

    service = new ElementCatalogService(mockSupabaseClient, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should create instance with Supabase client', () => {
      expect(service).toBeInstanceOf(ElementCatalogService);
    });

    it('should throw error if Supabase client is not provided', () => {
      expect(() => new ElementCatalogService(null as any)).toThrow('ElementCatalogService requires a Supabase client');
    });

    it('should accept optional logger', () => {
      const serviceWithoutLogger = new ElementCatalogService(mockSupabaseClient);
      expect(serviceWithoutLogger).toBeInstanceOf(ElementCatalogService);
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

  describe('Get App Features', () => {
    const mockFeatures = [
      {
        id: '1',
        app_name: 'dhg-hub',
        feature_type: 'page',
        feature_name: 'Dashboard',
        file_path: '/pages/Dashboard.tsx'
      },
      {
        id: '2',
        app_name: 'dhg-hub',
        feature_type: 'component',
        feature_name: 'Header',
        file_path: '/components/Header.tsx'
      }
    ];

    it('should fetch app features successfully', async () => {
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: mockFeatures, error: null });
      
      const features = await service.getAppFeatures('dhg-hub');
      
      expect(features).toEqual(mockFeatures);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_app_features', { p_app_name: 'dhg-hub' });
    });

    it('should handle errors gracefully', async () => {
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
      
      const features = await service.getAppFeatures('dhg-hub');
      
      expect(features).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should update metrics', async () => {
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: mockFeatures, error: null });
      
      await service.getAppFeatures('dhg-hub');
      
      const metrics = service.getMetrics();
      expect(metrics.totalAppFeaturesQueried).toBe(2);
      expect(metrics.lastOperation).toBe('getAppFeatures');
    });
  });

  describe('Get CLI Commands', () => {
    const mockCommands = [
      {
        id: '1',
        command_name: 'sync',
        description: 'Sync files',
        pipeline_id: 'p1',
        command_pipelines: { id: 'p1', name: 'google_sync' }
      }
    ];

    it('should fetch CLI commands for a pipeline', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: mockCommands, error: null });
      
      const commands = await service.getCLICommands('google_sync');
      
      expect(commands).toHaveLength(1);
      expect(commands[0].pipeline_name).toBe('google_sync');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('command_pipelines.name', 'google_sync');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('should flatten command structure', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: mockCommands, error: null });
      
      const commands = await service.getCLICommands('google_sync');
      
      expect(commands[0]).toMatchObject({
        id: '1',
        pipeline_id: 'p1',
        pipeline_name: 'google_sync',
        command_name: 'sync',
        description: 'Sync files'
      });
    });
  });

  describe('Get Shared Services', () => {
    const mockServices = [
      {
        id: '1',
        service_name: 'AuthService',
        service_path: 'auth-service/',
        category: 'authentication'
      }
    ];

    it('should fetch all shared services', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: mockServices, error: null });
      
      const services = await service.getSharedServices();
      
      expect(services).toEqual(mockServices);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sys_shared_services');
    });

    it('should filter by category', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: mockServices, error: null });
      
      const services = await service.getSharedServices('authentication');
      
      expect(services).toEqual(mockServices);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('category', 'authentication');
    });
  });

  describe('Get Available Elements', () => {
    it('should get app features when type is app', async () => {
      const mockFeatures = [{ id: '1', app_name: 'test-app', feature_type: 'page', feature_name: 'Home', file_path: '/Home.tsx' }];
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: mockFeatures, error: null });
      
      const elements = await service.getAvailableElements('app', 'test-app');
      
      expect(elements).toHaveLength(1);
      expect(elements[0].element_type).toBe('app_feature');
      expect(elements[0].category).toBe('test-app');
    });

    it('should get CLI commands when type is cli_pipeline', async () => {
      const mockCommands = [{
        id: '1',
        command_name: 'test',
        pipeline_id: 'p1',
        command_pipelines: { name: 'test-pipeline' }
      }];
      mockQueryBuilder.order.mockResolvedValue({ data: mockCommands, error: null });
      
      const elements = await service.getAvailableElements('cli_pipeline', 'cli-test-pipeline');
      
      expect(elements).toHaveLength(1);
      expect(elements[0].element_type).toBe('cli_command');
      expect(elements[0].subcategory).toBe('command');
    });

    it('should handle cli- prefix extraction', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
      
      await service.getAvailableElements('cli_pipeline', 'cli-google_sync');
      
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('command_pipelines.name', 'google_sync');
    });
  });

  describe('Catalog App Feature', () => {
    const newFeature = {
      app_name: 'dhg-hub',
      feature_type: 'page' as const,
      feature_name: 'NewPage',
      file_path: '/pages/NewPage.tsx',
      description: 'A new page'
    };

    it('should catalog new feature successfully', async () => {
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: 'feature-id-123', error: null });
      
      const id = await service.catalogAppFeature(newFeature);
      
      expect(id).toBe('feature-id-123');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('catalog_app_feature', expect.objectContaining({
        p_app_name: 'dhg-hub',
        p_feature_type: 'page',
        p_feature_name: 'NewPage',
        p_file_path: '/pages/NewPage.tsx'
      }));
    });

    it('should validate required fields', async () => {
      const invalidFeature = { app_name: 'test' } as any;
      
      const id = await service.catalogAppFeature(invalidFeature);
      
      expect(id).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed'),
        expect.any(Error)
      );
    });

    it('should update metrics on successful catalog', async () => {
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: 'feature-id-123', error: null });
      
      await service.catalogAppFeature(newFeature);
      
      const metrics = service.getMetrics();
      expect(metrics.totalFeaturesCataloged).toBe(1);
    });
  });

  describe('Link Element to Task', () => {
    it('should link element to task successfully', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ data: null, error: null });
      mockQueryBuilder.insert.mockResolvedValue({ data: null, error: null });
      
      const result = await service.linkElementToTask(
        'task-123',
        'app_feature',
        'feature-456',
        'Dashboard'
      );
      
      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('dev_tasks');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('dev_task_elements');
    });

    it('should handle task update failure', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ 
        data: null, 
        error: { message: 'Update failed' } 
      });
      
      const result = await service.linkElementToTask(
        'task-123',
        'app_feature',
        'feature-456',
        'Dashboard'
      );
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate required parameters', async () => {
      const result = await service.linkElementToTask('', 'app_feature', 'id', 'name');
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should ignore duplicate link errors', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ data: null, error: null });
      mockQueryBuilder.insert.mockResolvedValue({ 
        data: null, 
        error: { message: 'duplicate key value' } 
      });
      
      const result = await service.linkElementToTask(
        'task-123',
        'app_feature',
        'feature-456',
        'Dashboard'
      );
      
      expect(result).toBe(true);
    });
  });

  describe('Get Element Details', () => {
    const mockElement = {
      element_type: 'app_feature',
      element_id: '123',
      category: 'dhg-hub',
      subcategory: 'page',
      name: 'Dashboard'
    };

    it('should fetch element details', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: mockElement, error: null });
      
      const element = await service.getElementDetails('app_feature', '123');
      
      expect(element).toEqual(mockElement);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('element_type', 'app_feature');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('element_id', '123');
    });

    it('should handle not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Not found' } 
      });
      
      const element = await service.getElementDetails('app_feature', 'invalid');
      
      expect(element).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should track all operations', async () => {
      // Setup mocks
      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: [], error: null });
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });

      // Perform operations
      await service.getAppFeatures('test');
      await service.getCLICommands('test');
      await service.getSharedServices();

      const metrics = service.getMetrics();
      
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
      expect(metrics.totalErrors).toBe(0);
    });

    it('should track errors', async () => {
      (mockSupabaseClient.rpc as any).mockResolvedValue({ 
        data: null, 
        error: { message: 'Test error' } 
      });

      await service.getAppFeatures('test');
      
      const metrics = service.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.lastError).toBe('Test error');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (mockSupabaseClient.rpc as any).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const features = await service.getAppFeatures('test');
      
      expect(features).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(service.getMetrics().totalErrors).toBe(1);
    });

    it('should log appropriate error messages', async () => {
      mockQueryBuilder.order.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection lost' } 
      });

      await service.getSharedServices();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error fetching shared services',
        expect.objectContaining({ message: 'Database connection lost' })
      );
    });
  });
});