import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIProcessingService } from './AIProcessingService';
import { ClaudeService } from '../claude-service-refactored/ClaudeService';

// Mock ClaudeService
vi.mock('../claude-service-refactored/ClaudeService');

describe('AIProcessingService', () => {
  let service: AIProcessingService;
  let mockClaudeService: any;

  beforeEach(() => {
    // Create mock ClaudeService
    mockClaudeService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      sendPrompt: vi.fn(),
      getJsonResponse: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true, details: {} })
    };
    
    // Mock the getInstance method
    vi.mocked(ClaudeService).getInstance = vi.fn().mockReturnValue(mockClaudeService);
    
    service = new AIProcessingService(mockClaudeService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with claude service', async () => {
      await service.initialize();
      
      expect(service.isInitialized()).toBe(true);
      expect(mockClaudeService.initialize).toHaveBeenCalled();
    });
  });

  describe('processWithAI', () => {
    it('should process prompts successfully', async () => {
      const prompt = 'Test prompt';
      const expectedResponse = 'AI response';
      mockClaudeService.sendPrompt.mockResolvedValue(expectedResponse);
      
      await service.initialize();
      const result = await service.processWithAI(prompt);
      
      expect(result).toBe(expectedResponse);
      expect(mockClaudeService.sendPrompt).toHaveBeenCalledWith(prompt);
    });

    it('should retry on failure', async () => {
      const prompt = 'Test prompt';
      mockClaudeService.sendPrompt
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('Success');
      
      await service.initialize();
      const result = await service.processWithAI(prompt, { maxRetries: 2 });
      
      expect(result).toBe('Success');
      expect(mockClaudeService.sendPrompt).toHaveBeenCalledTimes(2);
    });

    it('should update metrics', async () => {
      mockClaudeService.sendPrompt.mockResolvedValue('Response');
      
      await service.initialize();
      await service.processWithAI('Test');
      
      const metrics = service.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('processJsonRequest', () => {
    it('should process JSON requests', async () => {
      const prompt = 'JSON prompt';
      const expectedResponse = { key: 'value' };
      mockClaudeService.getJsonResponse.mockResolvedValue(expectedResponse);
      
      await service.initialize();
      const result = await service.processJsonRequest(prompt);
      
      expect(result).toEqual(expectedResponse);
      expect(mockClaudeService.getJsonResponse).toHaveBeenCalledWith(prompt);
    });
  });

  describe('classifyDocument', () => {
    it('should classify documents correctly', async () => {
      const content = 'Document content';
      const documentTypes = [
        { id: '1', name: 'Type A' },
        { id: '2', name: 'Type B' }
      ];
      
      const mockResponse = {
        document_type_id: '1',
        document_type_name: 'Type A',
        confidence: 0.95,
        reasoning: 'Matches Type A criteria'
      };
      
      mockClaudeService.getJsonResponse.mockResolvedValue(mockResponse);
      
      await service.initialize();
      const result = await service.classifyDocument(content, documentTypes);
      
      expect(result).toEqual(mockResponse);
      expect(mockClaudeService.getJsonResponse).toHaveBeenCalled();
    });

    it('should cache classification results', async () => {
      const content = 'Document content';
      const documentTypes = [{ id: '1', name: 'Type A' }];
      
      mockClaudeService.getJsonResponse.mockResolvedValue({
        document_type_id: '1',
        document_type_name: 'Type A',
        confidence: 0.9,
        reasoning: 'Test'
      });
      
      await service.initialize();
      
      // First call
      await service.classifyDocument(content, documentTypes);
      expect(mockClaudeService.getJsonResponse).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      await service.classifyDocument(content, documentTypes);
      expect(mockClaudeService.getJsonResponse).toHaveBeenCalledTimes(1);
    });

    it('should validate response format', async () => {
      const content = 'Document content';
      const documentTypes = [{ id: '1', name: 'Type A' }];
      
      mockClaudeService.getJsonResponse.mockResolvedValue({
        // Missing required fields
        confidence: 0.9
      });
      
      await service.initialize();
      
      await expect(
        service.classifyDocument(content, documentTypes)
      ).rejects.toThrow();
    });
  });

  describe('extractKeyInfo', () => {
    it('should extract key information', async () => {
      const content = 'Long document content...';
      const mockResponse = {
        title: 'Document Title',
        summary: 'Brief summary',
        keywords: ['keyword1', 'keyword2'],
        entities: ['Entity A', 'Entity B']
      };
      
      mockClaudeService.getJsonResponse.mockResolvedValue(mockResponse);
      
      await service.initialize();
      const result = await service.extractKeyInfo(content);
      
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty response gracefully', async () => {
      mockClaudeService.getJsonResponse.mockResolvedValue({});
      
      await service.initialize();
      const result = await service.extractKeyInfo('content');
      
      expect(result.keywords).toEqual([]);
      expect(result.entities).toEqual([]);
    });
  });

  describe('validateData', () => {
    it('should validate data structures', async () => {
      const data = { field1: 'value1', field2: 123 };
      const mockResponse = {
        isValid: true,
        errors: [],
        suggestions: ['Consider adding field3']
      };
      
      mockClaudeService.getJsonResponse.mockResolvedValue(mockResponse);
      
      await service.initialize();
      const result = await service.validateData(data);
      
      expect(result.isValid).toBe(true);
      expect(result.suggestions).toContain('Consider adding field3');
    });

    it('should handle validation errors', async () => {
      mockClaudeService.getJsonResponse.mockRejectedValue(new Error('AI error'));
      
      await service.initialize();
      const result = await service.validateData({});
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to validate data');
    });
  });

  describe('analyzeContent', () => {
    it('should analyze content sentiment and topics', async () => {
      const content = 'Sample content for analysis';
      const mockResponse = {
        sentiment: 'positive',
        topics: ['technology', 'innovation'],
        language: 'en',
        readabilityScore: 85
      };
      
      mockClaudeService.getJsonResponse.mockResolvedValue(mockResponse);
      
      await service.initialize();
      const result = await service.analyzeContent(content);
      
      expect(result).toEqual(mockResponse);
    });

    it('should cache analysis results', async () => {
      const content = 'Content to analyze';
      mockClaudeService.getJsonResponse.mockResolvedValue({
        sentiment: 'neutral',
        topics: []
      });
      
      await service.initialize();
      
      await service.analyzeContent(content);
      await service.analyzeContent(content);
      
      expect(mockClaudeService.getJsonResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateContent', () => {
    it('should generate content from template', async () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const variables = { name: 'John', place: 'AI World' };
      const expected = 'Hello John, welcome to AI World!';
      
      mockClaudeService.sendPrompt.mockResolvedValue(expected);
      
      await service.initialize();
      const result = await service.generateContent(template, variables);
      
      expect(mockClaudeService.sendPrompt).toHaveBeenCalledWith(expected);
    });

    it('should validate required variables', async () => {
      const template = 'Hello {{name}}!';
      const variables = {}; // Missing 'name'
      
      await service.initialize();
      
      await expect(
        service.generateContent(template, variables)
      ).rejects.toThrow('Missing required variables: name');
    });
  });

  describe('summarizeContent', () => {
    it('should summarize content with different detail levels', async () => {
      const content = 'Long content...';
      const summary = 'Brief summary';
      
      mockClaudeService.sendPrompt.mockResolvedValue(summary);
      
      await service.initialize();
      const result = await service.summarizeContent(content, 100, 'brief');
      
      expect(result).toBe(summary);
      expect(mockClaudeService.sendPrompt).toHaveBeenCalled();
    });

    it('should cache summaries', async () => {
      mockClaudeService.sendPrompt.mockResolvedValue('Summary');
      
      await service.initialize();
      
      await service.summarizeContent('content', 100, 'brief');
      await service.summarizeContent('content', 100, 'brief');
      
      expect(mockClaudeService.sendPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('compareContent', () => {
    it('should compare two pieces of content', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      const mockResponse = {
        similarity: 0.75,
        differences: ['Different topics'],
        commonalities: ['Both are text']
      };
      
      mockClaudeService.getJsonResponse.mockResolvedValue(mockResponse);
      
      await service.initialize();
      const result = await service.compareContent(content1, content2);
      
      expect(result).toEqual(mockResponse);
    });

    it('should clamp similarity score', async () => {
      mockClaudeService.getJsonResponse.mockResolvedValue({
        similarity: 1.5, // Out of range
        differences: [],
        commonalities: []
      });
      
      await service.initialize();
      const result = await service.compareContent('a', 'b');
      
      expect(result.similarity).toBe(1);
    });
  });

  describe('batchProcess', () => {
    it('should process items in batch', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation(async (n: number) => n * 2);
      
      await service.initialize();
      const results = await service.batchProcess(items, processor, { concurrency: 2 });
      
      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should handle errors in batch processing', async () => {
      const items = [1, 2, 3];
      const processor = vi.fn()
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(3);
      
      await service.initialize();
      const results = await service.batchProcess(items, processor);
      
      expect(results).toEqual([1, null, 3]);
    });

    it('should report progress', async () => {
      const items = [1, 2, 3];
      const processor = vi.fn().mockResolvedValue('done');
      const onProgress = vi.fn();
      
      await service.initialize();
      await service.batchProcess(items, processor, { onProgress });
      
      expect(onProgress).toHaveBeenCalledWith(1, 3);
      expect(onProgress).toHaveBeenCalledWith(2, 3);
      expect(onProgress).toHaveBeenCalledWith(3, 3);
    });
  });

  describe('Metrics', () => {
    it('should track processing metrics', async () => {
      mockClaudeService.sendPrompt
        .mockResolvedValueOnce('Success')
        .mockRejectedValueOnce(new Error('Failed'));
      
      await service.initialize();
      
      await service.processWithAI('test1');
      await service.processWithAI('test2').catch(() => {});
      
      const metrics = service.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should reset metrics', async () => {
      mockClaudeService.sendPrompt.mockResolvedValue('Response');
      
      await service.initialize();
      await service.processWithAI('test');
      
      service.resetMetrics();
      const metrics = service.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      await service.initialize();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.initialized).toBe(true);
      expect(health.details.metrics).toBeDefined();
      expect(health.details.cacheSize).toBe(0);
    });
  });
});