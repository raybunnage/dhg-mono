import axios from 'axios';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/error-handler';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: TextContent[];
}

export interface ClaudeRequest {
  model: string;
  max_tokens?: number;
  temperature?: number;
  messages: Message[];
}

export interface ClaudeResponse {
  success: boolean;
  result?: any;
  error?: string;
}

// Simple rate limiter for CLI tool
// This is a simplified version that doesn't require importing the main app's rate-limiter.ts
class SimpleRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefillTimestamp: number;

  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefillTimestamp = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTimestamp) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }

  async acquire(cost = 1): Promise<void> {
    this.refillTokens();
    
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return Promise.resolve();
    }
    
    // If not enough tokens, wait and check again
    const waitTimeMs = Math.ceil((cost - this.tokens) / this.refillRate * 1000);
    Logger.debug(`Rate limiting: waiting ${waitTimeMs}ms for token refill`);
    
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.refillTokens();
        this.tokens -= cost;
        resolve();
      }, waitTimeMs);
    });
  }
}

// Create a singleton rate limiter instance
const rateLimiter = new SimpleRateLimiter(
  3,     // max tokens (requests) - allow bursts of up to 3 requests
  0.167  // refill rate (requests per second) - 10 requests per minute
);

export class ScriptClaudeService {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com'; // Claude API base URL
  private apiVersion: string = '2023-06-01';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    // DIRECT CONSOLE OUTPUT for debugging
    console.log('🔍 DEBUG - ScriptClaudeService initialized:');
    console.log(`🔑 API Key Present: ${!!apiKey} (${apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING'})`);
    console.log(`🌐 Base URL: ${this.baseUrl}`);
    console.log(`📝 API Version: ${this.apiVersion}`);
    
    // Check for common issues
    if (!apiKey) {
      console.error('⚠️ ERROR: Claude API key is missing or empty');
    } else if (apiKey.length < 20) {
      console.error('⚠️ WARNING: Claude API key looks too short - may be invalid');
    }
    
