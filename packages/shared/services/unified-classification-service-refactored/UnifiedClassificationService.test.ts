/**
 * Tests for UnifiedClassificationService (Refactored)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedClassificationService } from './UnifiedClassificationService';
import { UnifiedClassificationServiceConfig, ClassificationOptions, SourceFile } from './types';

// Mock dependencies
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
} as any;

const mockGoogleDriveService = {
  downloadFile: vi.fn(),
  exportFile: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, details: {} }),
};

const mockPromptService = {
  loadPrompt: vi.fn().mockResolvedValue({ success: true }),
  usePromptWithClaude: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, details: {} }),
};

const mockClaudeService = {
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, details: {} }),
};

const mockPdfProcessorService = {
  processPdf: vi.fn(),
};

const mockFilterService = {
  applyFilterToQuery: vi.fn().mockImplementation((query) => query),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Global mock source file for tests
const mockSourceFile: SourceFile = {
  id: 'test-id',
  drive_id: 'drive-123',
  name: 'test-document.pdf',
  mime_type: 'application/pdf',
  size: 1000,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  content: 'Test content for classification',
  expert_document_id: null,
  document_type_id: null,
  is_classified: false,
  is_downloaded: true,
  is_processed: false,
  path: '/path/to/document.pdf',
  parent_id: 'parent-123'
};

const defaultConfig: UnifiedClassificationServiceConfig = {
  googleDriveService: mockGoogleDriveService,
  promptService: mockPromptService,
  claudeService: mockClaudeService,
  pdfProcessorService: mockPdfProcessorService,
  filterService: mockFilterService,
};

describe('UnifiedClassificationService', () => {
  let service: UnifiedClassificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UnifiedClassificationService(mockSupabase, defaultConfig, mockLogger);
  });

  describe('Constructor and Initialization', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeInstanceOf(UnifiedClassificationService);
    });

    it('should validate required config dependencies', () => {
      const invalidConfigs = [
        { ...defaultConfig, googleDriveService: undefined },
        { ...defaultConfig, promptService: undefined },
        { ...defaultConfig, claudeService: undefined },
        { ...defaultConfig, pdfProcessorService: undefined },
        { ...defaultConfig, filterService: undefined },
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => new UnifiedClassificationService(mockSupabase, config as any, mockLogger))
          .toThrow(/is required/);
      });
    });

    it('should initialize with default metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics.classificationsRequested).toBe(0);
      expect(metrics.classificationsCompleted).toBe(0);
      expect(metrics.classificationsFailed).toBe(0);
      expect(metrics.filesProcessed).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status when all dependencies are healthy', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details.databaseConnected).toBe(true);
      expect(health.details.googleDriveService).toBe(true);
      expect(health.details.promptService).toBe(true);
      expect(health.details.claudeService).toBe(true);
    });

    it('should return unhealthy status when database connection fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: new Error('DB connection failed') }),
        }),
      });

      const health = await service.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.details.databaseConnected).toBe(false);
    });

    it('should handle service health checks gracefully when services lack health check methods', async () => {
      const configWithoutHealthChecks = {
        ...defaultConfig,
        googleDriveService: { downloadFile: vi.fn(), exportFile: vi.fn() },
        promptService: { loadPrompt: vi.fn(), usePromptWithClaude: vi.fn() },
        claudeService: {},
      };

      const serviceWithoutHealthChecks = new UnifiedClassificationService(
        mockSupabase, 
        configWithoutHealthChecks as any, 
        mockLogger
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const health = await serviceWithoutHealthChecks.healthCheck();
      expect(health.healthy).toBe(false); // Services without health checks considered unhealthy
    });
  });

  describe('Metrics Tracking', () => {
    it('should track classification requests', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      await service.classifyDocuments({ limit: 10 });

      const metrics = service.getMetrics();
      expect(metrics.classificationsRequested).toBe(1);
    });

    it('should reset and accumulate metrics across multiple operations', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      await service.classifyDocuments({ limit: 5 });
      await service.classifyDocuments({ limit: 3 });

      const metrics = service.getMetrics();
      expect(metrics.classificationsRequested).toBe(2);
    });
  });

  describe('File Processing', () => {

    beforeEach(() => {
      // Setup default successful database response
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [mockSourceFile], error: null }),
          }),
        }),
      });
    });

    it('should handle empty file list gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await service.classifyDocuments({ limit: 10 });

      expect(result.totalFiles).toBe(0);
      expect(result.processedFiles).toBe(0);
      expect(result.successfulFiles).toBe(0);
      expect(result.failedFiles).toBe(0);
    });

    it('should skip already classified files when skipClassified is true', async () => {
      const classifiedFile = { ...mockSourceFile, document_type_id: 'existing-type-id' };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [classifiedFile], error: null }),
          }),
        }),
      });

      const result = await service.classifyDocuments({ 
        limit: 1, 
        skipClassified: true 
      });

      expect(result.skippedFiles).toBe(1);
      expect(result.processedFiles).toBe(0);
      const metrics = service.getMetrics();
      expect(metrics.filesSkipped).toBe(1);
    });

    it('should process files when content extraction succeeds', async () => {
      // Mock expert document content retrieval
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'google_sources') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [mockSourceFile], error: null }),
              }),
            }),
          };
        }
        if (table === 'google_expert_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { processed_content: 'Mock document content' }, 
                  error: null 
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      // Mock prompt and Claude services
      mockPromptService.usePromptWithClaude.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          document_type_id: 'test-type-123',
          name: 'Test Document Type',
          classification_confidence: 0.95,
          classification_reasoning: 'High confidence classification',
          document_summary: 'Test summary',
          key_topics: ['topic1', 'topic2'],
        }),
      });

      const result = await service.classifyDocuments({ 
        limit: 1,
        verbose: true 
      });

      expect(result.successfulFiles).toBe(1);
      expect(result.failedFiles).toBe(0);
      
      const metrics = service.getMetrics();
      expect(metrics.filesProcessed).toBe(1);
      expect(metrics.contentExtractionSuccesses).toBe(1);
      expect(metrics.claudeApiCalls).toBe(1);
      expect(metrics.promptsUsed).toBe(1);
    });

    it('should handle content extraction failures gracefully', async () => {
      // Mock file with expert document ID but no content
      const fileWithExpert = { ...mockSourceFile, expert_document_id: 'expert-doc-123' };
      
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'google_sources') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [fileWithExpert], error: null }),
              }),
            }),
          };
        }
        if (table === 'google_expert_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      // Mock Google Drive service to fail
      mockGoogleDriveService.downloadFile.mockRejectedValue(new Error('Download failed'));

      const result = await service.classifyDocuments({ limit: 1 });

      expect(result.failedFiles).toBe(1);
      expect(result.successfulFiles).toBe(0);
      
      const metrics = service.getMetrics();
      expect(metrics.contentExtractionFailures).toBe(1);
      expect(metrics.errors).toBeGreaterThan(0);
    });
  });

  describe('Prompt Selection', () => {
    it('should select appropriate prompts based on mime type', () => {
      const testCases = [
        { mimeType: 'application/pdf', fileName: 'test.pdf', expected: 'pdf-classification-prompt' },
        { mimeType: 'text/markdown', fileName: 'test.md', expected: 'markdown-document-classification-prompt' },
        { mimeType: 'video/mp4', fileName: 'test.mp4', expected: 'video-classification-prompt' },
        { mimeType: 'application/unknown', fileName: 'test.unknown', expected: 'document-classification-prompt-new' },
      ];

      testCases.forEach(({ mimeType, fileName, expected }) => {
        // Access private method through prototype for testing
        const prompt = (service as any).selectPrompt(mimeType, fileName);
        expect(prompt).toBe(expected);
      });
    });

    it('should handle special filename patterns', () => {
      const prompt = (service as any).selectPrompt('text/plain', 'meeting-transcript.txt');
      expect(prompt).toBe('transcript-classification-prompt');
    });

    it('should fallback to file extension when mime type is unknown', () => {
      const prompt = (service as any).selectPrompt('application/unknown', 'document.pdf');
      expect(prompt).toBe('pdf-classification-prompt');
    });
  });

  describe('Error Handling', () => {
    it('should handle database query errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
          }),
        }),
      });

      await expect(service.classifyDocuments({ limit: 1 }))
        .rejects.toThrow('Database error');

      const metrics = service.getMetrics();
      expect(metrics.classificationsFailed).toBe(1);
      expect(metrics.errors).toBe(1);
    });

    it('should track errors appropriately', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      // This should complete successfully but track the request
      await service.classifyDocuments({ limit: 1 });

      const metrics = service.getMetrics();
      expect(metrics.classificationsRequested).toBe(1);
      expect(metrics.classificationsFailed).toBe(0); // No files to fail on
    });
  });

  describe('Dry Run Mode', () => {
    it('should not save results in dry run mode', async () => {
      const fileWithContent = { ...mockSourceFile, expert_document_id: 'expert-123' };
      
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'google_sources') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [fileWithContent], error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'google_expert_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { processed_content: 'Test content' }, 
                  error: null 
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      mockPromptService.usePromptWithClaude.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          document_type_id: 'test-type',
          name: 'Test Type',
          classification_confidence: 0.9,
          classification_reasoning: 'Test reasoning',
        }),
      });

      await service.classifyDocuments({ 
        limit: 1, 
        dryRun: true, 
        verbose: true 
      });

      // Should not call database update operations in dry run
      const metrics = service.getMetrics();
      expect(metrics.databaseUpdates).toBe(0);
    });
  });

  describe('Concept Extraction', () => {
    it('should extract concepts from classification results', () => {
      const testClassifications = [
        {
          concepts: [{ name: 'AI', weight: 1.0 }, { name: 'ML', weight: 0.8 }],
        },
        {
          key_topics: ['topic1', 'topic2', 'topic3'],
        },
        {
          keyConcepts: ['concept1', 'concept2'],
        },
        {
          // No concepts
        },
      ];

      testClassifications.forEach((classification, index) => {
        const concepts = (service as any).extractConcepts(classification);
        
        if (index === 0) {
          expect(concepts).toEqual(classification.concepts);
        } else if (index === 1) {
          expect(concepts).toHaveLength(3);
          expect(concepts[0].name).toBe('topic1');
          expect(concepts[0].weight).toBe(1.0);
          expect(concepts[1].weight).toBe(0.9);
        } else if (index === 2) {
          expect(concepts).toHaveLength(2);
          expect(concepts[0].name).toBe('concept1');
        } else {
          expect(concepts).toHaveLength(0);
        }
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full classification pipeline with custom options', async () => {
      const mockFiles = [
        { ...mockSourceFile, id: '1', name: 'doc1.pdf' },
        { ...mockSourceFile, id: '2', name: 'doc2.md', mime_type: 'text/markdown' },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'google_sources') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockFiles, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'google_expert_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      // Mock Google Drive downloads
      mockGoogleDriveService.downloadFile.mockResolvedValue('/tmp/mock-file');
      mockPdfProcessorService.processPdf.mockResolvedValue({
        success: true,
        content: 'Mock PDF content',
        metadata: { pages: 10 },
      });
      mockGoogleDriveService.exportFile.mockResolvedValue('Mock markdown content');

      // Mock successful classifications
      mockPromptService.usePromptWithClaude.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          document_type_id: 'classified-type',
          name: 'Classified Type',
          classification_confidence: 0.92,
          classification_reasoning: 'Successful classification',
          key_topics: ['ai', 'ml', 'nlp'],
        }),
      });

      const result = await service.classifyDocuments({
        types: ['pdf', 'md'],
        limit: 10,
        concurrency: 2,
        verbose: true,
      });

      expect(result.totalFiles).toBe(2);
      expect(result.successfulFiles).toBe(2);
      expect(result.failedFiles).toBe(0);

      const metrics = service.getMetrics();
      expect(metrics.filesProcessed).toBe(2);
      expect(metrics.contentExtractionSuccesses).toBe(2);
      expect(metrics.claudeApiCalls).toBe(2);
      expect(metrics.databaseUpdates).toBe(2);
    });
  });
});