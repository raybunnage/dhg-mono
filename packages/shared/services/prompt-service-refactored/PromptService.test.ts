/**
 * PromptService Tests
 * Comprehensive test suite for the refactored PromptService
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { PromptService } from './PromptService';
import type { Prompt, PromptRelationship, PromptLoadOptions, PromptLoadResult } from './PromptService';

// Mock dependencies
vi.mock('../../services/supabase-client', () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => mockSupabaseClient)
    }))
  }
}));

vi.mock('../file-service/file-service', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    readFile: vi.fn(),
    getFileStats: vi.fn()
  }))
}));

vi.mock('@shared/services/claude-service', () => ({
  claudeService: {
    getJsonResponse: vi.fn()
  }
}));

vi.mock('./prompt-output-templates', () => ({
  promptOutputTemplateService: {
    getTemplatesForPrompt: vi.fn()
  }
}));

// Mock Node.js modules
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((p) => p),
  isAbsolute: vi.fn((p) => p.startsWith('/'))
}));

// Create mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn()
  })),
  rpc: vi.fn()
};

// Import mocked modules
import { FileService } from '../file-service/file-service';
import { claudeService } from '@shared/services/claude-service';
import { promptOutputTemplateService } from './prompt-output-templates';
import * as fs from 'fs';
import * as path from 'path';

// Test data
const mockPrompt: Prompt = {
  id: 'test-prompt-id',
  name: 'test-prompt',
  content: 'This is a test prompt content',
  description: 'Test prompt description',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  metadata: { test: true }
};

const mockRelationship: PromptRelationship = {
  id: 'rel-1',
  prompt_id: 'test-prompt-id',
  asset_path: '/test/path/file.ts',
  relationship_type: 'file',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

describe('PromptService', () => {
  let promptService: PromptService;
  let mockFileService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset singleton instance
    (PromptService as any).instance = undefined;
    
    // Get mock file service instance
    mockFileService = new (FileService as any)();
    
    // Default mock responses
    const mockFrom = mockSupabaseClient.from as Mock;
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    });
  });

  afterEach(async () => {
    if (promptService) {
      await promptService.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = PromptService.getInstance();
      const instance2 = PromptService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      const config = {
        environment: 'node' as const,
        enableCaching: false,
        cacheTimeout: 10000
      };
      
      const instance = PromptService.getInstance(config);
      expect(instance).toBeInstanceOf(PromptService);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(() => {
      promptService = PromptService.getInstance();
    });

    it('should initialize successfully', async () => {
      await expect(promptService.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database error'))
      });

      await expect(promptService.initialize()).rejects.toThrow('Database error');
    });

    it('should shutdown cleanly', async () => {
      await promptService.initialize();
      await expect(promptService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should return healthy status when database is accessible', async () => {
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      const health = await promptService.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details.databaseConnection).toBe(true);
      expect(health.details.cacheSize).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when database is not accessible', async () => {
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Connection failed') })
      });

      const health = await promptService.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.details.databaseConnection).toBe(false);
    });
  });

  describe('Prompt Retrieval', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance({ enableCaching: true });
      await promptService.initialize();
    });

    describe('getPromptByName', () => {
      it('should retrieve prompt from database successfully', async () => {
        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockPrompt, error: null })
        });

        const prompt = await promptService.getPromptByName('test-prompt');
        
        expect(prompt).toEqual(mockPrompt);
        expect(mockFrom).toHaveBeenCalledWith('ai_prompts');
      });

      it('should cache prompts when caching is enabled', async () => {
        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockPrompt, error: null })
        });

        // First call - should hit database
        const prompt1 = await promptService.getPromptByName('test-prompt');
        expect(mockFrom).toHaveBeenCalledTimes(1);

        // Second call - should hit cache
        const prompt2 = await promptService.getPromptByName('test-prompt');
        expect(mockFrom).toHaveBeenCalledTimes(1); // Not called again
        expect(prompt2).toEqual(prompt1);

        // Check metrics
        const metrics = promptService.getMetrics();
        expect(metrics.cacheHits).toBe(1);
        expect(metrics.cacheMisses).toBe(1);
      });

      it('should fall back to file system in Node environment', async () => {
        // Create Node environment service
        const nodeService = PromptService.getInstance({ environment: 'node' });
        await nodeService.initialize();

        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        });

        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue('File system prompt content');

        const prompt = await nodeService.getPromptByName('test-prompt');
        
        expect(prompt).toBeDefined();
        expect(prompt?.content).toBe('File system prompt content');
        expect(prompt?.id).toContain('file_');
      });

      it('should handle prompt not found', async () => {
        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        });

        (fs.existsSync as Mock).mockReturnValue(false);

        const prompt = await promptService.getPromptByName('non-existent');
        expect(prompt).toBeNull();
      });
    });

    describe('getAllPrompts', () => {
      it('should retrieve all prompts from database', async () => {
        const mockPrompts = [mockPrompt, { ...mockPrompt, id: '2', name: 'prompt-2' }];
        
        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockPrompts, error: null })
        });

        const prompts = await promptService.getAllPrompts();
        
        expect(prompts).toHaveLength(2);
        expect(prompts[0]).toEqual(mockPrompt);
      });

      it('should handle database errors', async () => {
        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
        });

        await expect(promptService.getAllPrompts()).rejects.toThrow('Database error');
      });
    });
  });

  describe('Prompt Relationships', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should retrieve prompt relationships', async () => {
      const mockRelationships = [mockRelationship];
      
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRelationships, error: null })
      });

      const relationships = await promptService.getPromptRelationships('test-prompt-id');
      
      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual(mockRelationship);
    });
  });

  describe('Database Query Execution', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should execute database queries from prompt content', async () => {
      const promptContent = `
        Here is a query:
        \`\`\`sql:testQuery
        SELECT * FROM test_table
        \`\`\`
      `;

      const mockRpc = mockSupabaseClient.rpc as Mock;
      mockRpc.mockResolvedValue({
        data: [{ id: 1, name: 'test' }],
        error: null
      });

      const results = await promptService.executeDatabaseQueries(promptContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].queryName).toBe('testQuery');
      expect(results[0].queryText).toBe('SELECT * FROM test_table');
      expect(results[0].queryResults).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should handle query execution errors', async () => {
      const promptContent = `
        \`\`\`sql:failingQuery
        SELECT * FROM non_existent_table
        \`\`\`
      `;

      const mockRpc = mockSupabaseClient.rpc as Mock;
      mockRpc.mockResolvedValue({
        data: null,
        error: new Error('Table not found')
      });

      const results = await promptService.executeDatabaseQueries(promptContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].queryResults.error).toBe('Table not found');
    });
  });

  describe('Prompt Loading', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should load prompt with all options', async () => {
      // Mock prompt retrieval
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockImplementation((table) => {
        if (table === 'ai_prompts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockPrompt, error: null })
          };
        }
        if (table === 'prompt_template_associations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockRelationship], error: null })
          };
        }
      });

      // Mock file service
      mockFileService.readFile.mockResolvedValue('File content');
      mockFileService.getFileStats.mockResolvedValue({ size: 100 });

      // Mock output templates
      (promptOutputTemplateService.getTemplatesForPrompt as Mock).mockResolvedValue([
        { id: 'template-1', name: 'Template 1', template: {}, priority: 1 }
      ]);

      const options: PromptLoadOptions = {
        includeRelationships: true,
        includeRelatedFiles: true,
        includeOutputTemplates: true,
        returnAsMarkdown: true
      };

      const result = await promptService.loadPrompt('test-prompt', options);
      
      expect(result.prompt).toEqual(mockPrompt);
      expect(result.relationships).toHaveLength(1);
      expect(result.relatedFiles).toHaveLength(1);
      expect(result.outputTemplates).toHaveLength(1);
      expect(result.combinedContent).toContain('# test-prompt');
      expect(result.combinedContent).toContain('File content');
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    describe('createPrompt', () => {
      it('should create a new prompt', async () => {
        const newPrompt = {
          name: 'new-prompt',
          content: 'New prompt content'
        };

        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { ...newPrompt, id: 'new-id', created_at: '2024-01-01', updated_at: '2024-01-01' }, 
            error: null 
          })
        });

        const created = await promptService.createPrompt(newPrompt);
        
        expect(created.id).toBe('new-id');
        expect(created.name).toBe('new-prompt');
      });
    });

    describe('updatePrompt', () => {
      it('should update an existing prompt', async () => {
        const updates = { content: 'Updated content' };

        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { ...mockPrompt, ...updates }, 
            error: null 
          })
        });

        const updated = await promptService.updatePrompt('test-prompt-id', updates);
        
        expect(updated.content).toBe('Updated content');
      });
    });

    describe('deletePrompt', () => {
      it('should delete a prompt', async () => {
        const mockFrom = mockSupabaseClient.from as Mock;
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { name: 'test-prompt' }, error: null }),
          delete: vi.fn().mockReturnThis()
        });

        await expect(promptService.deletePrompt('test-prompt-id')).resolves.not.toThrow();
      });
    });
  });

  describe('Metadata Extraction', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should extract metadata using AI', async () => {
      const mockMetadata = {
        purpose: 'Test prompt',
        input_requirements: ['input1', 'input2'],
        output_format: 'JSON',
        tags: ['test', 'prompt'],
        complexity: 'low'
      };

      (claudeService.getJsonResponse as Mock).mockResolvedValue(mockMetadata);

      const metadata = await promptService.extractPromptMetadata('Test content');
      
      expect(metadata).toEqual(mockMetadata);
      expect(claudeService.getJsonResponse).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance({ enableCaching: true });
      await promptService.initialize();
    });

    it('should clear cache when requested', async () => {
      // Load a prompt to populate cache
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPrompt, error: null })
      });

      await promptService.getPromptByName('test-prompt');
      
      // Clear cache
      promptService.clearCache();
      
      // Next call should miss cache
      await promptService.getPromptByName('test-prompt');
      
      const metrics = promptService.getMetrics();
      expect(metrics.cacheMisses).toBe(2); // Both calls missed cache
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should track service metrics', async () => {
      // Perform various operations
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPrompt, error: null })
      });

      await promptService.getPromptByName('test-prompt');
      await promptService.getPromptRelationships('test-prompt-id');
      
      const metrics = promptService.getMetrics();
      
      expect(metrics.totalPromptsLoaded).toBeGreaterThan(0);
      expect(metrics.averageLoadTime).toBeGreaterThan(0);
      expect(metrics.lastActivity).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      promptService = PromptService.getInstance();
      await promptService.initialize();
    });

    it('should handle network errors gracefully', async () => {
      const mockFrom = mockSupabaseClient.from as Mock;
      mockFrom.mockRejectedValue(new Error('Network error'));

      const prompt = await promptService.getPromptByName('test-prompt');
      expect(prompt).toBeNull();
    });

    it('should handle unexpected errors in file operations', async () => {
      const nodeService = PromptService.getInstance({ environment: 'node' });
      await nodeService.initialize();

      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.readFileSync as Mock).mockImplementation(() => {
        throw new Error('File read error');
      });

      const prompt = await nodeService.getPromptByName('test-prompt');
      expect(prompt).toBeNull();
    });
  });
});