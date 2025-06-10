/**
 * AI Processing Service
 * 
 * Provides common AI processing utilities for document analysis, classification,
 * and content extraction using the Claude service
 */

import { claudeService } from '../claude-service/claude-service';

export interface ClassificationResult {
  document_type_id: string;
  document_type_name: string;
  confidence: number;
  reasoning: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

export interface KeyInfoResult {
  title?: string;
  summary?: string;
  keywords?: string[];
  entities?: string[];
}

export interface ContentAnalysisResult {
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics?: string[];
  language?: string;
  readabilityScore?: number;
}

/**
 * AI Processing Service for common AI operations
 */
export class AIProcessingService {
  private static instance: AIProcessingService;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): AIProcessingService {
    if (!AIProcessingService.instance) {
      AIProcessingService.instance = new AIProcessingService();
    }
    return AIProcessingService.instance;
  }
  
  /**
   * Process general content with AI
   */
  public async processWithAI(prompt: string): Promise<any> {
    try {
      const response = await claudeService.sendPrompt(prompt);
      return response;
    } catch (error) {
      console.error('AI processing error:', error);
      throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process JSON request with AI
   */
  public async processJsonRequest(prompt: string): Promise<any> {
    try {
      const response = await claudeService.getJsonResponse(prompt);
      return response;
    } catch (error) {
      console.error('AI JSON processing error:', error);
      throw new Error(`AI JSON processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Classify document content
   */
  public async classifyDocument(
    content: string,
    documentTypes: any[],
    promptTemplate?: string
  ): Promise<ClassificationResult> {
    try {
      const defaultTemplate = `
        You are a document classification expert. Analyze the following document content and classify it into one of the provided document types.
        
        Document Types:
        {{document_types}}
        
        Document Content:
        {{content}}
        
        Please respond with a JSON object containing:
        - document_type_id: the ID of the best matching document type
        - document_type_name: the name of the selected document type
        - confidence: a number between 0 and 1 indicating confidence in the classification
        - reasoning: a brief explanation of why this classification was chosen
      `;
      
      const template = promptTemplate || defaultTemplate;
      const prompt = template
        .replace('{{document_types}}', JSON.stringify(documentTypes, null, 2))
        .replace('{{content}}', content.substring(0, 4000)); // Limit content to avoid token limits
      
      const response = await this.processJsonRequest(prompt);
      
      // Validate the response
      if (!response.document_type_id || !response.document_type_name || 
          typeof response.confidence !== 'number' || !response.reasoning) {
        throw new Error('Invalid classification response format');
      }
      
      return {
        document_type_id: response.document_type_id,
        document_type_name: response.document_type_name,
        confidence: response.confidence,
        reasoning: response.reasoning
      };
    } catch (error) {
      console.error('Document classification error:', error);
      throw new Error(`Document classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract key information from content
   */
  public async extractKeyInfo(content: string, maxLength: number = 3000): Promise<KeyInfoResult> {
    try {
      const prompt = `
        Extract key information from this document content:
        
        ${content.substring(0, maxLength)}
        
        Please respond with a JSON object containing:
        - title: suggested title for the document
        - summary: brief summary (max 200 words)
        - keywords: array of relevant keywords (5-10 keywords)
        - entities: array of people, organizations, or concepts mentioned
      `;
      
      const response = await this.processJsonRequest(prompt);
      
      return {
        title: response.title,
        summary: response.summary,
        keywords: response.keywords || [],
        entities: response.entities || []
      };
    } catch (error) {
      console.error('Key info extraction error:', error);
      return {};
    }
  }
  
  /**
   * Validate data structure
   */
  public async validateData(
    data: any,
    validationRules?: string
  ): Promise<ValidationResult> {
    try {
      const defaultRules = 'Check for completeness, consistency, and data quality';
      const prompt = `
        Validate this data and provide feedback:
        
        ${JSON.stringify(data, null, 2)}
        
        Validation Rules: ${validationRules || defaultRules}
        
        Please respond with a JSON object containing:
        - isValid: boolean indicating if the data is valid
        - errors: array of validation errors found
        - suggestions: array of suggestions for improvement
      `;
      
      const response = await this.processJsonRequest(prompt);
      
      return {
        isValid: response.isValid || false,
        errors: response.errors || [],
        suggestions: response.suggestions || []
      };
    } catch (error) {
      console.error('Data validation error:', error);
      return {
        isValid: false,
        errors: ['Failed to validate data'],
        suggestions: []
      };
    }
  }
  
  /**
   * Analyze content for sentiment, topics, etc.
   */
  public async analyzeContent(content: string): Promise<ContentAnalysisResult> {
    try {
      const prompt = `
        Analyze the following content and provide insights:
        
        ${content.substring(0, 3000)}
        
        Please respond with a JSON object containing:
        - sentiment: overall sentiment (positive, negative, neutral, or mixed)
        - topics: array of main topics discussed
        - language: detected language
        - readabilityScore: estimated reading level (1-100, where 100 is most readable)
      `;
      
      const response = await this.processJsonRequest(prompt);
      
      return {
        sentiment: response.sentiment,
        topics: response.topics || [],
        language: response.language,
        readabilityScore: response.readabilityScore
      };
    } catch (error) {
      console.error('Content analysis error:', error);
      return {};
    }
  }
  
  /**
   * Generate content based on template
   */
  public async generateContent(
    template: string,
    variables: Record<string, any>
  ): Promise<string> {
    try {
      let prompt = template;
      
      // Replace variables in template
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
      
      const response = await this.processWithAI(prompt);
      return response;
    } catch (error) {
      console.error('Content generation error:', error);
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Summarize long content
   */
  public async summarizeContent(
    content: string,
    maxSummaryLength: number = 500
  ): Promise<string> {
    try {
      const prompt = `
        Please provide a concise summary of the following content in no more than ${maxSummaryLength} characters:
        
        ${content}
        
        Focus on the main points and key takeaways.
      `;
      
      const response = await this.processWithAI(prompt);
      return response;
    } catch (error) {
      console.error('Content summarization error:', error);
      return 'Failed to generate summary';
    }
  }
  
  /**
   * Compare two pieces of content
   */
  public async compareContent(
    content1: string,
    content2: string
  ): Promise<{
    similarity: number;
    differences: string[];
    commonalities: string[];
  }> {
    try {
      const prompt = `
        Compare these two pieces of content and identify similarities and differences:
        
        Content 1:
        ${content1.substring(0, 2000)}
        
        Content 2:
        ${content2.substring(0, 2000)}
        
        Please respond with a JSON object containing:
        - similarity: a number between 0 and 1 indicating how similar the contents are
        - differences: array of key differences
        - commonalities: array of common elements
      `;
      
      const response = await this.processJsonRequest(prompt);
      
      return {
        similarity: response.similarity || 0,
        differences: response.differences || [],
        commonalities: response.commonalities || []
      };
    } catch (error) {
      console.error('Content comparison error:', error);
      return {
        similarity: 0,
        differences: [],
        commonalities: []
      };
    }
  }
}

// The class is already exported above
// No need for additional export statement