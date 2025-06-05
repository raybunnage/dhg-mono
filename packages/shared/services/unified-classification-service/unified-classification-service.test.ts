/**
 * Comprehensive test suite for the Unified Classification Service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { UnifiedClassificationService } from './unified-classification-service';
import { ClassificationOptions, SourceFile, SupportedFileType } from './types';
import { SupabaseClientService } from '../supabase-client';
import { promptService } from '../prompt-service';
import { GoogleDriveService } from '../google-drive';
import { pdfProcessorService } from '../pdf-processor-service';

// Mock all external dependencies
jest.mock('../supabase-client');
jest.mock('../prompt-service');
jest.mock('../google-drive');
jest.mock('../pdf-processor-service');
jest.mock('../../utils/logger');

describe('UnifiedClassificationService', () => {
  let service: UnifiedClassificationService;
  let mockSupabase: any;
  let mockPromptService: any;
  let mockGoogleDrive: any;
  let mockPdfProcessor: any;

  beforeAll(() => {
    // Setup mocks
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    };

    (SupabaseClientService.getInstance as jest.Mock).mockReturnValue({
      getClient: () => mockSupabase
    });

    service = UnifiedClassificationService.getInstance();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Prompt Selection', () => {
    it('should select correct prompt for PDF files', () => {
      const prompt = (service as any).selectPrompt('application/pdf', 'document.pdf');
      expect(prompt).toBe('pdf-classification-prompt');
    });

    it('should select correct prompt for DOCX files', () => {
      const prompt = (service as any).selectPrompt(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'document.docx'
      );
      expect(prompt).toBe('document-classification-prompt-new');
    });

    it('should select correct prompt for PowerPoint files', () => {
      const prompt = (service as any).selectPrompt(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'presentation.pptx'
      );
      expect(prompt).toBe('powerpoint-classification-prompt');
    });

    it('should select correct prompt for audio files', () => {
      const prompt = (service as any).selectPrompt('audio/x-m4a', 'audio.m4a');
      expect(prompt).toBe('audio-classification-prompt');
    });

    it('should select correct prompt for video files', () => {
      const prompt = (service as any).selectPrompt('video/mp4', 'video.mp4');
      expect(prompt).toBe('video-classification-prompt');
    });

    it('should select transcript prompt for files with transcript in name', () => {
      const prompt = (service as any).selectPrompt('text/plain', 'meeting-transcript.txt');
      expect(prompt).toBe('transcript-classification-prompt');
    });

    it('should fallback to default prompt for unknown mime types', () => {
      const prompt = (service as any).selectPrompt('application/unknown', 'file.xyz');
      expect(prompt).toBe('document-classification-prompt-new');
    });

    it('should use extension-based fallback when mime type not recognized', () => {
      const prompt = (service as any).selectPrompt('application/octet-stream', 'document.pdf');
      expect(prompt).toBe('pdf-classification-prompt');
    });
  });

  describe('File Type Filtering', () => {
    it('should convert file types to correct mime types', () => {
      const mimeTypes = (service as any).getMimeTypesForFileTypes(['pdf', 'docx']);
      expect(mimeTypes).toContain('application/pdf');
      expect(mimeTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should handle audio type conversion', () => {
      const mimeTypes = (service as any).getMimeTypesForFileTypes(['audio']);
      expect(mimeTypes).toContain('audio/x-m4a');
      expect(mimeTypes).toContain('audio/mpeg');
      expect(mimeTypes).toContain('audio/mp3');
    });

    it('should handle Google Docs types', () => {
      const mimeTypes = (service as any).getMimeTypesForFileTypes(['google-doc', 'google-slides']);
      expect(mimeTypes).toContain('application/vnd.google-apps.document');
      expect(mimeTypes).toContain('application/vnd.google-apps.presentation');
    });
  });

  describe('Content Extraction', () => {
    const mockFile: SourceFile = {
      id: 'test-id',
      drive_id: 'drive-123',
      name: 'test.pdf',
      mime_type: 'application/pdf',
      size: 1024,
      path: '/test/test.pdf',
      web_view_link: 'https://drive.google.com/file/test',
      document_type_id: undefined,
      is_deleted: false,
      pipeline_status: 'unprocessed'
    };

    it('should extract content from expert document if available', async () => {
      const fileWithExpertDoc = { ...mockFile, expert_document_id: 'expert-123' };
      
      mockSupabase.single.mockResolvedValue({
        data: { processed_content: { content: 'Extracted content from expert doc' } },
        error: null
      });

      const result = await (service as any).extractContent(fileWithExpertDoc);
      expect(result.success).toBe(true);
      expect(result.content).toBe('Extracted content from expert doc');
    });

    it('should extract PDF content using PDF processor', async () => {
      const mockGoogleDriveInstance = {
        downloadFile: jest.fn().mockResolvedValue('/tmp/test.pdf')
      };
      (GoogleDriveService as jest.Mock).mockImplementation(() => mockGoogleDriveInstance);
      
      (pdfProcessorService.processPdf as jest.Mock).mockResolvedValue({
        success: true,
        content: 'PDF content',
        metadata: { pages: 10 }
      });

      const result = await (service as any).extractPdfContent(mockFile);
      expect(result.success).toBe(true);
      expect(result.content).toBe('PDF content');
      expect(result.metadata).toEqual({ pages: 10 });
    });

    it('should handle PDF extraction failure', async () => {
      const mockGoogleDriveInstance = {
        downloadFile: jest.fn().mockRejectedValue(new Error('Download failed'))
      };
      (GoogleDriveService as jest.Mock).mockImplementation(() => mockGoogleDriveInstance);

      const result = await (service as any).extractPdfContent(mockFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Download failed');
    });

    it('should identify text-based documents correctly', () => {
      expect((service as any).isTextBasedDocument('text/plain')).toBe(true);
      expect((service as any).isTextBasedDocument('text/markdown')).toBe(true);
      expect((service as any).isTextBasedDocument('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect((service as any).isTextBasedDocument('application/pdf')).toBe(false);
    });

    it('should identify media files correctly', () => {
      expect((service as any).isMediaFile('audio/mpeg')).toBe(true);
      expect((service as any).isMediaFile('video/mp4')).toBe(true);
      expect((service as any).isMediaFile('application/pdf')).toBe(false);
    });
  });

  describe('Classification Process', () => {
    const mockFile: SourceFile = {
      id: 'test-id',
      drive_id: 'drive-123',
      name: 'test.pdf',
      mime_type: 'application/pdf',
      size: 1024,
      path: '/test/test.pdf',
      web_view_link: 'https://drive.google.com/file/test',
      document_type_id: undefined,
      is_deleted: false,
      pipeline_status: 'unprocessed'
    };

    beforeEach(() => {
      // Mock prompt service
      (promptService.loadPrompt as jest.Mock).mockResolvedValue({
        success: true,
        prompt: 'Test prompt'
      });

      (promptService.usePromptWithClaude as jest.Mock).mockResolvedValue({
        success: true,
        data: JSON.stringify({
          name: 'scientific paper',
          document_type_id: 'type-123',
          classification_confidence: 0.95,
          classification_reasoning: 'Contains research data',
          document_summary: 'A research paper about AI',
          unique_insights: ['New algorithm', 'Performance improvements'],
          key_topics: ['AI', 'Machine Learning', 'Neural Networks']
        })
      });
    });

    it('should successfully classify a document', async () => {
      // Mock content extraction
      jest.spyOn(service as any, 'extractContent').mockResolvedValue({
        content: 'Document content',
        success: true
      });

      // Mock save operation
      mockSupabase.eq.mockReturnValue({
        data: null,
        error: null
      });

      const result = await (service as any).processFile(mockFile, {});
      
      expect(result.success).toBe(true);
      expect(result.documentTypeName).toBe('scientific paper');
      expect(result.confidence).toBe(0.95);
      expect(result.concepts).toHaveLength(3);
    });

    it('should skip already classified files when skipClassified is true', async () => {
      const classifiedFile = { ...mockFile, document_type_id: 'existing-type' };
      
      const result = await (service as any).processFile(classifiedFile, { 
        skipClassified: true,
        force: false 
      });
      
      expect(result.success).toBe(true);
      expect(result.reasoning).toBe('File was already classified');
      expect(promptService.usePromptWithClaude).not.toHaveBeenCalled();
    });

    it('should force reclassification when force is true', async () => {
      const classifiedFile = { ...mockFile, document_type_id: 'existing-type' };
      
      jest.spyOn(service as any, 'extractContent').mockResolvedValue({
        content: 'Document content',
        success: true
      });

      const result = await (service as any).processFile(classifiedFile, { 
        force: true 
      });
      
      expect(result.success).toBe(true);
      expect(promptService.usePromptWithClaude).toHaveBeenCalled();
    });

    it('should handle classification errors gracefully', async () => {
      jest.spyOn(service as any, 'extractContent').mockResolvedValue({
        content: '',
        error: 'Failed to extract content',
        success: false
      });

      const result = await (service as any).processFile(mockFile, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract content');
    });
  });

  describe('Batch Processing', () => {
    it('should process files with concurrency control', async () => {
      const mockFiles = Array(10).fill(null).map((_, i) => ({
        id: `file-${i}`,
        drive_id: `drive-${i}`,
        name: `test-${i}.pdf`,
        mime_type: 'application/pdf',
        is_deleted: false
      }));

      mockSupabase.eq.mockReturnValue({
        data: mockFiles,
        error: null
      });

      // Mock processFile to track concurrency
      let concurrentProcessing = 0;
      let maxConcurrent = 0;
      
      jest.spyOn(service as any, 'processFile').mockImplementation(async () => {
        concurrentProcessing++;
        maxConcurrent = Math.max(maxConcurrent, concurrentProcessing);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        
        concurrentProcessing--;
        
        return {
          success: true,
          sourceId: 'test',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          documentTypeId: 'type-123',
          documentTypeName: 'PDF Document',
          confidence: 0.9,
          reasoning: 'Test'
        };
      });

      const result = await service.classifyDocuments({
        limit: 10,
        concurrency: 3
      });

      expect(result.totalFiles).toBe(10);
      expect(result.successfulFiles).toBe(10);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should handle mixed success and failure results', async () => {
      const mockFiles = Array(5).fill(null).map((_, i) => ({
        id: `file-${i}`,
        drive_id: `drive-${i}`,
        name: `test-${i}.pdf`,
        mime_type: 'application/pdf',
        is_deleted: false
      }));

      mockSupabase.eq.mockReturnValue({
        data: mockFiles,
        error: null
      });

      // Mock processFile to return alternating success/failure
      jest.spyOn(service as any, 'processFile').mockImplementation(async (file) => {
        const index = parseInt(file.id.split('-')[1]);
        if (index % 2 === 0) {
          return {
            success: true,
            sourceId: file.id,
            fileName: file.name,
            mimeType: file.mime_type,
            documentTypeId: 'type-123',
            documentTypeName: 'PDF Document',
            confidence: 0.9,
            reasoning: 'Test'
          };
        } else {
          throw new Error('Processing failed');
        }
      });

      const result = await service.classifyDocuments({ limit: 5 });

      expect(result.totalFiles).toBe(5);
      expect(result.successfulFiles).toBe(3);
      expect(result.failedFiles).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('Database Operations', () => {
    it('should save classification to both google_sources and expert_documents', async () => {
      const classification = {
        name: 'research paper',
        document_type_id: 'type-123',
        classification_confidence: 0.95,
        classification_reasoning: 'Scientific content',
        key_topics: ['AI', 'ML']
      };

      mockSupabase.eq.mockReturnValue({
        data: null,
        error: null
      });

      await (service as any).saveClassification(
        { id: 'source-123', expert_document_id: 'expert-123' },
        classification
      );

      // Check google_sources update
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          document_type_id: 'type-123'
        })
      );

      // Check expert_documents update
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          document_type_id: 'type-123',
          classification_confidence: 0.95,
          classification_reasoning: 'Scientific content'
        })
      );
    });

    it('should save concepts to learn_document_concepts', async () => {
      mockSupabase.insert.mockReturnValue({
        data: null,
        error: null
      });

      await (service as any).saveConcepts('doc-123', ['AI', 'Machine Learning', 'Neural Networks']);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            document_id: 'doc-123',
            concept: 'AI',
            weight: 1.0
          }),
          expect.objectContaining({
            document_id: 'doc-123',
            concept: 'Machine Learning',
            weight: 0.9
          }),
          expect.objectContaining({
            document_id: 'doc-123',
            concept: 'Neural Networks',
            weight: 0.8
          })
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database query errors', async () => {
      mockSupabase.eq.mockReturnValue({
        data: null,
        error: new Error('Database connection failed')
      });

      await expect(service.classifyDocuments()).rejects.toThrow('Database connection failed');
    });

    it('should handle prompt loading errors', async () => {
      (promptService.loadPrompt as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Prompt not found'
      });

      jest.spyOn(service as any, 'extractContent').mockResolvedValue({
        content: 'Test content',
        success: true
      });

      const result = await (service as any).classifyContent(
        'Test content',
        'test.pdf',
        'missing-prompt'
      );

      expect(result).toBeNull();
    });

    it('should handle Claude API errors', async () => {
      (promptService.loadPrompt as jest.Mock).mockResolvedValue({
        success: true,
        prompt: 'Test prompt'
      });

      (promptService.usePromptWithClaude as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Claude API rate limit exceeded'
      });

      await expect(
        (service as any).classifyContent('Test content', 'test.pdf', 'test-prompt')
      ).rejects.toThrow('Failed to get classification response');
    });
  });
});