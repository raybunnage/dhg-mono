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

export class ClaudeService {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com';
  private apiVersion: string = '2023-06-01';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * Call the Claude API
   */
  async callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug('Calling Claude API', {
        model: request.model,
        maxTokens: request.max_tokens,
        temperature: request.temperature
      });
      
      try {
        const response = await axios.post(
          `${this.baseUrl}/v1/messages`,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': this.apiVersion
            }
          }
        );
        
        Logger.debug('Claude API call successful', { 
          status: response.status,
          statusText: response.statusText
        });
        
        return {
          success: true,
          result: response.data
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          Logger.error('Claude API call failed', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
          
          return {
            success: false,
            error: `Claude API call failed: ${error.message}`,
            result: error.response?.data
          };
        }
        
        throw error;
      }
    }, 'Claude API call failed');
  }
  
  /**
   * Classify a document using Claude
   */
  async classifyDocument(
    document: string,
    prompt: string,
    context: string
  ): Promise<ClaudeResponse> {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `I need you to analyze and classify a markdown document according to our document types.

Here is the prompt for classification:
${prompt}

Here is the context:
${context}

Now, please analyze the following markdown document and classify it according to the document types:

${document}

Please provide your classification in JSON format, including the document type ID, name, and explanation for your choice. Also include any metadata you can extract from the document.`
          }
        ]
      }
    ];
    
    const request: ClaudeRequest = {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
      temperature: 0,
      messages
    };
    
    return await this.callClaudeApi(request);
  }
}