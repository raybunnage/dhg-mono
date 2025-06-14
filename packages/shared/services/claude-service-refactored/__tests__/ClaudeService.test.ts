import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import { SingletonService } from '../../base-classes/SingletonService';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    }))
  };
});

describe('ClaudeService', () => {
  let service: ClaudeService;
  let mockAnthropicClient: any;
  let mockCreate: MockedFunction<any>;
  
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear singleton instances
    (SingletonService as any).instances.clear();
    
    // Reset environment
    process.env = { ...originalEnv };
    process.env.CLAUDE_API_KEY = 'test-api-key';
    
    // Clear mocks
    vi.clearAllMocks();
    
    // Get mock references
    const Anthropic = require('@anthropic-ai/sdk').default;
    mockAnthropicClient = new Anthropic();
    mockCreate = mockAnthropicClient.messages.create;
    
    // Reset the service instance
    (ClaudeService as any).instance = null;
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Clear singleton instances
    (SingletonService as any).instances.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ClaudeService.getInstance();
      const instance2 = ClaudeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should extend SingletonService', () => {
      service = ClaudeService.getInstance();
      expect(service).toBeInstanceOf(SingletonService);
    });
  });

  describe('Initialization', () => {
    it('should initialize with API key from environment', async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
      
      const Anthropic = require('@anthropic-ai/sdk').default;
      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
    });

    it('should throw error if API key is missing', async () => {
      delete process.env.CLAUDE_API_KEY;
      service = ClaudeService.getInstance();
      
      await expect(service.ensureInitialized()).rejects.toThrow('CLAUDE_API_KEY environment variable is required');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
    });

    it('should send a message successfully', async () => {
      const mockResponse = {
        id: 'msg_123',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        model: 'claude-3-opus-20240229',
        role: 'assistant',
        usage: { input_tokens: 10, output_tokens: 20 }
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const result = await service.sendPrompt('Hello Claude');
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages: [{ role: 'user', content: 'Hello Claude' }]
      });
      
      expect(result).toBe('Hello! How can I help you?');
    });

    it('should handle multi-part responses', async () => {
      const mockResponse = {
        id: 'msg_123',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' }
        ],
        model: 'claude-3-opus-20240229',
        role: 'assistant'
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const result = await service.sendPrompt('Test prompt');
      
      expect(result).toBe('Part 1Part 2');
    });

    it('should pass additional options', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      await service.sendPrompt('Test', { temperature: 0.5, max_tokens: 100 });
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        temperature: 0.5,
        messages: [{ role: 'user', content: 'Test' }]
      });
    });
  });

  describe('JSON Response Handling', () => {
    beforeEach(async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
    });

    it('should parse JSON responses', async () => {
      const jsonData = { key: 'value', number: 42 };
      const mockResponse = {
        content: [{ type: 'text', text: JSON.stringify(jsonData) }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const result = await service.getJsonResponse('Get JSON');
      
      expect(result).toEqual(jsonData);
    });

    it('should extract JSON from markdown code blocks', async () => {
      const jsonData = { extracted: true };
      const mockResponse = {
        content: [{ 
          type: 'text', 
          text: 'Here is the JSON:\n```json\n' + JSON.stringify(jsonData) + '\n```\nThat\'s it!' 
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const result = await service.getJsonResponse('Get JSON');
      
      expect(result).toEqual(jsonData);
    });

    it('should handle invalid JSON', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Not valid JSON' }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      await expect(service.getJsonResponse('Get JSON')).rejects.toThrow('Failed to parse JSON');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
    });

    it('should handle API errors', async () => {
      const apiError = new Error('API Error: Rate limit exceeded');
      mockCreate.mockRejectedValueOnce(apiError);
      
      await expect(service.sendPrompt('Test')).rejects.toThrow('API Error: Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error: Connection refused');
      mockCreate.mockRejectedValueOnce(networkError);
      
      await expect(service.sendPrompt('Test')).rejects.toThrow('Network error: Connection refused');
    });

    it('should handle empty responses', async () => {
      const mockResponse = {
        content: []
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      const result = await service.sendPrompt('Test');
      expect(result).toBe('');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
    });

    it('should retry on rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      const successResponse = {
        content: [{ type: 'text', text: 'Success after retry' }]
      };
      
      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);
      
      const result = await service.sendPrompt('Test');
      
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).toBe('Success after retry');
    });

    it('should respect retry limits', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      
      mockCreate.mockRejectedValue(rateLimitError);
      
      await expect(service.sendPrompt('Test')).rejects.toThrow('Rate limit exceeded');
      
      // Should attempt 3 times by default
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when initialized', async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toEqual({
        status: 'connected',
        apiKeyConfigured: true
      });
    });

    it('should report unhealthy when not initialized', async () => {
      service = ClaudeService.getInstance();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details).toEqual({
        status: 'not initialized',
        apiKeyConfigured: true
      });
    });

    it('should report missing API key', async () => {
      delete process.env.CLAUDE_API_KEY;
      service = ClaudeService.getInstance();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.apiKeyConfigured).toBe(false);
    });
  });

  describe('Metadata', () => {
    it('should return correct metadata', () => {
      service = ClaudeService.getInstance();
      
      const metadata = service.getMetadata();
      
      expect(metadata).toEqual({
        name: 'ClaudeService',
        initialized: false,
        type: 'ClaudeService',
        version: '1.0.0'
      });
    });

    it('should update initialized status', async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
      
      const metadata = service.getMetadata();
      
      expect(metadata.initialized).toBe(true);
    });
  });

  describe('Advanced Features', () => {
    beforeEach(async () => {
      service = ClaudeService.getInstance();
      await service.ensureInitialized();
    });

    it('should support streaming responses', async () => {
      // Note: This would need actual streaming implementation
      // For now, we just verify the option is passed
      const mockResponse = {
        content: [{ type: 'text', text: 'Streamed response' }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      await service.sendPrompt('Test', { stream: true });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true })
      );
    });

    it('should support system prompts', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response with system prompt' }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);
      
      await service.sendPrompt('User message', { 
        system: 'You are a helpful assistant' 
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ 
          system: 'You are a helpful assistant' 
        })
      );
    });
  });
});