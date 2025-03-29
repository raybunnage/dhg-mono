/**
 * Claude Service
 * 
 * Provides integration with Claude AI models through Anthropic's API.
 * Handles API requests, rate limiting, and response parsing.
 */
import axios, { AxiosInstance } from 'axios';
import { environmentService } from './environment-service';
import { logger } from './logger-service';

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
 * Claude API request options
 */
interface ClaudeRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  jsonMode?: boolean;
  jsonSchema?: any; // Optional JSON schema for structured outputs
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
  private client: AxiosInstance;
  private retryCount: number = 3;
  private retryDelay: number = 1000;
  
  /**
   * Create a new Claude service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    const config = environmentService.getConfig();
    
    this.apiKey = config.claudeApiKey;
    this.baseUrl = config.claudeApiBaseUrl || 'https://api.anthropic.com';
    this.apiVersion = config.claudeApiVersion || '2023-06-01';
    this.defaultModel = 'claude-3-7-sonnet-20250219';
    
    // Create HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion
      }
    });
    
    // Add request logging
    this.client.interceptors.request.use((request: any) => {
      logger.debug('Making Claude API request', { 
        url: request.url,
        method: request.method,
        headers: {
          'Content-Type': request.headers['Content-Type'],
          'anthropic-version': request.headers['anthropic-version']
        }
      });
      return request;
    });
    
    // Log successful initialization
    logger.debug('Claude Service initialized', {
      baseUrl: this.baseUrl,
      apiVersion: this.apiVersion,
      apiKeyPresent: !!this.apiKey
    });
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
      logger.error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
      return false;
    }
    return true;
  }
  
  /**
   * Send a prompt to Claude
   */
  public async sendPrompt(
    prompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<string> {
    if (!this.validateApiKey()) {
      throw new Error('Claude API key is not set');
    }
    
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;
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
      
      // Skip response_format for now - the models being used may not support it properly
      
      // Make request with retries
      const response = await this.makeRequestWithRetries<ClaudeResponse>(
        '/v1/messages',
        requestBody
      );
      
      // Extract the response content
      if (response && response.content && response.content.length > 0) {
        return response.content[0].text;
      } else {
        throw new Error('Invalid response format from Claude API');
      }
    } catch (error) {
      logger.error('Error calling Claude API:', error);
      throw error;
    }
  }
  
  /**
   * Send a request and get JSON response
   */
  public async getJsonResponse<T = any>(
    prompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<T> {
    // Set JSON specific options
    options.temperature = options.temperature ?? 0.2;
    
    // Set system message for JSON responses
    if (!options.system) {
      options.system = "You are a helpful AI assistant that ONLY provides responses in valid JSON format. Your responses must be structured as valid, parseable JSON with nothing else before or after the JSON object. Do not include markdown code formatting, explanations, or any text outside the JSON object.";
    }
    
    // Add explicit JSON instructions to the prompt
    let enhancedPrompt = prompt;
    
    // If not already formatted for JSON specifically
    if (!prompt.includes("valid JSON") && !prompt.includes("JSON format")) {
      // Add a clear instruction for JSON response
      enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a JSON object and nothing else. Do not include explanations, markdown formatting, or any text outside the JSON object. The response must be valid, parseable JSON that follows this structure for document classification:\n
{
  "document_type_id": "the ID of the selected document type",
  "document_type": "the name of the document type",
  "confidence": 0.95, // a number between 0-1
  "rationale": "brief explanation of classification"
}`;
    }
    
    // Get response
    const responseText = await this.sendPrompt(enhancedPrompt, options);
    
    try {
      // Find and extract JSON from the response if embedded in other text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      
      return JSON.parse(jsonText) as T;
    } catch (parseError) {
      logger.error('Error parsing JSON from Claude API response:', parseError);
      logger.debug('Response text:', { text: responseText });
      throw new Error('Invalid JSON response from Claude API');
    }
  }
  
  /**
   * Make request with retries
   */
  private async makeRequestWithRetries<T>(
    endpoint: string,
    data: any
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.client.post(endpoint, data);
        return response.data as T;
      } catch (error: any) {
        lastError = error;
        
        // Log retry attempt
        logger.warn(`Claude API request failed (attempt ${attempt}/${this.retryCount})`, {
          status: error.response?.status,
          message: error.response?.data?.error?.message || error.message
        });
        
        // Check if we should retry
        if (
          attempt < this.retryCount && 
          (error.response?.status === 429 || error.response?.status === 500)
        ) {
          // Calculate delay with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    if (axios.isAxiosError(lastError)) {
      throw new Error(
        `Claude API error: ${lastError.response?.data?.error?.message || lastError.message}`
      );
    } else {
      throw lastError || new Error('Unknown error calling Claude API');
    }
  }
  
  /**
   * Classify text with Claude
   */
  public async classifyText<T = any>(
    text: string, 
    classificationPrompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<T> {
    // Combine text with classification prompt
    const fullPrompt = `${classificationPrompt}\n\nText to classify:\n\`\`\`\n${text}\n\`\`\``;
    
    // Get JSON response
    return this.getJsonResponse<T>(fullPrompt, options);
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance();