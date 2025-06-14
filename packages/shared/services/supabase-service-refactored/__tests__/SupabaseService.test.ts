import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseService } from '../SupabaseService';
import { BusinessService } from '../../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient: Partial<SupabaseClient> = {
  from: vi.fn()
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
};

describe('SupabaseService', () => {
  let service: SupabaseService;
  let mockFrom: jest.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = mockSupabaseClient.from as any;
    service = new SupabaseService(mockSupabaseClient as SupabaseClient, mockLogger);
  });

  describe('inheritance and initialization', () => {
    it('should extend BusinessService', () => {
      expect(service).toBeInstanceOf(BusinessService);
    });

    it('should validate dependencies on construction', () => {
      expect(() => new SupabaseService(null as any)).toThrow('SupabaseClient is required');
    });

    it('should accept logger as optional', () => {
      const serviceWithoutLogger = new SupabaseService(mockSupabaseClient as SupabaseClient);
      expect(serviceWithoutLogger).toBeDefined();
    });
  });

  describe('health check', () => {
    it('should report healthy when database is accessible', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null, data: [{ id: '123' }] })
        })
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toEqual({ status: 'operational' });
    });

    it('should report unhealthy on database error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ 
            error: { message: 'Connection failed' }, 
            data: null 
          })
        })
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details).toEqual({ error: 'Connection failed' });
    });
  });

  describe('static methods', () => {
    it('should normalize paths correctly', () => {
      expect(SupabaseService.normalizePath('\\path\\to\\file')).toBe('/path/to/file');
      expect(SupabaseService.normalizePath('path//to///file/')).toBe('path/to/file');
      expect(SupabaseService.normalizePath('/path/to/file/')).toBe('/path/to/file');
    });

    it('should read env files and mask sensitive values', () => {
      const mockFs = require('fs');
      mockFs.existsSync = vi.fn().mockReturnValue(true);
      mockFs.readFileSync = vi.fn().mockReturnValue(`
# Comment
SUPABASE_URL=https://test.supabase.co
SUPABASE_KEY=secret-key
API_TOKEN=token123
NORMAL_VAR=value
      `);

      const result = SupabaseService.readEnvFile('test.env');

      expect(result.exists).toBe(true);
      expect(result.variables.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(result.variables.SUPABASE_KEY).toBe('[REDACTED]');
      expect(result.variables.API_TOKEN).toBe('[REDACTED]');
      expect(result.variables.NORMAL_VAR).toBe('value');
    });
  });

  describe('prompt operations', () => {
    it('should get prompt by name', async () => {
      const mockPrompt = { id: '123', name: 'test-prompt', content: 'Test content' };
      
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPrompt, error: null })
          })
        })
      });

      const result = await service.getPromptByName('test-prompt');

      expect(mockFrom).toHaveBeenCalledWith('ai_prompts');
      expect(result).toEqual(mockPrompt);
    });

    it('should return null on prompt error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Not found' } 
            })
          })
        })
      });

      const result = await service.getPromptByName('missing-prompt');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('document type operations', () => {
    it('should get document types by category', async () => {
      const mockTypes = [
        { id: '1', name: 'Type 1', category: 'test' },
        { id: '2', name: 'Type 2', category: 'test' }
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTypes, error: null })
          })
        })
      });

      const result = await service.getDocumentTypesByCategory('test');

      expect(result).toEqual(mockTypes);
      expect(mockFrom).toHaveBeenCalledWith('document_types');
    });

    it('should validate document type ID', async () => {
      await expect(service.getDocumentTypeById('')).rejects.toThrow(
        'Document type ID must be a non-empty string'
      );
      
      await expect(service.getDocumentTypeById(null as any)).rejects.toThrow(
        'Document type ID must be a non-empty string'
      );
    });
  });

  describe('script operations', () => {
    it('should validate script data before upsert', async () => {
      await expect(service.upsertScript({})).rejects.toThrow(
        'Script file_path is required'
      );
    });

    it('should upsert script with normalized tags', async () => {
      const scriptData = {
        file_path: '/test/script.js',
        tags: 'single-tag' as any // Test non-array tags
      };

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { ...scriptData, id: '123', tags: ['single-tag'] }, 
              error: null 
            })
          })
        })
      });

      const result = await service.upsertScript(scriptData);

      expect(result).toBeDefined();
      expect(result?.tags).toEqual(['single-tag']);
    });
  });

  describe('relationship operations', () => {
    it('should add relationship with transaction support', async () => {
      const relationshipData = {
        source_id: '123',
        target_id: '456',
        relationship_type: 'references'
      };

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { ...relationshipData, id: '789' }, 
              error: null 
            })
          })
        })
      });

      const result = await service.addRelationship(relationshipData);

      expect(result).toBeDefined();
      expect(result?.source_id).toBe('123');
    });

    it('should validate prompt ID for relationships', async () => {
      await expect(service.getRelationshipsByPromptId('')).rejects.toThrow(
        'Prompt ID must be a non-empty string'
      );
    });
  });

  describe('document file operations', () => {
    it('should validate limit for recent files', async () => {
      await expect(service.getRecentDocumentFiles(0)).rejects.toThrow(
        'Limit must be a number between 1 and 1000'
      );
      
      await expect(service.getRecentDocumentFiles(1001)).rejects.toThrow(
        'Limit must be a number between 1 and 1000'
      );
    });

    it('should get untyped document files', async () => {
      const mockFiles = [
        { id: '1', file_path: '/doc1.md', document_type_id: null },
        { id: '2', file_path: '/doc2.md', document_type_id: null }
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockFiles, error: null })
            })
          })
        })
      });

      const result = await service.getUntypedDocumentFiles(10);

      expect(result).toEqual(mockFiles);
      expect(mockFrom).toHaveBeenCalledWith('doc_files');
    });
  });

  describe('retry logic', () => {
    it('should retry on network errors', async () => {
      let attempts = 0;
      
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              attempts++;
              if (attempts < 3) {
                return Promise.reject({ code: 'ECONNRESET' });
              }
              return Promise.resolve({ 
                data: { id: '123', name: 'test-prompt', content: 'Test' }, 
                error: null 
              });
            })
          })
        })
      }));

      const result = await service.getPromptByName('test-prompt');

      expect(attempts).toBe(3);
      expect(result).toBeDefined();
      expect(result?.name).toBe('test-prompt');
    });
  });

  describe('metadata', () => {
    it('should return correct metadata', () => {
      const metadata = service.getMetadata();

      expect(metadata).toEqual({
        name: 'SupabaseService',
        initialized: false,
        type: 'SupabaseService',
        version: '1.0.0'
      });
    });
  });
});