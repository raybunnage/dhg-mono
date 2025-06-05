/**
 * Claude Service
 * 
 * Provides integration with Claude AI models through Anthropic's API.
 * Handles API requests, rate limiting, and response parsing.
 */
import axios from 'axios';
import { config } from '../../utils';

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
 * Claude Service implementation
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
    this.apiKey = config.claudeApiKey;
    this.baseUrl = config.claudeApiBaseUrl || 'https://api.anthropic.com';
    this.apiVersion = config.claudeApiVersion || '2023-12-15';
    this.defaultModel = config.defaultModel || 'claude-sonnet-4-20250514';
    
    // Log configuration for debugging (not showing full key)
    Logger.debug(`ClaudeService initialized:
    🔑 API Key Present: ${!!this.apiKey} ${this.apiKey ? `(${this.apiKey.substring(0, 5)}...)` : ''}
    🌐 Base URL: ${this.baseUrl}
    📝 API Version: ${this.apiVersion}
    🔍 Environment variables check:
    - CLAUDE_API_KEY set: ${!!process.env.CLAUDE_API_KEY}
    - NODE_ENV: ${process.env.NODE_ENV}`);
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }
  
  /**
   * Validate API key
   */
  public validateApiKey(): boolean {
    if (!this.apiKey) {
      Logger.error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
      return false;
    }
    return true;
  }
  
  /**
   * Send a prompt to Claude
   * @param prompt The prompt to send
   * @param options Request options including model, temperature, etc.
   * @returns The response from Claude as a string
   */
  public async sendPrompt(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      system?: string;
    } = {}
  ): Promise<string> {
    if (!this.validateApiKey()) {
      throw new Error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
    }
    
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0;
    const maxTokens = options.maxTokens ?? 4000;
    const system = options.system;
    
    try {
      const requestBody: any = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };
      
      // Add system message if provided
      if (system) {
        requestBody.system = system;
      }
      
      const response = await axios.post(
        `${this.baseUrl}/v1/messages`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': this.apiVersion
          }
        }
      );
      
      // Extract the response content
      if (response.data && response.data.content && response.data.content.length > 0) {
        return response.data.content[0].text;
      } else {
        throw new Error('Invalid response format from Claude API');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        Logger.error(`Error calling Claude API: ${error.response?.data || error.message}`);
        throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
      } else {
        Logger.error(`Unknown error calling Claude API: ${error}`);
        throw error;
      }
    }
  }
  
  /**
   * Send a structured message to Claude that expects a structured response
   * @param prompt The prompt to send
   * @param options Request options including model, temperature, etc.
   * @returns The JSON response from Claude
   */
  public async getJsonResponse<T = any>(
    prompt: string,
    options: {
      jsonMode?: boolean;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      system?: string;
    } = {}
  ): Promise<T> {
    // Always use temperature 0 for JSON responses (deterministic outputs)
    options.temperature = 0;
    options.jsonMode = options.jsonMode ?? true;
    
    // Set system message for JSON responses
    if (!options.system) {
      options.system = "You are a helpful AI assistant that ONLY provides responses in valid JSON format. Your responses must be structured as valid, parseable JSON with nothing else before or after the JSON object. Do not include markdown code formatting, explanations, or any text outside the JSON object.";
    }
    
    // Add explicit JSON instructions to the prompt if needed
    let enhancedPrompt = prompt;
    
    if (options.jsonMode && !prompt.includes("valid JSON") && !prompt.includes("JSON format")) {
      enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a JSON object and nothing else. Do not include explanations, markdown formatting, or any text outside the JSON object.`;
    }
    
    try {
      // Get text response and parse as JSON
      const responseText = await this.sendPrompt(enhancedPrompt, options);
      
      try {
        // First, try to parse directly
        try {
          return JSON.parse(responseText) as T;
        } catch (initialParseError) {
          // If direct parsing fails, try cleaning the response
          
          // Remove markdown code block formatting if present
          let cleanedContent = responseText;
          if (responseText.includes('```json') || responseText.includes('```')) {
            // Extract content between markdown code blocks
            const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
              cleanedContent = codeBlockMatch[1];
              Logger.debug('Extracted JSON from markdown code block');
            }
          }
          
          // Find JSON object pattern (most reliable method)
          const jsonMatch = cleanedContent.match(/(\{[\s\S]*\})/);
          if (jsonMatch && jsonMatch[1]) {
            const jsonText = jsonMatch[1];
            Logger.debug(`Extracted JSON object pattern (${jsonText.length} chars)`);
            return JSON.parse(jsonText) as T;
          }
          
          // If we get here, rethrow the original error
          throw initialParseError;
        }
      } catch (parseError) {
        Logger.error(`Error parsing JSON from Claude API response: ${parseError}`);
        Logger.debug(`Response text: ${responseText.substring(0, 200)}...`);
        
        // Provide helpful error information
        if (responseText.includes('```')) {
          Logger.debug('Response contains markdown code blocks that may be causing parsing issues');
        }
        
        throw new Error('Invalid JSON response from Claude API');
      }
    } catch (error) {
      Logger.error(`Error getting JSON response from Claude: ${error}`);
      throw error;
    }
  }
  
  /**
   * Classify text with Claude
   * @param text Text to classify
   * @param classificationPrompt Prompt that guides classification
   * @param options Request options
   * @returns Classification results as JSON
   */
  public async classifyText<T = any>(
    text: string, 
    classificationPrompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      system?: string;
    } = {}
  ): Promise<T> {
    // Combine text with classification prompt
    const fullPrompt = `${classificationPrompt}\n\nText to classify:\n\`\`\`\n${text}\n\`\`\``;
    
    // Get JSON response
    return this.getJsonResponse<T>(fullPrompt, options);
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance();