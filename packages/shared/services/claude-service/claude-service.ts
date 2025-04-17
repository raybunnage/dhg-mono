/**
 * Claude Service
 * 
 * Provides integration with Claude AI models through Anthropic's API.
 * Handles API requests, rate limiting, and response parsing.
 * Now includes support for direct PDF binary analysis.
 */
import axios, { AxiosInstance } from 'axios';
import { config, Logger } from '../../utils';
import * as fs from 'fs';

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
 * Claude API message content item for text
 */
interface MessageContentText {
  type: 'text';
  text: string;
}

/**
 * Claude API message content item for media
 */
interface MessageContentMedia {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Union type for message content
 */
type MessageContent = MessageContentText | MessageContentMedia;

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
  content?: MessageContent[]; // Support for direct message content array with mixed media
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
  private pdfEnabledClient: AxiosInstance;  // Special client with PDF beta headers
  private retryCount: number = 3;
  private retryDelay: number = 1000;
  
  /**
   * Create a new Claude service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.apiKey = config.claudeApiKey;
    this.baseUrl = config.claudeApiBaseUrl || 'https://api.anthropic.com';
    // Using latest API version that supports response_format parameter
    this.apiVersion = config.claudeApiVersion || '2023-12-15';
    this.defaultModel = config.defaultModel || 'claude-3-7-sonnet-20250219';
    
    // Create standard HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        'anthropic-api-version': this.apiVersion // Adding explicit API version header for new API endpoints
      }
    });
    
    // Create PDF-enabled HTTP client with proper headers
    this.pdfEnabledClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        'anthropic-api-version': this.apiVersion
        // No beta header needed for document type in content array
      }
    });
    
    // Add request logging
    this.client.interceptors.request.use((request: any) => {
      Logger.debug(`Making Claude API request to ${request.url} with method ${request.method}`);
      return request;
    });
    
    // Add request logging for PDF client
    this.pdfEnabledClient.interceptors.request.use((request: any) => {
      Logger.debug(`Making Claude PDF API request to ${request.url} with method ${request.method}`);
      return request;
    });
    
    // Log configuration for debugging (not showing full key)
    Logger.debug(`ClaudeService initialized:
    🔑 API Key Present: ${!!this.apiKey} ${this.apiKey ? `(${this.apiKey.substring(0, 5)}...)` : ''}
    🌐 Base URL: ${this.baseUrl}
    📝 API Version: ${this.apiVersion} (response_format requires 2023-12-15 or newer)
    🤖 Default Model: ${this.defaultModel}
    🔍 Environment variables check:
    - CLAUDE_API_KEY set: ${!!process.env.CLAUDE_API_KEY}
    - CLAUDE_API_VERSION set: ${!!process.env.CLAUDE_API_VERSION}
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
    options: ClaudeRequestOptions = {}
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
      
      // Log the request for debugging
      Logger.debug(`Making Claude API request with the following parameters:
      Model: ${requestBody.model}
      API Version: ${this.apiVersion}
      Has response_format: ${requestBody.response_format ? 'yes' : 'no'}
      System message length: ${requestBody.system ? requestBody.system.length : 0} chars
      User message length: ${requestBody.messages[0].content.length} chars`);
      
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
   * @param options Request options with jsonMode flag
   * @returns The JSON response from Claude
   */
  public async getJsonResponse<T = any>(
    prompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<T> {
    // Set JSON specific options
    options.temperature = options.temperature ?? 0;
    options.jsonMode = options.jsonMode ?? true;
    
    // Set system message for JSON responses
    if (!options.system) {
      options.system = "You are a helpful AI assistant that ONLY provides responses in valid JSON format. Your responses must be structured as valid, parseable JSON with nothing else before or after the JSON object. Do not include markdown code formatting, explanations, or any text outside the JSON object.";
    }
    
    // Add explicit JSON instructions to the prompt if needed
    let enhancedPrompt = prompt;
    
    // If not already formatted for JSON specifically
    if (options.jsonMode && !prompt.includes("valid JSON") && !prompt.includes("JSON format")) {
      // Add a clear instruction for JSON response
      enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a JSON object and nothing else. Do not include explanations, markdown formatting, or any text outside the JSON object.`;
    }
    
    try {
      // For jsonMode true, add response_format to API request if model supports it
      if (options.jsonMode) {
        const model = options.model || this.defaultModel;
        
        // Create request body
        const requestBody: any = {
          model: model,
          max_tokens: options.maxTokens ?? 4000,
          temperature: options.temperature,
          system: options.system,
          messages: [
            {
              role: 'user',
              content: enhancedPrompt
            }
          ]
        };
        
        // Debug log the model being used
        Logger.debug(`Using model for JSON response: ${model}`);
        
        // Add response_format for JSON responses
        // This requires API version 2023-12-15 or newer
        // All Claude 3 models support this parameter
        const supportsResponseFormat = model.includes('claude-3');
        
        Logger.debug(`JSON response request details:
        - Model: ${model}
        - API Version: ${this.apiVersion}
        - Model supports response_format: ${supportsResponseFormat ? 'yes' : 'no'}`);
        
        // We have issues with response_format parameter
        // For now, rely on text-based JSON parsing which works reliably with all Claude models
        Logger.debug(`Not using response_format parameter due to API compatibility issues`);
        
        // Adding more explicit JSON instructions to the prompt
        enhancedPrompt = `${enhancedPrompt}\n\nYou MUST respond with ONLY a valid JSON object, and nothing else. Do not include explanations, markdown formatting, or any text outside the JSON object. The response should start with '{' and end with '}' with no other text before or after.`;
        
        // Make direct API call with json_object format
        const response = await this.makeRequestWithRetries<ClaudeResponse>(
          '/v1/messages',
          requestBody
        );
        
        // Extract and parse JSON response
        if (response && response.content && response.content.length > 0) {
          const content = response.content[0].text;
          
          try {
            // First, try to parse directly
            try {
              return JSON.parse(content) as T;
            } catch (initialParseError) {
              // If direct parsing fails, try cleaning the response
              
              // Remove markdown code block formatting if present
              let cleanedContent = content;
              if (content.includes('```json') || content.includes('```')) {
                // Extract content between markdown code blocks
                const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
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
            Logger.debug(`Response text: ${content.substring(0, 200)}...`);
            
            // Provide helpful error information
            if (content.includes('```')) {
              Logger.debug('Response contains markdown code blocks that may be causing parsing issues');
            }
            
            throw new Error('Invalid JSON response from Claude API');
          }
        } else {
          throw new Error('Invalid response format from Claude API');
        }
      } else {
        // Get text response and try to parse as JSON
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
      }
    } catch (error) {
      Logger.error(`Error getting JSON response from Claude: ${error}`);
      throw error;
    }
  }
  
  /**
   * Make request with retries using standard client
   * @param endpoint API endpoint
   * @param data Request body
   * @returns API response
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
        Logger.warn(`Claude API request failed (attempt ${attempt}/${this.retryCount}): ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
        
        // Check if we should retry
        if (
          attempt < this.retryCount && 
          (error.response?.status === 429 || error.response?.status === 500)
        ) {
          // Calculate delay with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          Logger.debug(`Retrying in ${delay}ms...`);
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
   * Make request with retries using PDF-enabled client
   * @param endpoint API endpoint
   * @param data Request body
   * @returns API response
   */
  private async makeRequestWithPdfClient<T>(
    endpoint: string,
    data: any
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.pdfEnabledClient.post(endpoint, data);
        return response.data as T;
      } catch (error: any) {
        lastError = error;
        
        // Log retry attempt
        Logger.warn(`Claude PDF API request failed (attempt ${attempt}/${this.retryCount}): ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
        
        // Check if we should retry
        if (
          attempt < this.retryCount && 
          (error.response?.status === 429 || error.response?.status === 500)
        ) {
          // Calculate delay with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          Logger.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    if (axios.isAxiosError(lastError)) {
      // Provide more detailed error for PDF processing failures
      const statusCode = lastError.response?.status;
      const errorMessage = lastError.response?.data?.error?.message || lastError.message;
      
      if (statusCode === 413 || errorMessage.includes('exceeds') || errorMessage.includes('too large')) {
        throw new Error(`PDF file exceeds Claude's size limits: ${errorMessage}`);
      } else if (statusCode === 415 || errorMessage.includes('media type') || errorMessage.includes('format')) {
        throw new Error(`PDF format not supported: ${errorMessage}`);
      } else if (statusCode === 400 && errorMessage.includes('process')) {
        throw new Error(`Claude couldn't process the PDF: ${errorMessage}`);
      } else {
        throw new Error(`Claude API error: ${errorMessage}`);
      }
    } else {
      throw lastError || new Error('Unknown error calling Claude PDF API');
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
    options: ClaudeRequestOptions = {}
  ): Promise<T> {
    // Combine text with classification prompt
    const fullPrompt = `${classificationPrompt}\n\nText to classify:\n\`\`\`\n${text}\n\`\`\``;
    
    // Get JSON response
    return this.getJsonResponse<T>(fullPrompt, options);
  }
  
  /**
   * Convert a file to base64 encoding
   * @param filePath Path to the file to encode
   * @returns Base64 encoded string
   */
  private async fileToBase64(filePath: string): Promise<string> {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer.toString('base64');
    } catch (error) {
      Logger.error(`Error reading file at ${filePath}: ${error}`);
      throw new Error(`Failed to read file for base64 encoding: ${error}`);
    }
  }
  
  /**
   * Get the media type based on file extension
   * @param filePath Path to the file
   * @returns Media type string
   */
  private getMediaType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    // Map common extensions to media types
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        // Default to octet-stream for unknown types
        return 'application/octet-stream';
    }
  }
  
  /**
   * Analyze a PDF document using Claude's binary format handling
   * This allows Claude to directly read and understand PDF content
   * 
   * NOTE: The current Claude API only supports images, not PDFs directly
   * This method now includes a fallback to handle the limitation
   * 
   * @param pdfPath Path to the PDF file
   * @param prompt The text prompt to accompany the PDF
   * @param options Request options
   * @returns Claude's analysis of the PDF content
   */
  public async analyzePdf(
    pdfPath: string,
    prompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<string> {
    if (!this.validateApiKey()) {
      throw new Error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
    }
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at path: ${pdfPath}`);
    }
    
    try {
      // Check PDF file size - Claude has a 10MB limit for binary attachments
      const stats = fs.statSync(pdfPath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      if (fileSizeInMB > 10) {
        throw new Error(`PDF file is too large (${fileSizeInMB.toFixed(2)}MB). Claude has a 10MB limit for PDF files.`);
      }
      
      // Encode PDF as base64
      const base64Data = await this.fileToBase64(pdfPath);
      
      // Set up request options
      const model = options.model || this.defaultModel;
      const temperature = options.temperature ?? 0;
      const maxTokens = options.maxTokens ?? 4000;
      
      // Create messages with proper document type and PDF content
      const messageContent = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ];
      
      // Create request body with proper type support
      const requestBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ]
      } as any; // Using any to handle system parameter
      
      // Add system message if provided
      if (options.system) {
        requestBody.system = options.system;
      }
      
      Logger.debug(`Making Claude API request with PDF content:
      Model: ${model}
      PDF path: ${pdfPath}
      PDF size: ${fileSizeInMB.toFixed(2)}MB
      Content items: ${messageContent.length}`);
      
      // Make request with retries using PDF-enabled client
      try {
        // Use the PDF-enabled client with the beta header
        const response = await this.makeRequestWithPdfClient<ClaudeResponse>(
          '/v1/messages',
          requestBody
        );
        
        // Extract the response content
        if (response && response.content && response.content.length > 0) {
          return response.content[0].text;
        } else {
          throw new Error('Invalid response format from Claude API');
        }
      } catch (pdfError) {
        // Log the error but throw it up - no fallbacks
        Logger.error(`Error processing PDF with Claude: ${pdfError}`);
        throw pdfError;
      }
    } catch (error) {
      // Log and rethrow - no fallbacks
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;
        
        // Special handling for common PDF processing errors
        if (statusCode === 413 || errorMessage.includes('exceeds') || errorMessage.includes('too large')) {
          throw new Error(`PDF file exceeds Claude's size limits: ${errorMessage}`);
        } else if (statusCode === 415 || errorMessage.includes('media type') || errorMessage.includes('format')) {
          throw new Error(`PDF format not supported: ${errorMessage}`);
        } else if (statusCode === 400 && errorMessage.includes('process')) {
          throw new Error(`Claude couldn't process the PDF: ${errorMessage}. The PDF may be corrupt, password-protected, or in an unsupported format.`);
        } else {
          throw new Error(`Claude API error: ${errorMessage}`);
        }
      } else {
        Logger.error(`Unknown error calling Claude API with PDF: ${error}`);
        throw error;
      }
    }
  }
  
  /**
   * Analyze a PDF and get a JSON response
   * Allows for structured analysis of PDF content
   * @param pdfPath Path to the PDF file
   * @param prompt The text prompt to accompany the PDF
   * @param options Request options
   * @returns JSON response from Claude's analysis
   */
  public async analyzePdfToJson<T = any>(
    pdfPath: string,
    prompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<T> {
    // Set JSON specific options
    options.temperature = options.temperature ?? 0;
    
    // Set JSON-specific system message if not provided
    if (!options.system) {
      options.system = "You are a helpful AI assistant that analyzes PDF documents and ONLY provides responses in valid JSON format. Your responses must be structured as valid, parseable JSON with nothing else before or after the JSON object. Do not include markdown code formatting, explanations, or any text outside the JSON object.";
    }
    
    // Add explicit JSON instructions to the prompt
    let enhancedPrompt = prompt;
    if (!prompt.includes("valid JSON") && !prompt.includes("JSON format")) {
      enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a JSON object and nothing else. Do not include explanations, markdown formatting, or any text outside the JSON object. The response should start with '{' and end with '}' with no other text before or after.`;
    }
    
    // Get text response from PDF analysis with enhanced prompt
    const textResponse = await this.analyzePdf(pdfPath, enhancedPrompt, options);
    
    try {
      // Try to parse JSON directly
      try {
        return JSON.parse(textResponse) as T;
      } catch (error) {
        // If direct parsing fails, try cleaning the response
        const initialParseError = error as Error;
        Logger.warn(`Initial JSON parse failed: ${initialParseError.message}. Attempting to clean response.`);
        
        // Remove markdown code block formatting if present
        let cleanedContent = textResponse;
        if (textResponse.includes('```json') || textResponse.includes('```')) {
          // Extract content between markdown code blocks
          const codeBlockMatch = textResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            cleanedContent = codeBlockMatch[1];
            Logger.debug('Extracted JSON from markdown code block');
          }
        }
        
        // Find JSON object pattern (strict matching)
        const jsonMatch = cleanedContent.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
          const jsonText = jsonMatch[1];
          Logger.debug(`Extracted JSON object pattern (${jsonText.length} chars)`);
          try {
            return JSON.parse(jsonText) as T;
          } catch (error) {
            const jsonError = error as Error;
            Logger.error(`Failed to parse extracted JSON: ${jsonError.message}`);
            // Continue to error handling
          }
        }
        
        // If we get here, provide a detailed error with context
        Logger.error(`Failed to parse JSON from response. First 200 chars of response: ${textResponse.substring(0, 200)}...`);
        throw new Error(`Failed to parse JSON from Claude's response: ${initialParseError.message}`);
      }
    } catch (error) {
      Logger.error(`Error processing JSON from Claude's PDF analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Classify a PDF document with Claude
   * @param pdfPath Path to the PDF file
   * @param classificationPrompt Prompt that guides classification
   * @param options Request options
   * @returns Classification results as JSON
   */
  public async classifyPdf<T = any>(
    pdfPath: string, 
    classificationPrompt: string,
    options: ClaudeRequestOptions = {}
  ): Promise<T> {
    // Set classification-specific options
    if (!options.system) {
      options.system = "You are a helpful AI assistant that accurately classifies PDF documents based on their content. You examine the entire document and provide detailed classification results as valid JSON. Your analysis is thorough and considers both the structure and content of the document.";
    }
    
    // Add explicit classification instructions if not already present
    let enhancedPrompt = classificationPrompt;
    if (!classificationPrompt.includes("classify") && !classificationPrompt.includes("categorize")) {
      enhancedPrompt = `Please carefully analyze and classify the attached PDF document. ${classificationPrompt}`;
    }
    
    // Use enhanced analyzePdfToJson with the classification prompt
    return this.analyzePdfToJson<T>(pdfPath, enhancedPrompt, {
      ...options,
      temperature: options.temperature ?? 0 // Ensure deterministic output for classification
    });
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance();