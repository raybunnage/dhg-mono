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

Please provide your classification in JSON format with fields that match directly with the documentation_files table structure:
{
  "document_type_id": "uuid-of-matched-document-type-from-the-document_types-list-above",
  "document_type": "Name of the document type EXACTLY as it appears in the document_types list above",
  "title": "Document title extracted from content",
  "summary": "Concise summary of document purpose and content",
  "ai_generated_tags": ["topic1", "topic2", "topic3"],
  "assessment_quality_score": 0.XX, // confidence score between 0 and 1
  "classification_reasoning": "Detailed explanation for why this document type was chosen",
  "audience": "Target audience for this document",
  "quality_assessment": {
    "completeness": 1-5 score,
    "clarity": 1-5 score,
    "accuracy": 1-5 score,
    "overall": 1-5 score
  },
  "suggested_improvements": [
    "Improvement suggestion 1",
    "Improvement suggestion 2"
  ]
}

IMPORTANT: 
1. For the document_type_id field, use the exact ID value from the document_types list provided above
2. Match the document type name precisely with one from the list
3. The field names must match exactly with the documentation_files table structure
4. Use ai_generated_tags (not key_topics or tags) for consistency with the database
5. Provide assessment_quality_score as a decimal between 0 and 1

Your response should be strictly JSON without any explanatory text before or after.`
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