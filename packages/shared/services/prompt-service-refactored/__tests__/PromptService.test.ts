/**
 * PromptService Tests
 * 
 * Tests the PromptService singleton that manages AI prompts across the application,
 * including prompt retrieval, relationships, metadata extraction, and database queries.
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { PromptService } from '../PromptService';

// Mock dependencies
vi.mock('../../../services/supabase-client', () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => mockSupabaseClient)
    }))
  }
}));

vi.mock('../../file-service/file-service', () => ({
  FileService: vi.fn(() => ({
    readFile: vi.fn(),
    fileExists: vi.fn()
  }))
}));

vi.mock('@shared/services/claude-service', () => ({
  claudeService: {
    sendPrompt: vi.fn(),
    getJsonResponse: vi.fn()
  }
}));

vi.mock('../prompt-output-templates', () => ({
  promptOutputTemplateService: {
    getAllTemplates: vi.fn(() => []),
    getTemplatesForPrompt: vi.fn(() => [])
  }
}));

// Mock Node.js dependencies for testing
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((path) => `/resolved/${path}`),
  isAbsolute: vi.fn((path) => path.startsWith('/'))
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  rpc: vi.fn()
};

describe('PromptService', () => {
  let service: PromptService;

  // Sample test data
  const samplePrompt = {
    id: 'prompt-1',
    name: 'test-prompt',
    content: 'This is a test prompt with some {{variable}} placeholders',
    description: 'A test prompt for unit testing',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: { category: 'test', version: '1.0' }
  };

  const sampleRelationship = {
    id: 'rel-1',
    prompt_id: 'prompt-1',
    asset_path: '/path/to/asset.md',
    relationship_type: 'input',
    relationship_context: 'test context',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
    mockSupabaseClient.limit.mockReturnThis();
    
    // Create service instance
    service = PromptService.getInstance({
      enableCaching: false, // Disable caching for predictable tests
      environment: 'node'
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = PromptService.getInstance();
      const service2 = PromptService.getInstance();
      expect(service1).toBe(service2);
    });

    it('should initialize successfully', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(service.ensureInitialized()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when database is accessible', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: null,
        error: null
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        totalPromptsLoaded: expect.any(Number),
        cacheSize: expect.any(Number),
        supabaseConnected: true
      });
    });

    it('should return unhealthy status when database error occurs', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabaseClient.limit.mockResolvedValue({
        data: null,
        error: dbError
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Database connection failed');
    });
  });

  describe('Prompt Loading', () => {
    it('should load prompt by name', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const result = await service.loadPrompt('test-prompt');
      
      expect(result.prompt).toEqual(samplePrompt);
      expect(result.combinedContent).toContain('This is a test prompt');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('name', 'test-prompt');
    });

    it('should load prompt by ID', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const result = await service.loadPromptById('prompt-1');
      
      expect(result.prompt).toEqual(samplePrompt);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'prompt-1');
    });

    it('should handle missing prompts gracefully', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Prompt not found' }
      });

      const result = await service.loadPrompt('nonexistent');
      
      expect(result.prompt).toBeNull();
      expect(result.combinedContent).toBe('');
      expect(result.relationships).toHaveLength(0);
    });

    it('should load prompts with relationships', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [sampleRelationship],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        includeRelationships: true
      });
      
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0]).toEqual(sampleRelationship);
    });

    it('should load prompts with related files', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('# Related file content\nThis is markdown content');

      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [sampleRelationship],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        includeRelationships: true,
        includeRelatedFiles: true
      });
      
      expect(result.relatedFiles).toHaveLength(1);
      expect(result.relatedFiles[0].content).toContain('Related file content');
      expect(result.relatedFiles[0].stats).toMatchObject({
        lines: expect.any(Number),
        size: expect.any(Number)
      });
    });
  });

  describe('Database Queries', () => {
    it('should execute database queries from prompt metadata', async () => {
      const promptWithQueries = {
        ...samplePrompt,
        metadata: {
          queries: {
            'recent_files': 'SELECT * FROM files ORDER BY created_at DESC LIMIT 5'
          }
        }
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: promptWithQueries,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ id: 1, name: 'file1' }, { id: 2, name: 'file2' }],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        includeDatabaseQueries: true,
        executeQueries: true
      });
      
      expect(result.databaseQueries).toHaveLength(1);
      expect(result.databaseQueries[0].queryName).toBe('recent_files');
      expect(result.databaseQueries[0].queryResults).toHaveLength(2);
    });

    it('should handle query execution errors gracefully', async () => {
      const promptWithQueries = {
        ...samplePrompt,
        metadata: {
          queries: {
            'invalid_query': 'SELECT * FROM nonexistent_table'
          }
        }
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: promptWithQueries,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Table does not exist' }
      });

      const result = await service.loadPrompt('test-prompt', {
        includeDatabaseQueries: true,
        executeQueries: true
      });
      
      expect(result.databaseQueries).toHaveLength(1);
      expect(result.databaseQueries[0].queryResults).toBeNull();
    });
  });

  describe('Prompt Templates', () => {
    it('should load output templates when requested', async () => {
      const { promptOutputTemplateService } = require('../prompt-output-templates');
      promptOutputTemplateService.getTemplatesForPrompt.mockReturnValue([
        {
          id: 'template-1',
          name: 'JSON Output',
          template: { format: 'json', schema: {} },
          priority: 1
        }
      ]);

      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        includeOutputTemplates: true
      });
      
      expect(result.outputTemplates).toHaveLength(1);
      expect(result.outputTemplates![0].name).toBe('JSON Output');
    });
  });

  describe('Variable Replacement', () => {
    it('should replace variables in combined content', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const result = await service.loadPrompt('test-prompt');
      const processedContent = await service.processPromptVariables(
        result.combinedContent,
        { variable: 'TEST_VALUE' }
      );
      
      expect(processedContent).toContain('TEST_VALUE');
      expect(processedContent).not.toContain('{{variable}}');
    });

    it('should handle missing variables gracefully', async () => {
      const contentWithMissingVars = 'Hello {{missing_var}} and {{another_missing}}';
      
      const processedContent = await service.processPromptVariables(
        contentWithMissingVars,
        { existing_var: 'value' }
      );
      
      // Should keep original placeholder if variable not provided
      expect(processedContent).toContain('{{missing_var}}');
      expect(processedContent).toContain('{{another_missing}}');
    });
  });

  describe('Caching', () => {
    it('should cache prompts when caching is enabled', async () => {
      const cachedService = PromptService.getInstance({
        enableCaching: true,
        cacheTimeout: 1000
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      // First load
      await cachedService.loadPrompt('test-prompt');
      
      // Second load should use cache
      await cachedService.loadPrompt('test-prompt');
      
      // Should only hit database once
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', () => {
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  describe('Service Metrics', () => {
    it('should track service metrics', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [sampleRelationship],
        error: null
      });

      await service.loadPrompt('test-prompt', {
        includeRelationships: true
      });

      const metrics = await service.getMetrics();
      
      expect(metrics.totalPromptsLoaded).toBeGreaterThan(0);
      expect(metrics.totalRelationshipsLoaded).toBeGreaterThan(0);
      expect(metrics.lastActivity).toBeInstanceOf(Date);
    });

    it('should calculate average load times', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      // Load multiple prompts to test averaging
      await service.loadPrompt('test-prompt-1');
      await service.loadPrompt('test-prompt-2');

      const metrics = await service.getMetrics();
      
      expect(metrics.averageLoadTime).toBeGreaterThan(0);
    });
  });

  describe('Environment Detection', () => {
    it('should detect Node.js environment', () => {
      // Access private method for testing
      const environment = (service as any).detectEnvironment();
      expect(environment).toBe('node');
    });

    it('should handle file operations in Node.js environment', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('File content');

      const content = await (service as any).readFileFromDisk('/test/path.md');
      
      expect(content).toBe('File content');
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/path.md', 'utf8');
    });

    it('should handle browser environment gracefully', () => {
      const browserService = PromptService.getInstance({
        environment: 'browser'
      });

      expect(() => {
        (browserService as any).envAdapter.readFileSync('/test/path.md', 'utf8');
      }).toThrow('File system access not supported in browser environment');
    });
  });

  describe('Complex Loading Scenarios', () => {
    it('should load all prompt data when returnAll is true', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('Related content');

      const promptWithQueries = {
        ...samplePrompt,
        metadata: {
          queries: {
            'test_query': 'SELECT 1 as test'
          }
        }
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: promptWithQueries,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [sampleRelationship],
        error: null
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ test: 1 }],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        returnAll: true
      });
      
      expect(result.prompt).toBeTruthy();
      expect(result.relationships).toHaveLength(1);
      expect(result.relatedFiles).toHaveLength(1);
      expect(result.databaseQueries).toHaveLength(1);
      expect(result.combinedContent).toContain('This is a test prompt');
    });

    it('should return markdown formatted content when requested', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        returnAsMarkdown: true
      });
      
      expect(result.combinedContent).toContain('# Prompt: test-prompt');
      expect(result.combinedContent).toContain('## Content');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabaseClient.single.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      await expect(service.loadPrompt('test-prompt')).rejects.toThrow('Database connection lost');
    });

    it('should handle malformed metadata gracefully', async () => {
      const promptWithBadMetadata = {
        ...samplePrompt,
        metadata: 'invalid-json-string'
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: promptWithBadMetadata,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        includeDatabaseQueries: true
      });
      
      // Should handle gracefully without crashing
      expect(result.prompt).toBeTruthy();
      expect(result.databaseQueries).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: samplePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [sampleRelationship],
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        includeRelatedFiles: true
      });
      
      // Should continue processing other parts even if file read fails
      expect(result.prompt).toBeTruthy();
      expect(result.relatedFiles).toHaveLength(0); // File read failed
    });
  });

  describe('Performance', () => {
    it('should handle large prompt loads efficiently', async () => {
      const largePrompt = {
        ...samplePrompt,
        content: 'Large content '.repeat(1000)
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: largePrompt,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const startTime = Date.now();
      const result = await service.loadPrompt('large-prompt');
      const endTime = Date.now();
      
      expect(result.prompt).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should limit database query results appropriately', async () => {
      const promptWithLimitedQuery = {
        ...samplePrompt,
        metadata: {
          queries: {
            'limited_query': 'SELECT * FROM large_table'
          }
        }
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: promptWithLimitedQuery,
        error: null
      });
      
      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      mockSupabaseClient.rpc.mockResolvedValue({
        data: largeDataset,
        error: null
      });

      const result = await service.loadPrompt('test-prompt', {
        executeQueries: true
      });
      
      // Service should handle large datasets appropriately
      expect(result.databaseQueries[0].queryResults).toBeTruthy();
    });
  });
});