/**
 * DocumentService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentService } from './DocumentService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock document type service
const mockDocumentTypeService = {
  getDocumentTypeById: vi.fn()
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe('DocumentService', () => {
  let service: DocumentService;
  let mockSelect: any;
  let mockOrder: any;
  let mockLimit: any;
  let mockIs: any;
  let mockUpdate: any;
  let mockEq: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup query chain mocks
    mockEq = vi.fn(() => ({ error: null }));
    mockUpdate = vi.fn(() => ({ eq: mockEq }));
    mockLimit = vi.fn(() => ({ data: [], error: null }));
    mockIs = vi.fn(() => ({ order: mockOrder }));
    mockOrder = vi.fn(() => ({ limit: mockLimit }));
    mockSelect = vi.fn(() => ({ 
      order: mockOrder,
      limit: mockLimit,
      is: mockIs
    }));

    (mockSupabase.from as any).mockReturnValue({
      select: mockSelect,
      update: mockUpdate
    });

    service = new DocumentService(
      mockSupabase,
      mockDocumentTypeService,
      mockLogger as any,
      { defaultLimit: 10 }
    );
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      mockSelect.mockReturnValue({ 
        limit: vi.fn(() => ({ error: null }))
      });
      
      await expect(service['initialize']()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('DocumentService initializing...');
      expect(mockLogger.info).toHaveBeenCalledWith('DocumentService initialized successfully');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      mockSelect.mockReturnValue({ 
        limit: vi.fn(() => ({ error }))
      });
      
      await expect(service['initialize']()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize DocumentService:', expect.any(Error));
    });

    it('should cleanup successfully', async () => {
      await service['cleanup']();
      expect(mockLogger.info).toHaveBeenCalledWith('DocumentService cleaning up...');
      expect(mockLogger.info).toHaveBeenCalledWith('DocumentService cleanup completed');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when database is accessible', async () => {
      mockSelect.mockReturnValue({ 
        limit: vi.fn(() => ({ error: null }))
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.database).toBe('connected');
      expect(health.details.metrics).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when database has errors', async () => {
      const error = { message: 'Connection timeout' };
      mockSelect.mockReturnValue({ 
        limit: vi.fn(() => ({ error }))
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.database).toBe('error: Connection timeout');
    });
  });

  describe('getRecentDocuments', () => {
    const mockDocuments = [
      {
        id: '1',
        file_path: '/docs/doc1.md',
        title: 'Document 1',
        document_type_id: 'type1',
        created_at: '2024-01-01',
        updated_at: '2024-01-02'
      },
      {
        id: '2',
        file_path: '/docs/doc2.md',
        title: 'Document 2',
        document_type_id: 'type2',
        created_at: '2024-01-01',
        updated_at: '2024-01-03'
      }
    ];

    it('should fetch recent documents successfully', async () => {
      mockLimit.mockReturnValue({ data: mockDocuments, error: null });

      const result = await service.getRecentDocuments();
      
      expect(result).toEqual(mockDocuments);
      expect(mockSupabase.from).toHaveBeenCalledWith('documentation_files');
      expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(10); // Using config defaultLimit
    });

    it('should use custom limit when provided', async () => {
      mockLimit.mockReturnValue({ data: mockDocuments, error: null });

      await service.getRecentDocuments(5);
      
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('should enhance documents with type information', async () => {
      mockLimit.mockReturnValue({ data: mockDocuments, error: null });
      mockDocumentTypeService.getDocumentTypeById
        .mockResolvedValueOnce({ id: 'type1', name: 'Type 1' })
        .mockResolvedValueOnce({ id: 'type2', name: 'Type 2' });

      const result = await service.getRecentDocuments();
      
      expect(result[0].document_type).toEqual({ id: 'type1', name: 'Type 1' });
      expect(result[1].document_type).toEqual({ id: 'type2', name: 'Type 2' });
      expect(mockDocumentTypeService.getDocumentTypeById).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors', async () => {
      const error = { message: 'Query failed' };
      mockLimit.mockReturnValue({ data: null, error });

      await expect(service.getRecentDocuments()).rejects.toThrow('Failed to fetch recent documents: Query failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track metrics', async () => {
      mockLimit.mockReturnValue({ data: mockDocuments, error: null });

      await service.getRecentDocuments();
      const metrics = service.getMetrics();
      
      expect(metrics.totalQueries).toBe(1);
      expect(metrics.lastQueryTime).toBeInstanceOf(Date);
    });
  });

  describe('getUntypedDocuments', () => {
    const mockUntypedDocs = [
      {
        id: '3',
        file_path: '/docs/untyped.md',
        title: 'Untyped Document',
        document_type_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-04'
      }
    ];

    it('should fetch untyped documents successfully', async () => {
      mockLimit.mockReturnValue({ data: mockUntypedDocs, error: null });

      const result = await service.getUntypedDocuments();
      
      expect(result).toEqual(mockUntypedDocs);
      expect(mockIs).toHaveBeenCalledWith('document_type_id', null);
    });

    it('should handle empty results', async () => {
      mockLimit.mockReturnValue({ data: [], error: null });

      const result = await service.getUntypedDocuments();
      
      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith('Found 0 untyped documents');
    });
  });

  describe('updateDocumentType', () => {
    it('should update document type successfully', async () => {
      mockEq.mockReturnValue({ error: null });

      const result = await service.updateDocumentType('doc1', 'type1', { source: 'manual' });
      
      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        document_type_id: 'type1',
        metadata: { source: 'manual' },
        updated_at: expect.any(String)
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'doc1');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully updated document doc1 with type type1');
    });

    it('should handle update errors', async () => {
      const error = { message: 'Update failed' };
      mockEq.mockReturnValue({ error });

      await expect(service.updateDocumentType('doc1', 'type1'))
        .rejects.toThrow('Failed to update document type: Update failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track update metrics', async () => {
      mockEq.mockReturnValue({ error: null });

      await service.updateDocumentType('doc1', 'type1');
      const metrics = service.getMetrics();
      
      expect(metrics.totalUpdates).toBe(1);
      expect(metrics.lastUpdateTime).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should increment error count on failures', async () => {
      const error = { message: 'Database error' };
      mockLimit.mockReturnValue({ data: null, error });

      try {
        await service.getRecentDocuments();
      } catch (e) {
        // Expected error
      }

      const metrics = service.getMetrics();
      expect(metrics.errorCount).toBe(1);
    });

    it('should handle enhancement errors gracefully', async () => {
      const mockDocs = [{ id: '1', document_type_id: 'type1' }];
      mockLimit.mockReturnValue({ data: mockDocs, error: null });
      mockDocumentTypeService.getDocumentTypeById.mockRejectedValue(new Error('Type service error'));

      const result = await service.getRecentDocuments();
      
      // Should return documents without enhancement
      expect(result).toEqual(mockDocs);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Business Service Pattern', () => {
    it('should accept dependencies through constructor', () => {
      const customService = new DocumentService(
        mockSupabase,
        null, // No document type service
        undefined, // No logger
        { defaultLimit: 50 }
      );

      expect(customService).toBeInstanceOf(DocumentService);
    });

    it('should work without document type service', async () => {
      const serviceWithoutTypes = new DocumentService(mockSupabase);
      mockLimit.mockReturnValue({ data: [{ id: '1' }], error: null });

      const result = await serviceWithoutTypes.getRecentDocuments();
      
      expect(result).toEqual([{ id: '1' }]);
      expect(mockDocumentTypeService.getDocumentTypeById).not.toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should return a copy of metrics', () => {
      const metrics1 = service.getMetrics();
      const metrics2 = service.getMetrics();
      
      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });

    it('should track all operations', async () => {
      mockLimit.mockReturnValue({ data: [], error: null });
      mockEq.mockReturnValue({ error: null });

      await service.getRecentDocuments();
      await service.getUntypedDocuments();
      await service.updateDocumentType('doc1', 'type1');

      const metrics = service.getMetrics();
      expect(metrics.totalQueries).toBe(2);
      expect(metrics.totalUpdates).toBe(1);
      expect(metrics.errorCount).toBe(0);
    });
  });
});