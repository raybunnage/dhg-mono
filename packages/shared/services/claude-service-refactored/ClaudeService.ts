/**
 * ClaudeService - Singleton service for interacting with Claude API
 * 
 * This service handles communication with the Claude AI API, including:
 * - Sending prompts and receiving responses
 * - Parsing JSON responses
 * - Managing API configuration and authentication
 * - Retry logic and error handling
 * - Request queuing and rate limiting
 * 
 * Refactored to extend SingletonService for proper lifecycle management.
 */

import { SingletonService } from '../base-classes/SingletonService';

// Type definitions
export interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  timeout?: number;
  retries?: number;
}

export interface ClaudeResponse {
  content?: Array<{ text: string; type?: string }>;
  id?: string;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: any;
}

export interface ClaudeServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  defaultModel?: string;
  maxRetries?: number;
  retryDelay?: number;
  requestTimeout?: number;
  maxConcurrentRequests?: number;
}

interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

/**
 * ClaudeService manages all interactions with the Claude AI API.
 * 
 * @example
 * ```typescript
 * const claude = ClaudeService.getInstance();
 * await claude.ensureInitialized();
 * 
 * const response = await claude.sendPrompt('Your prompt here');
 * const jsonData = await claude.getJsonResponse('Return JSON data');
 * ```
 */
export class ClaudeService extends SingletonService {
  private static instance: ClaudeService;
  private config: Required<ClaudeServiceConfig>;
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = 0;
  private totalRequests = 0;
  private totalTokensUsed = { input: 0, output: 0 };
  
  protected constructor(config?: ClaudeServiceConfig) {
    super('ClaudeService', {
      info: (msg: string) => console.log(`[ClaudeService] ${msg}`),
      error: (msg: string, error?: any) => console.error(`[ClaudeService] ${msg}`, error || ''),
      debug: (msg: string) => console.debug(`[ClaudeService] ${msg}`),
      warn: (msg: string) => console.warn(`[ClaudeService] ${msg}`)
    });
    
    // Initialize configuration
    this.config = {
      apiKey: config?.apiKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      baseUrl: config?.baseUrl || process.env.CLAUDE_API_BASE_URL || 'https://api.anthropic.com',
      apiVersion: config?.apiVersion || process.env.CLAUDE_API_VERSION || '2023-12-15',
      defaultModel: config?.defaultModel || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000,
      requestTimeout: config?.requestTimeout || 30000,
      maxConcurrentRequests: config?.maxConcurrentRequests || 5
    };
  }

  /**
   * Get the singleton instance of ClaudeService
   */
  public static getInstance(config?: ClaudeServiceConfig): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService(config);
    }
    return ClaudeService.instance;
  }

  /**
   * Ensure the service is initialized (public wrapper for protected method)
   */
  public async ensureInitialized(): Promise<void> {
    await super.ensureInitialized();
  }

  /**
   * Initialize the service and validate configuration
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('Initializing ClaudeService');
    
    // Validate API key
    if (!this.config.apiKey) {
      throw new Error('Claude API key is not configured. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY in your environment variables.');
    }
    
    // Test the connection with a minimal request
    try {
      await this.testConnection();
      this.logger?.info(`ClaudeService initialized with model: ${this.config.defaultModel}`);
    } catch (error) {
      this.logger?.error('Failed to connect to Claude API', error);
      throw error;
    }
  }

  /**
   * Release resources managed by this service
   */
  protected async releaseResources(): Promise<void> {
    // Cancel any pending requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        request.reject(new Error('Service shutting down'));
      }
    }
    
    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 5000;
    const startTime = Date.now();
    
    while (this.activeRequests > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeRequests > 0) {
      this.logger?.warn(`Shutting down with ${this.activeRequests} active requests`);
    }
    
    this.logger?.info('ClaudeService shutdown complete');
  }

  /**
   * Health check for the service
   */
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const startTime = Date.now();
      await this.testConnection();
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        details: {
          apiKey: this.config.apiKey ? 'configured' : 'missing',
          baseUrl: this.config.baseUrl,
          model: this.config.defaultModel,
          latency: `${latency}ms`,
          totalRequests: this.totalRequests,
          activeRequests: this.activeRequests,
          queueLength: this.requestQueue.length,
          tokensUsed: this.totalTokensUsed
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          apiKey: this.config.apiKey ? 'configured' : 'missing'
        }
      };
    }
  }

  /**
   * Test the connection to Claude API
   */
  private async testConnection(): Promise<void> {
    const testPrompt = 'Reply with just "OK"';
    const response = await this.sendPrompt(testPrompt, {
      maxTokens: 10,
      temperature: 0
    });
    
    if (!response.content?.[0]?.text) {
      throw new Error('Invalid response from Claude API');
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ClaudeServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger?.info('Configuration updated');
  }

  /**
   * Send a prompt to Claude API with retry logic and queuing
   */
  public async sendPrompt(prompt: string, options: ClaudeOptions = {}): Promise<ClaudeResponse> {
    await this.ensureInitialized();
    
    // Queue the request if we're at capacity
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      return this.queueRequest(() => this.doSendPrompt(prompt, options));
    }
    
    return this.doSendPrompt(prompt, options);
  }

  /**
   * Queue a request for later execution
   */
  private async queueRequest<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({ execute, resolve, reject });
      this.logger?.debug(`Request queued. Queue length: ${this.requestQueue.length}`);
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.config.maxConcurrentRequests) {
      return;
    }
    
    const request = this.requestQueue.shift();
    if (request) {
      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  /**
   * Actually send the prompt to Claude API
   */
  private async doSendPrompt(prompt: string, options: ClaudeOptions): Promise<ClaudeResponse> {
    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.3;
    const timeout = options.timeout || this.config.requestTimeout;
    const maxRetries = options.retries ?? this.config.maxRetries;
    
    this.activeRequests++;
    this.totalRequests++;
    
    try {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          const response = await fetch(`${this.config.baseUrl}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'anthropic-version': this.config.apiVersion,
              'x-api-key': this.config.apiKey,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: maxTokens,
              temperature,
              ...(options.system && { system: options.system }),
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorData = await response.text();
            const error = new Error(`Claude API error: ${response.status} - ${errorData}`);
            
            // Don't retry on 4xx errors (client errors)
            if (response.status >= 400 && response.status < 500) {
              throw error;
            }
            
            lastError = error;
            
            if (attempt < maxRetries) {
              const delay = this.config.retryDelay * Math.pow(2, attempt);
              this.logger?.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          
          const data = await response.json() as ClaudeResponse;
          
          // Track token usage
          if (data.usage) {
            this.totalTokensUsed.input += data.usage.input_tokens;
            this.totalTokensUsed.output += data.usage.output_tokens;
          }
          
          return data;
          
        } catch (error) {
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              lastError = new Error(`Request timeout after ${timeout}ms`);
            } else {
              lastError = error;
            }
            
            if (attempt < maxRetries) {
              const delay = this.config.retryDelay * Math.pow(2, attempt);
              this.logger?.warn(`Request error: ${error.message}, retrying in ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
        }
      }
      
      throw lastError || new Error('Unknown error occurred');
      
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Send a prompt and parse the response as JSON
   */
  public async getJsonResponse<T = any>(prompt: string, options: ClaudeOptions = {}): Promise<T> {
    const enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown formatting, no code blocks, no additional text. Just the raw JSON object.`;
    
    const response = await this.sendPrompt(enhancedPrompt, {
      ...options,
      temperature: 0 // Use deterministic output for JSON
    });
    
    if (!response.content?.[0]?.text) {
      throw new Error('No content in Claude response');
    }

    const text = response.content[0].text.trim();
    
    try {
      // Remove any markdown code blocks if present (fallback for non-compliant responses)
      const jsonText = text
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
        
      return JSON.parse(jsonText);
    } catch (error) {
      this.logger?.error('Failed to parse JSON response:', text);
      throw new Error(`Failed to parse Claude response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream a response from Claude (future feature)
   */
  public async streamPrompt(prompt: string, options: ClaudeOptions = {}): Promise<AsyncIterable<string>> {
    // Placeholder for streaming implementation
    throw new Error('Streaming not yet implemented');
  }

  /**
   * Get usage statistics
   */
  public getStatistics(): {
    totalRequests: number;
    activeRequests: number;
    queueLength: number;
    totalTokensUsed: { input: number; output: number };
    estimatedCost: { input: number; output: number; total: number };
  } {
    // Rough cost estimation (prices may vary)
    const inputCostPerMillion = 3.0; // $3 per million tokens
    const outputCostPerMillion = 15.0; // $15 per million tokens
    
    const inputCost = (this.totalTokensUsed.input / 1_000_000) * inputCostPerMillion;
    const outputCost = (this.totalTokensUsed.output / 1_000_000) * outputCostPerMillion;
    
    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      totalTokensUsed: { ...this.totalTokensUsed },
      estimatedCost: {
        input: inputCost,
        output: outputCost,
        total: inputCost + outputCost
      }
    };
  }

  /**
   * Reset usage statistics
   */
  public resetStatistics(): void {
    this.totalRequests = 0;
    this.totalTokensUsed = { input: 0, output: 0 };
    this.logger?.info('Usage statistics reset');
  }
}

// Export singleton instance for backwards compatibility
export const claudeService = ClaudeService.getInstance();