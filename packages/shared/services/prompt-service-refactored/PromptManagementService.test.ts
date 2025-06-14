/**
 * Test suite for PromptManagementService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptManagementService } from './PromptManagementService';
import { SupabaseClient } from '@supabase/supabase-js';
import { PromptService } from '../prompt-service/prompt-service';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs');

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock PromptService
const mockPromptService = {} as PromptService;

// Mock query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis()
};

describe('PromptManagementService', () => {
  let service: PromptManagementService;
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

    service = new PromptManagementService(mockSupabaseClient, mockPromptService, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should create instance with required dependencies', () => {
      expect(service).toBeInstanceOf(PromptManagementService);
    });

    it('should throw error if Supabase client is not provided', () => {
      expect(() => new PromptManagementService(null as any, mockPromptService)).toThrow(
        'PromptManagementService requires a Supabase client'
      );
    });

    it('should throw error if PromptService is not provided', () => {
      expect(() => new PromptManagementService(mockSupabaseClient, null as any)).toThrow(
        'PromptManagementService requires a PromptService instance'
      );
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

  describe('Markdown Frontmatter Parsing', () => {
    it('should parse valid frontmatter', () => {
      const content = `---
name: Test Prompt
description: A test prompt
tags:
  - test
  - prompt
---

This is the prompt content`;

      const result = service.parseMarkdownFrontmatter(content);
      
      expect(result.metadata.name).toBe('Test Prompt');
      expect(result.metadata.description).toBe('A test prompt');
      expect(result.metadata.tags).toEqual(['test', 'prompt']);
      expect(result.content).toBe('This is the prompt content');
    });

    it('should handle content without frontmatter', () => {
      const content = 'Just plain content';
      
      const result = service.parseMarkdownFrontmatter(content);
      
      expect(result.metadata).toEqual({});
      expect(result.content).toBe('Just plain content');
    });

    it('should handle malformed frontmatter', () => {
      const content = `---
invalid frontmatter without end
This is content`;
      
      const result = service.parseMarkdownFrontmatter(content);
      
      expect(result.metadata).toEqual({});
      expect(result.content).toBe(content);
    });
  });

  describe('Metadata Building', () => {
    it('should build metadata object with defaults', () => {
      const metadata = service.buildMetadataObject({}, 'test content', 'test.md');
      
      expect(metadata.hash).toBeDefined();
      expect(metadata.source?.fileName).toBe('test.md');
      expect(metadata.aiEngine?.model).toBe('claude-3-sonnet-20240229');
      expect(metadata.aiEngine?.temperature).toBe(0.7);
      expect(metadata.aiEngine?.maxTokens).toBe(4000);
    });

    it('should use provided metadata values', () => {
      const extractedMetadata = {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000,
        purpose: 'Testing',
        dependencies: ['dep1', 'dep2']
      };
      
      const metadata = service.buildMetadataObject(extractedMetadata, 'test', 'test.md');
      
      expect(metadata.aiEngine?.model).toBe('gpt-4');
      expect(metadata.aiEngine?.temperature).toBe(0.5);
      expect(metadata.aiEngine?.maxTokens).toBe(2000);
      expect(metadata.function?.purpose).toBe('Testing');
      expect(metadata.function?.dependencies).toEqual(['dep1', 'dep2']);
    });
  });

  describe('Prompt Categories', () => {
    it('should fetch prompt categories', async () => {
      const mockCategories = [
        { id: '1', name: 'General', description: 'General prompts' },
        { id: '2', name: 'Technical', description: 'Technical prompts' }
      ];
      
      mockQueryBuilder.order.mockResolvedValue({ data: mockCategories, error: null });
      
      const categories = await service.getPromptCategories();
      
      expect(categories).toEqual(mockCategories);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ai_prompt_categories');
    });

    it('should create prompt category', async () => {
      const newCategory = {
        id: '3',
        name: 'Analysis',
        description: 'Analysis prompts',
        parent_category_id: null
      };
      
      mockQueryBuilder.single.mockResolvedValue({ data: newCategory, error: null });
      
      const category = await service.createPromptCategory('Analysis', 'Analysis prompts');
      
      expect(category).toEqual(newCategory);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: 'Analysis',
        description: 'Analysis prompts',
        parent_category_id: null
      });
    });

    it('should validate category name', async () => {
      const category = await service.createPromptCategory('', 'Description');
      
      expect(category).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Prompt CRUD Operations', () => {
    const mockPrompt = {
      id: 'p1',
      name: 'Test Prompt',
      content: 'Test content',
      description: 'Test description',
      version: '1.0.0',
      status: 'active',
      tags: ['test'],
      metadata: {}
    };

    it('should create prompt successfully', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: mockPrompt, error: null });
      
      const prompt = await service.createPrompt(
        'Test Prompt',
        'Test content',
        'Test description'
      );
      
      expect(prompt).toEqual(mockPrompt);
      expect(service.getMetrics().totalPromptsCreated).toBe(1);
    });

    it('should validate required fields', async () => {
      const prompt = await service.createPrompt('', 'content');
      
      expect(prompt).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should update prompt', async () => {
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { ...mockPrompt, description: 'Updated' }, 
        error: null 
      });
      
      const updated = await service.updatePrompt('p1', { description: 'Updated' });
      
      expect(updated?.description).toBe('Updated');
      expect(service.getMetrics().totalPromptsUpdated).toBe(1);
    });

    it('should delete prompt with relationships', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ data: null, error: null });
      
      const result = await service.deletePrompt('p1');
      
      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ai_prompt_relationships');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ai_prompt_template_associations');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ai_prompts');
      expect(service.getMetrics().totalPromptsDeleted).toBe(1);
    });
  });

  describe('Markdown Import/Export', () => {
    it('should import prompt from markdown file', async () => {
      const markdownContent = `---
name: Imported Prompt
description: Test import
version: 2.0.0
status: active
tags:
  - imported
---

Imported content`;

      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(markdownContent);
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { id: 'new-id', name: 'Imported Prompt' }, 
        error: null 
      });
      
      const prompt = await service.importPromptFromMarkdown('/path/to/prompt.md');
      
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('Imported Prompt');
      expect(service.getMetrics().totalMarkdownImports).toBe(1);
    });

    it('should export prompt to markdown', async () => {
      const prompt = {
        id: 'p1',
        name: 'Export Test',
        content: 'Content to export',
        description: 'Test export',
        version: '1.0.0',
        status: 'active',
        tags: ['export', 'test']
      };
      
      mockQueryBuilder.single.mockResolvedValue({ data: prompt, error: null });
      
      const exported = await service.exportPromptToMarkdown('p1');
      
      expect(exported).toBeDefined();
      expect(exported?.content).toContain('---');
      expect(exported?.content).toContain('name: Export Test');
      expect(exported?.content).toContain('Content to export');
      expect(exported?.fileName).toBe('Export_Test.md');
      expect(service.getMetrics().totalMarkdownExports).toBe(1);
    });

    it('should save prompt to file', async () => {
      const prompt = { id: 'p1', name: 'Save Test', content: 'Save content' };
      
      mockQueryBuilder.single.mockResolvedValue({ data: prompt, error: null });
      (fs.writeFileSync as any).mockImplementation(() => {});
      
      const path = await service.savePromptToFile('p1', '/output');
      
      expect(path).toBe('/output/Save_Test.md');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Prompt Relationships', () => {
    it('should get prompt relationships with files', async () => {
      const mockRelationships = [
        { id: 'r1', prompt_id: 'p1', asset_id: 'a1', asset_path: '/path1' },
        { id: 'r2', prompt_id: 'p1', asset_id: 'a2', asset_path: '/path2' }
      ];
      
      const mockFiles = [
        { id: 'a1', file_path: '/path1', title: 'File 1' },
        { id: 'a2', file_path: '/path2', title: 'File 2' }
      ];
      
      mockQueryBuilder.order.mockResolvedValueOnce({ data: mockRelationships, error: null });
      mockQueryBuilder.in.mockResolvedValue({ data: mockFiles, error: null });
      
      const result = await service.getPromptRelationshipsWithFiles('p1');
      
      expect(result.relationships).toEqual(mockRelationships);
      expect(result.files).toEqual(mockFiles);
      expect(mockQueryBuilder.in).toHaveBeenCalledWith('id', ['a1', 'a2']);
    });

    it('should update prompt relationships', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ data: null, error: null });
      mockQueryBuilder.insert.mockResolvedValue({ data: null, error: null });
      
      const relationships = [
        { asset_path: '/new/path', relationship_type: 'reference' }
      ];
      
      const result = await service.updatePromptRelationships('p1', relationships);
      
      expect(result).toBe(true);
      expect(service.getMetrics().totalRelationshipsUpdated).toBe(1);
    });
  });

  describe('Template Associations', () => {
    it('should associate template with prompt', async () => {
      const association = {
        id: 'a1',
        prompt_id: 'p1',
        template_id: 't1',
        priority: 1
      };
      
      mockQueryBuilder.single.mockResolvedValue({ data: association, error: null });
      
      const result = await service.associateTemplateWithPrompt('p1', 't1', 1);
      
      expect(result).toEqual(association);
      expect(service.getMetrics().totalTemplatesAssociated).toBe(1);
    });

    it('should get prompt template associations', async () => {
      const associations = [{ id: 'a1', template_id: 't1' }];
      const templates = [{ id: 't1', name: 'Template 1' }];
      
      mockQueryBuilder.order.mockResolvedValueOnce({ data: associations, error: null });
      mockQueryBuilder.in.mockResolvedValue({ data: templates, error: null });
      
      const result = await service.getPromptTemplateAssociations('p1');
      
      expect(result.associations).toEqual(associations);
      expect(result.templates).toEqual(templates);
    });
  });

  describe('Metrics', () => {
    it('should track all operations', async () => {
      // Setup success responses
      mockQueryBuilder.single.mockResolvedValue({ data: { id: '1' }, error: null });
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
      mockQueryBuilder.eq.mockResolvedValue({ data: null, error: null });

      // Perform operations
      await service.createPrompt('Test', 'Content');
      await service.updatePrompt('1', { description: 'Updated' });
      await service.deletePrompt('1');
      await service.createPromptCategory('Test');
      await service.associateTemplateWithPrompt('p1', 't1');

      const metrics = service.getMetrics();
      
      expect(metrics.totalPromptsCreated).toBe(1);
      expect(metrics.totalPromptsUpdated).toBe(1);
      expect(metrics.totalPromptsDeleted).toBe(1);
      expect(metrics.totalCategoriesCreated).toBe(1);
      expect(metrics.totalTemplatesAssociated).toBe(1);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should track errors', async () => {
      mockQueryBuilder.order.mockResolvedValue({ 
        data: null, 
        error: { message: 'Test error' } 
      });

      await service.getPromptCategories();
      
      const metrics = service.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.lastError).toBe('Test error');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (mockSupabaseClient.from as any).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const categories = await service.getPromptCategories();
      
      expect(categories).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(service.getMetrics().totalErrors).toBe(1);
    });

    it('should handle file system errors', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const prompt = await service.importPromptFromMarkdown('/nonexistent.md');
      
      expect(prompt).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});