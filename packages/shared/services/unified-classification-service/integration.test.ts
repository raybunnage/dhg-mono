/**
 * Integration tests for the Unified Classification Service
 * 
 * These tests verify the service works correctly with real prompts and file types
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { UnifiedClassificationService } from './unified-classification-service';
import { SupabaseClientService } from '../supabase-client';
import { promptService } from '../prompt-service';
import * as fs from 'fs';
import * as path from 'path';

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, 'test-data');

describe('UnifiedClassificationService Integration Tests', () => {
  let service: UnifiedClassificationService;
  let supabase: any;

  beforeAll(async () => {
    // Create test data directory if it doesn't exist
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }

    // Initialize service with real dependencies
    service = UnifiedClassificationService.getInstance();
    supabase = SupabaseClientService.getInstance().getClient();
  });

  describe('Prompt Availability Tests', () => {
    const requiredPrompts = [
      'pdf-classification-prompt',
      'document-classification-prompt-new',
      'text-classification-prompt',
      'markdown-document-classification-prompt',
      'powerpoint-classification-prompt',
      'transcript-classification-prompt',
      'video-classification-prompt',
      'audio-classification-prompt'
    ];

    it.each(requiredPrompts)('should have %s prompt available', async (promptName) => {
      const result = await promptService.loadPrompt(promptName);
      expect(result.success).toBe(true);
      expect(result.prompt).toBeDefined();
      expect(result.prompt?.name).toBe(promptName);
    });
  });

  describe('Mime Type Coverage Tests', () => {
    const mimeTypeMappings = [
      { mimeType: 'application/pdf', expectedPrompt: 'pdf-classification-prompt' },
      { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', expectedPrompt: 'document-classification-prompt-new' },
      { mimeType: 'text/plain', expectedPrompt: 'text-classification-prompt' },
      { mimeType: 'text/markdown', expectedPrompt: 'markdown-document-classification-prompt' },
      { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', expectedPrompt: 'powerpoint-classification-prompt' },
      { mimeType: 'video/mp4', expectedPrompt: 'video-classification-prompt' },
      { mimeType: 'audio/x-m4a', expectedPrompt: 'audio-classification-prompt' },
      { mimeType: 'audio/mpeg', expectedPrompt: 'audio-classification-prompt' },
    ];

    it.each(mimeTypeMappings)('should map $mimeType to $expectedPrompt', async ({ mimeType, expectedPrompt }) => {
      const prompt = (service as any).selectPrompt(mimeType, 'test-file');
      expect(prompt).toBe(expectedPrompt);
    });
  });

  describe('File Type Query Tests', () => {
    it('should build correct query for PDF files', async () => {
      const spy = jest.spyOn(supabase, 'from');
      
      try {
        await service.classifyDocuments({
          types: ['pdf'],
          limit: 1,
          dryRun: true
        });
      } catch (error) {
        // Expected to fail without real data
      }

      expect(spy).toHaveBeenCalledWith('google_sources');
      const queryChain = spy.mock.results[0]?.value;
      expect(queryChain?.in).toHaveBeenCalledWith('mime_type', ['application/pdf']);
    });

    it('should build correct query for multiple file types', async () => {
      const spy = jest.spyOn(supabase, 'from');
      
      try {
        await service.classifyDocuments({
          types: ['pdf', 'docx', 'audio'],
          limit: 1,
          dryRun: true
        });
      } catch (error) {
        // Expected to fail without real data
      }

      const queryChain = spy.mock.results[0]?.value;
      expect(queryChain?.in).toHaveBeenCalledWith('mime_type', expect.arrayContaining([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'audio/x-m4a',
        'audio/mpeg'
      ]));
    });
  });

  describe('Classification Result Structure Tests', () => {
    const testClassificationResult = {
      name: 'research paper',
      document_type_id: 'test-type-123',
      classification_confidence: 0.95,
      classification_reasoning: 'Contains scientific methodology',
      document_summary: 'A paper about AI research',
      key_topics: ['artificial intelligence', 'machine learning', 'neural networks'],
      target_audience: 'Researchers and academics',
      unique_insights: ['Novel approach to training', 'Improved accuracy']
    };

    it('should extract concepts from key_topics', () => {
      const concepts = (service as any).extractConcepts(testClassificationResult);
      
      expect(concepts).toHaveLength(3);
      expect(concepts[0]).toEqual({ name: 'artificial intelligence', weight: 1.0 });
      expect(concepts[1]).toEqual({ name: 'machine learning', weight: 0.9 });
      expect(concepts[2]).toEqual({ name: 'neural networks', weight: 0.8 });
    });

    it('should handle legacy concept formats', () => {
      const legacyResult = {
        ...testClassificationResult,
        key_topics: undefined,
        keyConcepts: ['concept1', 'concept2']
      };

      const concepts = (service as any).extractConcepts(legacyResult);
      
      expect(concepts).toHaveLength(2);
      expect(concepts[0]).toEqual({ name: 'concept1', weight: 1.0 });
      expect(concepts[1]).toEqual({ name: 'concept2', weight: 0.9 });
    });

    it('should create proper batch result structure', () => {
      const results = [
        { success: true, fileName: 'file1.pdf' },
        { success: true, fileName: 'file2.docx' },
        { success: false, fileName: 'file3.txt', error: 'Failed' }
      ];

      const batchResult = (service as any).createBatchResult(
        results,
        [{ fileName: 'file3.txt', error: 'Failed' }],
        Date.now() - 5000
      );

      expect(batchResult.totalFiles).toBe(3);
      expect(batchResult.successfulFiles).toBe(2);
      expect(batchResult.failedFiles).toBe(1);
      expect(batchResult.processingTime).toBeGreaterThan(4000);
      expect(batchResult.errors).toHaveLength(1);
    });
  });

  describe('Content Extraction Tests', () => {
    it('should handle different expert document content formats', async () => {
      const testCases = [
        { 
          data: { processed_content: 'Simple string content' },
          expected: 'Simple string content'
        },
        { 
          data: { processed_content: { content: 'Nested content' } },
          expected: 'Nested content'
        },
        { 
          data: { processed_content: { text: 'Text field content' } },
          expected: 'Text field content'
        },
        { 
          data: { raw_content: 'Raw content fallback' },
          expected: 'Raw content fallback'
        },
        { 
          data: { raw_content: { content: 'Nested raw content' } },
          expected: 'Nested raw content'
        }
      ];

      for (const testCase of testCases) {
        jest.spyOn(supabase, 'single').mockResolvedValueOnce({
          data: testCase.data,
          error: null
        });

        const content = await (service as any).getExpertDocumentContent('test-id');
        expect(content).toBe(testCase.expected);
      }
    });

    it('should identify file types correctly', () => {
      const service = UnifiedClassificationService.getInstance();

      // Text-based documents
      expect((service as any).isTextBasedDocument('text/plain')).toBe(true);
      expect((service as any).isTextBasedDocument('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect((service as any).isTextBasedDocument('application/pdf')).toBe(false);

      // Presentations
      expect((service as any).isPresentationDocument('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(true);
      expect((service as any).isPresentationDocument('application/vnd.google-apps.presentation')).toBe(true);
      expect((service as any).isPresentationDocument('text/plain')).toBe(false);

      // Media files
      expect((service as any).isMediaFile('audio/mpeg')).toBe(true);
      expect((service as any).isMediaFile('video/mp4')).toBe(true);
      expect((service as any).isMediaFile('text/plain')).toBe(false);

      // Google documents
      expect((service as any).isGoogleDocument('application/vnd.google-apps.document')).toBe(true);
      expect((service as any).isGoogleDocument('application/vnd.google-apps.spreadsheet')).toBe(true);
      expect((service as any).isGoogleDocument('application/pdf')).toBe(false);
    });
  });

  describe('Concurrency Control Tests', () => {
    it('should properly chunk arrays for batch processing', () => {
      const service = UnifiedClassificationService.getInstance();
      const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const chunks = (service as any).chunkArray(testArray, 3);
      
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty file list gracefully', async () => {
      jest.spyOn(supabase, 'from').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const result = await service.classifyDocuments({ limit: 10 });
      
      expect(result.totalFiles).toBe(0);
      expect(result.processedFiles).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files without mime types', () => {
      const prompt = (service as any).selectPrompt('', 'document.pdf');
      expect(prompt).toBe('pdf-classification-prompt'); // Should use extension
    });

    it('should handle files without extensions', () => {
      const prompt = (service as any).selectPrompt('application/pdf', 'document');
      expect(prompt).toBe('pdf-classification-prompt'); // Should use mime type
    });

    it('should handle completely unknown files', () => {
      const prompt = (service as any).selectPrompt('', 'unknownfile');
      expect(prompt).toBe('document-classification-prompt-new'); // Should use default
    });
  });
});