import axios from 'axios';
import { config } from '../utils';
import { Logger } from '../utils';

/**
 * Claude API service for interacting with Anthropic's Claude models
 */
export class ClaudeService {
  private apiKey: string;
  private baseUrl: string;
  private apiVersion: string;

  /**
   * Create a new Claude service
   */
  constructor() {
    this.apiKey = config.claudeApiKey;
    this.baseUrl = config.claudeApiBaseUrl;
    this.apiVersion = config.claudeApiVersion;

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
   * Send a prompt to Claude
   * @param prompt The prompt to send
   * @param model The model to use
   * @param temperature The temperature to use
   * @param maxTokens The maximum tokens to generate
   * @returns The response from Claude
   */
  public async sendPrompt(
    prompt: string,
    model: string = config.defaultModel,
    temperature: number = 0.7,
    maxTokens: number = 4000
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/messages`,
        {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
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
        Logger.error('Error calling Claude API:', error.response?.data || error.message);
        throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
      } else {
        Logger.error('Unknown error calling Claude API:', error);
        throw error;
      }
    }
  }

  /**
   * Send a structured message to Claude that expects a structured response
   * @param prompt The prompt to send
   * @param jsonMode Whether to use JSON mode
   * @param model The model to use
   * @param temperature The temperature to use
   * @param maxTokens The maximum tokens to generate
   * @returns The JSON response from Claude
   */
  public async getJsonResponse(
    prompt: string,
    jsonMode: boolean = true,
    model: string = config.defaultModel,
    temperature: number = 0.2,
    maxTokens: number = 4000
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/messages`,
        {
          model,
          max_tokens: maxTokens,
          temperature,
          system: "You are a helpful AI assistant that provides responses in valid JSON format. Your responses should be structured, well-formatted, and adhere strictly to JSON syntax.",
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: jsonMode ? { type: "json_object" } : { type: "text" }
        },
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
        const content = response.data.content[0].text;
        
        if (jsonMode) {
          try {
            return JSON.parse(content);
          } catch (parseError) {
            Logger.error('Error parsing JSON from Claude API response:', parseError);
            throw new Error('Invalid JSON response from Claude API');
          }
        }
        
        return content;
      } else {
        throw new Error('Invalid response format from Claude API');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        Logger.error('Error calling Claude API:', error.response?.data || error.message);
        throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
      } else {
        Logger.error('Unknown error calling Claude API:', error);
        throw error;
      }
    }
  }
}