    // Check environment variables
    console.log('🔍 Environment variables check:');
    console.log(`- CLAUDE_API_KEY set: ${!!process.env.CLAUDE_API_KEY}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    
    // Explicitly show log for debugging
    Logger.debug('ScriptClaudeService initialized with API key:', 
      apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING API KEY');
  }
  
  /**
   * Call the Claude API with enhanced error reporting
   */
  async callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse> {
    // DIRECT CONSOLE OUTPUT for debugging the API call
    console.log('🔄 Calling Claude API...');
    console.log(`📋 Model: ${request.model}`);
    console.log(`🔑 API Key present: ${!!this.apiKey} (${this.apiKey ? this.apiKey.substring(0, 5) + '...' : 'MISSING'})`);
    console.log(`🌐 URL: ${this.baseUrl}/v1/messages`);
    
    // Fix the URL if it's not properly formed - this is likely the issue
    if (!this.baseUrl.startsWith('http')) {
      // Force the URL to use HTTPS
      console.log('⚠️ Missing protocol in URL - fixing by adding https://');
      this.baseUrl = 'https://api.anthropic.com';
    }
    
    try {
      // Validate API key immediately
      if (!this.apiKey) {
        console.error('❌ ERROR: Claude API key is missing');
        return {
          success: false,
          error: 'Claude API key is missing - check CLAUDE_API_KEY environment variable'
        };
      }
      
      // Construct and validate the URL
      const apiUrl = `${this.baseUrl}/v1/messages`;
      console.log(`🔗 Full API URL: ${apiUrl}`);
      
      // Explicitly test URL validity
      try {
        const urlObject = new URL(apiUrl);
        console.log(`✅ URL validation passed: ${urlObject.href}`);
      } catch (urlError) {
        console.error(`❌ INVALID URL ERROR: ${urlError instanceof Error ? urlError.message : 'Invalid URL format'}`);
        console.error(`❌ Attempted URL: ${apiUrl}`);
        
        // Return a clear error with the attempted URL
        return {
          success: false,
          error: `Invalid URL: ${apiUrl} - ${urlError instanceof Error ? urlError.message : 'Invalid URL format'}`
        };
      }
      
      // Wait for rate limiter
      console.log('⏱️ Waiting for rate limiter...');
      await rateLimiter.acquire(1);
      console.log('✅ Rate limiter approved');
      
      // Make the actual API call
      console.log('📤 Sending request to Claude API...');
      const response = await axios.post(
        apiUrl,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': this.apiVersion
          }
        }
      );
      
      // Log success details
      console.log(`✅ Claude API call successful (status ${response.status})`);
      console.log(`📥 Response type: ${typeof response.data}`);
      
      return {
        success: true,
        result: response.data
      };
    } catch (error) {
      // Print full error details to console
      console.error('❌ ERROR CALLING CLAUDE API:');
      
      if (axios.isAxiosError(error)) {
        console.error(`Status: ${error.response?.status || 'unknown'}`);
        console.error(`Message: ${error.message}`);
        console.error(`URL: ${error.config?.url || 'unknown'}`);
        console.error(`Response data:`, error.response?.data || 'none');
        
        // Check specific error types
        const isNetworkError = error.code === 'ECONNABORTED' || error.message.includes('Network Error');
        const isTimeoutError = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
        const isAuthError = error.response?.status === 401 || error.response?.status === 403;
        const isUrlError = error.message.includes('Invalid URL') || error.message.includes('ENOTFOUND');
        
        console.error(`Error type: ${
          isNetworkError ? 'NETWORK_ERROR' :
          isTimeoutError ? 'TIMEOUT_ERROR' :
          isAuthError ? 'AUTH_ERROR' :
          isUrlError ? 'URL_ERROR' : 'OTHER_ERROR'
        }`);
        
        // Create a user-friendly error message
        let errorMessage = `Claude API call failed: ${error.message}`;
        
        if (isNetworkError) {
          errorMessage = `Network error connecting to Claude API - check internet connection`;
        } else if (isTimeoutError) {
          errorMessage = `Timeout connecting to Claude API - the service may be experiencing issues`;
        } else if (isAuthError) {
          errorMessage = `Authentication error with Claude API - check your API key`;
        } else if (isUrlError) {
          errorMessage = `Invalid URL for Claude API: ${error.config?.url || this.baseUrl + '/v1/messages'}`;
        }
        
        return {
          success: false,
          error: errorMessage,
          result: error.response?.data
        };
      } else {
        // Handle non-axios errors
        console.error(`Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
        console.error(`Message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
        
        return {
          success: false,
          error: `Unexpected error calling Claude API: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  }
  
  /**
   * Analyze a script using Claude
   */
  async analyzeScript(
    scriptContent: string,
    scriptPath: string,
    prompt: string,
    scriptTypes: any[] = []
  ): Promise<ClaudeResponse> {
    // Log key information to console directly
    console.log('📋 analyzeScript called with:');
    console.log(`- Script path: ${scriptPath}`);
    console.log(`- Script content length: ${scriptContent.length} characters`);
    console.log(`- Prompt length: ${prompt.length} characters`);
    console.log(`- Script types count: ${scriptTypes.length}`);
    
    try {
      // Prepare script types information for the prompt
      let scriptTypesInfo = "";
      if (scriptTypes && scriptTypes.length > 0) {
        scriptTypesInfo = "## Available Script Types\n\n";
        scriptTypes.forEach(type => {
          scriptTypesInfo += `- ID: ${type.id}\n`;
          scriptTypesInfo += `  Name: ${type.document_type || type.name}\n`;
          scriptTypesInfo += `  Description: ${type.description || 'No description available'}\n`;
          scriptTypesInfo += `  Category: ${type.category || 'Uncategorized'}\n\n`;
        });
      }
      
      // Replace placeholders in the prompt if needed
      let finalPrompt = prompt
        .replace('{{SCRIPT_CONTENT}}', scriptContent)
        .replace('{{FILE_PATH}}', scriptPath);
      
      // Add script types information to the prompt
      if (scriptTypesInfo) {
        finalPrompt = finalPrompt.replace('{{SCRIPT_TYPES}}', scriptTypesInfo);
      }
      
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: finalPrompt
            }
          ]
        }
      ];
      
      // Simplified request
      const request: ClaudeRequest = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0,
        messages
      };
      
      console.log('Preparing to call Claude API for script analysis...');
      
      // Direct API call
      return await this.callClaudeApi(request);
    } catch (error) {
      // Log any unexpected errors outside the API call itself
      console.error('❌ UNEXPECTED ERROR in analyzeScript method:');
      console.error(error instanceof Error ? error.message : 'Unknown error');
      console.error(error instanceof Error ? error.stack : 'No stack trace');
      
      return {
        success: false,
        error: `Unexpected error in analyzeScript: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}