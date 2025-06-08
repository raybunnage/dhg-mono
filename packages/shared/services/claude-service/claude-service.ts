// Type definitions
interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

interface ClaudeResponse {
  content?: Array<{ text: string }>;
  [key: string]: any;
}

/**
 * ClaudeService - Singleton service for interacting with Claude API
 * 
 * This service handles communication with the Claude AI API, including:
 * - Sending prompts and receiving responses
 * - Parsing JSON responses
 * - Managing API configuration and authentication
 * 
 * Usage:
 * ```typescript
 * import { claudeService } from '@shared/services/claude-service';
 * 
 * const response = await claudeService.sendPrompt('Your prompt here');
 * const jsonData = await claudeService.getJsonResponse('Return JSON data');
 * ```
 */
export class ClaudeService {
  private static instance: ClaudeService;
  private apiKey: string;
  private baseUrl: string;
  private apiVersion: string;
  private defaultModel: string;

  private constructor() {
    // In Node.js/CommonJS contexts (like CLI pipelines), use process.env
    // The browser apps should pass config through dependency injection instead
    this.apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = process.env.CLAUDE_API_BASE_URL || 'https://api.anthropic.com';
    this.apiVersion = process.env.CLAUDE_API_VERSION || '2023-12-15';
    this.defaultModel = process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';

    if (!this.apiKey) {
      console.error('Claude API key is not configured. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY in your environment variables.');
    }
  }

  /**
   * Get the singleton instance of ClaudeService
   */
  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  /**
   * Validate that the service is properly configured
   */
  private validateConfiguration(): void {
    if (!this.apiKey) {
      throw new Error('Claude API key is not configured');
    }
  }

  /**
   * Send a prompt to Claude API
   */
  public async sendPrompt(prompt: string, options: ClaudeOptions = {}): Promise<ClaudeResponse> {
    this.validateConfiguration();

    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.3;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': this.apiVersion,
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
          ...(options.system && { system: options.system }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json() as ClaudeResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to communicate with Claude API: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send a prompt and parse the response as JSON
   */
  public async getJsonResponse<T = any>(prompt: string, options: ClaudeOptions = {}): Promise<T> {
    const enhancedPrompt = `${prompt}\n\nPlease respond with valid JSON only, no additional text or markdown formatting.`;
    const response = await this.sendPrompt(enhancedPrompt, options);
    
    if (!response.content?.[0]?.text) {
      throw new Error('No content in Claude response');
    }

    const text = response.content[0].text.trim();
    
    try {
      // Remove any markdown code blocks if present
      const jsonText = text.replace(/^```json\s*\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance();
