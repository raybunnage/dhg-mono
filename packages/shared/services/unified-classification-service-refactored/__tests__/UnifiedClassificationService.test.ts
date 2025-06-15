import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedClassificationService } from '../UnifiedClassificationService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';
import { 
  ClassificationOptions, 
  ClassificationResult,
  SupportedFileType
} from '../types';

// Mock dependencies
vi.mock('fs');
vi.mock('path');

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
    rpc: vi.fn().mockResolvedValue({ data: [], error: null })
  } as unknown as SupabaseClient;
};

// Mock logger
const createMockLogger = (): Logger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

// Mock Claude service
const createMockClaudeService = () => ({
  sendPrompt: vi.fn().mockResolvedValue('Classification result'),
  getJsonResponse: vi.fn().mockResolvedValue({
    document_type_id: 'doc-type-1',
    document_type_name: 'Research Paper',
    confidence: 0.85,
    concepts: ['AI', 'Machine Learning']
  }),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true })
});

// Mock Prompt service
const createMockPromptService = () => ({
  loadPrompt: vi.fn().mockResolvedValue({
    content: 'Classify this document: {{content}}',
    variables: ['content']
  }),
  getAllPrompts: vi.fn().mockResolvedValue([])
});

describe('UnifiedClassificationService', () => {
  let service: UnifiedClassificationService;
  let mockSupabase: SupabaseClient;
  let mockLogger: Logger;
  let mockClaudeService: any;
  let mockPromptService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockLogger = createMockLogger();
    mockClaudeService = createMockClaudeService();
    mockPromptService = createMockPromptService();
    
    service = new UnifiedClassificationService(
      mockSupabase,
      mockClaudeService,
      mockPromptService,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      expect(service).toBeInstanceOf(UnifiedClassificationService);
      expect(service['serviceName']).toBe('UnifiedClassificationService');
    });

    it('should throw error when dependencies are missing', () => {
      expect(() => new UnifiedClassificationService(null as any, mockClaudeService, mockPromptService))
        .toThrow('SupabaseClient is required');
      
      expect(() => new UnifiedClassificationService(mockSupabase, null as any, mockPromptService))
        .toThrow('ClaudeService is required');
        
      expect(() => new UnifiedClassificationService(mockSupabase, mockClaudeService, null as any))
        .toThrow('PromptService is required');
    });
  });

  describe('classifyFile', () => {
    it('should classify a supported file type', async () => {
      const filePath = '/path/to/document.pdf';
      const fileId = 'file-123';
      const options: ClassificationOptions = {
        forceReclassify: false,
        saveToDatabase: true
      };

      const expectedResult: ClassificationResult = {
        fileId,
        fileName: 'document.pdf',
        mimeType: 'application/pdf',
        documentTypeId: 'doc-type-1',
        documentTypeName: 'Research Paper',
        confidence: 0.85,
        concepts: [
          { name: 'AI', relevance_score: 0.9 },
          { name: 'Machine Learning', relevance_score: 0.8 }
        ],
        reasoning: 'Classified based on content analysis',
        processingTime: 1000,
        success: true
      };

      // Mock file existence check
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        size: 1000
      } as any);

      const result = await service.classifyFile(filePath, fileId, options);

      expect(result.success).toBe(true);
      expect(result.documentTypeId).toBe('doc-type-1');
      expect(result.documentTypeName).toBe('Research Paper');
    });

    it('should handle unsupported file types', async () => {
      const filePath = '/path/to/file.xyz';
      const fileId = 'file-123';

      const result = await service.classifyFile(filePath, fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should skip already classified files when forceReclassify is false', async () => {
      const filePath = '/path/to/document.pdf';
      const fileId = 'file-123';

      // Mock existing classification
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'existing-id',
            document_type_id: 'doc-type-1',
            document_type_name: 'Existing Type'
          },
          error: null
        })
      }));
      mockSupabase.from = mockFrom;

      const result = await service.classifyFile(filePath, fileId, {
        forceReclassify: false
      });

      expect(result.documentTypeId).toBe('doc-type-1');
      expect(result.skipped).toBe(true);
    });
  });

  describe('classifyBatch', () => {
    it('should classify multiple files', async () => {
      const files = [
        { path: '/path/to/doc1.pdf', fileId: 'file-1' },
        { path: '/path/to/doc2.pdf', fileId: 'file-2' }
      ];

      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        size: 1000
      } as any);

      const results = await service.classifyBatch(files);

      expect(results.results).toHaveLength(2);
      expect(results.totalProcessed).toBe(2);
      expect(results.successful).toBe(2);
    });

    it('should handle batch with mixed success/failure', async () => {
      const files = [
        { path: '/path/to/doc1.pdf', fileId: 'file-1' },
        { path: '/path/to/bad.xyz', fileId: 'file-2' }
      ];

      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        size: 1000
      } as any);

      const results = await service.classifyBatch(files);

      expect(results.totalProcessed).toBe(2);
      expect(results.successful).toBe(1);
      expect(results.failed).toBe(1);
    });
  });

  describe('extractContent', () => {
    it('should extract content from supported file', async () => {
      const filePath = '/path/to/document.txt';
      const mimeType = 'text/plain';

      const fs = await import('fs');
      vi.mocked(fs.readFileSync).mockReturnValue('File content');

      const result = await service['extractContent'](filePath, mimeType);

      expect(result.success).toBe(true);
      expect(result.content).toBe('File content');
    });

    it('should handle content extraction errors', async () => {
      const filePath = '/path/to/document.txt';
      const mimeType = 'text/plain';

      const fs = await import('fs');
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = await service['extractContent'](filePath, mimeType);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Read error');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when all dependencies are healthy', async () => {
      const result = await service.healthCheck();

      expect(result).toMatchObject({
        healthy: true,
        serviceName: 'UnifiedClassificationService',
        timestamp: expect.any(Date),
        details: {
          dependencies: {
            supabase: true,
            claude: true,
            prompts: true
          },
          metrics: expect.any(Object)
        }
      });
    });

    it('should return unhealthy when claude service is unhealthy', async () => {
      mockClaudeService.healthCheck.mockResolvedValue({ healthy: false });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details.dependencies.claude).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return current service metrics', () => {
      // Perform some operations to update metrics
      service['metrics'].classificationsRequested = 10;
      service['metrics'].classificationsCompleted = 8;
      service['metrics'].classificationsFailed = 2;

      const metrics = service.getMetrics();

      expect(metrics).toMatchObject({
        classificationsRequested: 10,
        classificationsCompleted: 8,
        classificationsFailed: 2
      });
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', () => {
      // Add some items to cache
      service['classificationCache'].set('key1', {} as any);
      service['contentCache'].set('key2', 'content');

      service.clearCache();

      expect(service['classificationCache'].size).toBe(0);
      expect(service['contentCache'].size).toBe(0);
    });
  });

  describe('getDocumentTypes', () => {
    it('should fetch document types from database', async () => {
      const mockTypes = [
        { id: '1', name: 'Type 1' },
        { id: '2', name: 'Type 2' }
      ];

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockTypes,
          error: null
        })
      }));
      mockSupabase.from = mockFrom;

      const types = await service.getDocumentTypes();

      expect(types).toEqual(mockTypes);
      expect(mockFrom).toHaveBeenCalledWith('document_types');
    });

    it('should handle database errors', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      }));
      mockSupabase.from = mockFrom;

      const types = await service.getDocumentTypes();

      expect(types).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSupportedFileTypes', () => {
    it('should return list of supported file types', () => {
      const supportedTypes = service.getSupportedFileTypes();

      expect(supportedTypes).toContain('pdf');
      expect(supportedTypes).toContain('txt');
      expect(supportedTypes).toContain('md');
      expect(supportedTypes).toContain('json');
      expect(supportedTypes).toContain('mp3');
    });
  });

  describe('isSupportedFileType', () => {
    it('should return true for supported types', () => {
      expect(service.isSupportedFileType('application/pdf')).toBe(true);
      expect(service.isSupportedFileType('text/plain')).toBe(true);
      expect(service.isSupportedFileType('audio/mpeg')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(service.isSupportedFileType('application/unknown')).toBe(false);
      expect(service.isSupportedFileType('video/mp4')).toBe(false);
    });
  });
});