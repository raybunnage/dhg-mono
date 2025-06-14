/**
 * AI Processing Service - Refactored
 * 
 * Provides common AI processing utilities for document analysis, classification,
 * and content extraction using the Claude service.
 * 
 * Refactored to extend BusinessService for proper dependency injection and
 * enhanced error handling.
 */

import { BusinessService } from '../base-classes/BusinessService';
import { ClaudeService } from '../claude-service-refactored/ClaudeService';
import type { Database } from '../../../types/supabase';

// Re-export types for backward compatibility
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

// Additional types for enhanced functionality
export interface ProcessingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  totalTokensUsed: number;
}

export interface ProcessingOptions {
  maxRetries?: number;
  timeout?: number;
  temperature?: number;
  cacheDuration?: number;
}

interface CachedResult {
  result: any;
  timestamp: number;
}

/**
 * AI Processing Service for common AI operations
 */
export class AIProcessingService extends BusinessService<Database> {
  private claudeService: ClaudeService;
  private resultCache: Map<string, CachedResult> = new Map();
  private metrics: ProcessingMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0,
    totalTokensUsed: 0
  };
  private readonly defaultCacheDuration = 3600000; // 1 hour
  
  constructor(claudeService: ClaudeService) {
    super('AIProcessingService', { claudeService });
    this.claudeService = claudeService;
  }
  
  /**
   * Validate dependencies
   */
  protected validateDependencies(): void {
    if (!this.dependencies.claudeService) {
      throw new Error('ClaudeService is required');
    }
  }
  
  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    // Ensure Claude service is initialized
    await this.claudeService.ensureInitialized();
    
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 300000); // Clean every 5 minutes
  }
  
  /**
   * Process general content with AI
   */
  public async processWithAI(
    prompt: string,
    options?: ProcessingOptions
  ): Promise<any> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      const result = await this.withRetry(
        async () => {
          return await this.claudeService.sendPrompt(prompt);
        },
        { maxAttempts: options?.maxRetries || 3 }
      );
      
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(Date.now() - startTime);
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.error('AI processing error:', error);
      throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process JSON request with AI
   */
  public async processJsonRequest(
    prompt: string,
    options?: ProcessingOptions
  ): Promise<any> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      const result = await this.withRetry(
        async () => {
          return await this.claudeService.getJsonResponse(prompt);
        },
        { maxAttempts: options?.maxRetries || 3 }
      );
      
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(Date.now() - startTime);
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.error('AI JSON processing error:', error);
      throw new Error(`AI JSON processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Classify document content with caching
   */
  public async classifyDocument(
    content: string,
    documentTypes: any[],
    promptTemplate?: string
  ): Promise<ClassificationResult> {
    // Generate cache key
    const cacheKey = this.generateCacheKey('classify', content, documentTypes);
    
    // Check cache
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached classification result');
      return cached as ClassificationResult;
    }
    
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
      
      // Validate the response with enhanced validation
      const validatedResponse = this.validateInput(response, {
        document_type_id: { type: 'string', required: true },
        document_type_name: { type: 'string', required: true },
        confidence: { type: 'number', required: true, min: 0, max: 1 },
        reasoning: { type: 'string', required: true }
      });
      
      const result: ClassificationResult = {
        document_type_id: validatedResponse.document_type_id,
        document_type_name: validatedResponse.document_type_name,
        confidence: validatedResponse.confidence,
        reasoning: validatedResponse.reasoning
      };
      
      // Cache the result
      this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      this.logger.error('Document classification error:', error);
      throw new Error(`Document classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract key information from content with structured output
   */
  public async extractKeyInfo(
    content: string,
    maxLength: number = 3000
  ): Promise<KeyInfoResult> {
    const cacheKey = this.generateCacheKey('keyinfo', content);
    
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached as KeyInfoResult;
    }
    
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
      
      const result: KeyInfoResult = {
        title: response.title || undefined,
        summary: response.summary || undefined,
        keywords: Array.isArray(response.keywords) ? response.keywords : [],
        entities: Array.isArray(response.entities) ? response.entities : []
      };
      
      this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      this.logger.error('Key info extraction error:', error);
      return {};
    }
  }
  
  /**
   * Validate data structure with detailed feedback
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
        isValid: response.isValid === true,
        errors: Array.isArray(response.errors) ? response.errors : [],
        suggestions: Array.isArray(response.suggestions) ? response.suggestions : []
      };
    } catch (error) {
      this.logger.error('Data validation error:', error);
      return {
        isValid: false,
        errors: ['Failed to validate data'],
        suggestions: []
      };
    }
  }
  
  /**
   * Analyze content with enhanced metrics
   */
  public async analyzeContent(
    content: string
  ): Promise<ContentAnalysisResult> {
    const cacheKey = this.generateCacheKey('analyze', content);
    
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached as ContentAnalysisResult;
    }
    
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
      
      const result: ContentAnalysisResult = {
        sentiment: response.sentiment,
        topics: Array.isArray(response.topics) ? response.topics : [],
        language: response.language,
        readabilityScore: typeof response.readabilityScore === 'number' ? response.readabilityScore : undefined
      };
      
      this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      this.logger.error('Content analysis error:', error);
      return {};
    }
  }
  
  /**
   * Generate content based on template with variable validation
   */
  public async generateContent(
    template: string,
    variables: Record<string, any>
  ): Promise<string> {
    try {
      // Validate template has all required variables
      const requiredVars = template.match(/{{(\w+)}}/g)?.map(v => v.slice(2, -2)) || [];
      const missingVars = requiredVars.filter(v => !(v in variables));
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
      }
      
      let prompt = template;
      
      // Replace variables in template with proper escaping
      for (const [key, value] of Object.entries(variables)) {
        const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), escapedValue);
      }
      
      const response = await this.processWithAI(prompt);
      return response;
    } catch (error) {
      this.logger.error('Content generation error:', error);
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Summarize content with configurable detail level
   */
  public async summarizeContent(
    content: string,
    maxSummaryLength: number = 500,
    detailLevel: 'brief' | 'detailed' | 'comprehensive' = 'brief'
  ): Promise<string> {
    const cacheKey = this.generateCacheKey('summarize', content, maxSummaryLength, detailLevel);
    
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached as string;
    }
    
    try {
      const detailInstructions = {
        brief: 'Provide a very concise summary focusing only on the most critical points.',
        detailed: 'Provide a balanced summary covering main points and key supporting details.',
        comprehensive: 'Provide a thorough summary including main points, supporting details, and context.'
      };
      
      const prompt = `
        Please provide a ${detailLevel} summary of the following content in no more than ${maxSummaryLength} characters:
        
        ${content}
        
        ${detailInstructions[detailLevel]}
      `;
      
      const response = await this.processWithAI(prompt);
      
      this.setCachedResult(cacheKey, response);
      
      return response;
    } catch (error) {
      this.logger.error('Content summarization error:', error);
      return 'Failed to generate summary';
    }
  }
  
  /**
   * Compare content with similarity metrics
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
        similarity: typeof response.similarity === 'number' ? 
          Math.max(0, Math.min(1, response.similarity)) : 0,
        differences: Array.isArray(response.differences) ? response.differences : [],
        commonalities: Array.isArray(response.commonalities) ? response.commonalities : []
      };
    } catch (error) {
      this.logger.error('Content comparison error:', error);
      return {
        similarity: 0,
        differences: [],
        commonalities: []
      };
    }
  }
  
  /**
   * Batch process multiple items efficiently
   */
  public async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: { concurrency?: number; onProgress?: (completed: number, total: number) => void }
  ): Promise<R[]> {
    const concurrency = options?.concurrency || 3;
    const results: R[] = [];
    const queue = [...items];
    let completed = 0;
    
    const processNext = async (): Promise<void> => {
      const item = queue.shift();
      if (!item) return;
      
      try {
        const result = await processor(item);
        results.push(result);
      } catch (error) {
        this.logger.error('Batch processing error:', error);
        results.push(null as any);
      }
      
      completed++;
      options?.onProgress?.(completed, items.length);
      
      if (queue.length > 0) {
        await processNext();
      }
    };
    
    // Start concurrent processing
    const workers = Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(() => processNext());
    
    await Promise.all(workers);
    
    return results;
  }
  
  /**
   * Get processing metrics
   */
  public getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      totalTokensUsed: 0
    };
  }
  
  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    const claudeHealth = await this.claudeService.healthCheck();
    
    return {
      healthy: this.initialized && claudeHealth.healthy,
      details: {
        initialized: this.initialized,
        metrics: this.getMetrics(),
        cacheSize: this.resultCache.size,
        claudeService: claudeHealth
      }
    };
  }
  
  /**
   * Shutdown
   */
  protected async shutdown(): Promise<void> {
    this.resultCache.clear();
  }
  
  // Private helper methods
  
  private generateCacheKey(...args: any[]): string {
    return args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join('::');
  }
  
  private getCachedResult(key: string): any | null {
    const cached = this.resultCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.defaultCacheDuration) {
      this.resultCache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  private setCachedResult(key: string, result: any): void {
    this.resultCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.resultCache.entries()) {
      if (now - cached.timestamp > this.defaultCacheDuration) {
        this.resultCache.delete(key);
      }
    }
  }
  
  private updateAverageProcessingTime(duration: number): void {
    const totalTime = this.metrics.averageProcessingTime * 
      (this.metrics.successfulRequests - 1) + duration;
    this.metrics.averageProcessingTime = totalTime / this.metrics.successfulRequests;
  }
}