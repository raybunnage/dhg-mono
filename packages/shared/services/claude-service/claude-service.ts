/**
 * Claude Service - Browser Version
 * 
 * Simplified version without server-side logging for browser environments
 */
import axios from 'axios';

/**
 * Claude API response structure
 */
interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude Service implementation for browser
 */
export class ClaudeService {
  private static instance: ClaudeService;
  private apiKey: string;
  private baseUrl: string;
  private apiVersion: string;
  private defaultModel: string;
  
  /**
   * Create a new Claude service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // In browser, these would come from Vite env vars
    this.apiKey = import.meta.env.VITE_CLAUDE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    this.baseUrl = import.meta.env.VITE_CLAUDE_API_BASE_URL || 'https://api.anthropic.com';
    this.apiVersion = import.meta.env.VITE_CLAUDE_API_VERSION || '2023-12-15';
    this.defaultModel = import.meta.env.VITE_DEFAULT_MODEL || 'claude-sonnet-4-20250514';
    
    if (!this.apiKey) {
      console.error('Claude API key is not set. Please set VITE_CLAUDE_API_KEY or VITE_ANTHROPIC_API_KEY environment variable.');
    }
  }
  
  /**
   * Get the singleton instance
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
   * Send a prompt to Claude
   * @param prompt The prompt to send
   * @param options Additional options
   * @returns The response from Claude
   */
  public async sendPrompt(
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      system?: string;
    } = {}
  ): Promise<string> {
    this.validateConfiguration();
    
    const requestData = {
      anthropic_version: this.apiVersion,
      max_tokens: options.maxTokens || 150000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: options.model || this.defaultModel,
      temperature: options.temperature || 0,
      ...(options.system && { system: options.system })
    };
    
    try {
      const response = await axios.post<ClaudeResponse>(
        `${this.baseUrl}/v1/messages`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': this.apiVersion
          }
        }
      );
      
      return response.data.content[0]?.text || '';
    } catch (error: any) {
      if (error.response) {
        console.error(`Error calling Claude API: ${error.response?.data || error.message}`);
        throw new Error(`Claude API error: ${error.response.status} ${error.response.statusText}`);
      } else {
        console.error(`Unknown error calling Claude API: ${error}`);
        throw error;
      }
    }
  }
  
  /**
   * Send a prompt and parse the response as JSON
   * @param prompt The prompt to send
   * @param options Additional options
   * @returns The parsed JSON response
   */
  public async getJsonResponse<T = any>(
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      system?: string;
    } = {}
  ): Promise<T> {
    const responseText = await this.sendPrompt(prompt, options);
    
    try {
      // First try direct JSON parsing
      return JSON.parse(responseText);
    } catch (parseError) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch {
          // Continue to next attempt
        }
      }
      
      // Try to find JSON object pattern
      const jsonPattern = /\{[\s\S]*\}/;
      const jsonText = responseText.match(jsonPattern)?.[0];
      if (jsonText) {
        try {
          return JSON.parse(jsonText);
        } catch {
          // Continue to error handling
        }
      }
      
      console.error(`Error parsing JSON from Claude API response: ${parseError}`);
      console.error(`Response text: ${responseText.substring(0, 200)}...`);
      
      throw new Error('Failed to parse JSON from Claude response. The response may not be valid JSON.');
    }
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance();