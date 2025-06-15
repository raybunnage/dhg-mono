/**
 * Unified Classification Service (Refactored)
 * 
 * Handles document classification for all file types through a single interface.
 * Refactored from singleton to BusinessService with dependency injection.
 */

import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { 
  ClassificationOptions, 
  ClassificationResult, 
  BatchClassificationResult,
  SourceFile,
  SupportedFileType,
  MimeTypePromptMap,
  ContentExtractionResult,
  Concept,
  UnifiedClassificationServiceMetrics,
  UnifiedClassificationServiceConfig
} from './types';
import { Logger } from '../base-classes/BaseService';
import { Database } from '../../../../supabase/types';

type GoogleSource = Database['public']['Tables']['google_sources']['Row'];
type ExpertDocument = Database['public']['Tables']['google_expert_documents']['Row'];

export class UnifiedClassificationService extends BusinessService {
  private metrics: UnifiedClassificationServiceMetrics = {
    classificationsRequested: 0,
    classificationsCompleted: 0,
    classificationsFailed: 0,
    filesProcessed: 0,
    filesSkipped: 0,
    contentExtractionAttempts: 0,
    contentExtractionSuccesses: 0,
    contentExtractionFailures: 0,
    promptsUsed: 0,
    claudeApiCalls: 0,
    databaseUpdates: 0,
    conceptsSaved: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0
  };

  private lastOperationTime: Date = new Date();

  // Mime type to prompt mapping
  private mimeTypeToPromptMap: MimeTypePromptMap = {
    // Documents
    'application/pdf': 'pdf-classification-prompt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document-classification-prompt-new',
    'application/msword': 'document-classification-prompt-new',
    'text/plain': 'text-classification-prompt',
    'text/markdown': 'markdown-document-classification-prompt',
    
    // Presentations
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint-classification-prompt',
    'application/vnd.ms-powerpoint': 'powerpoint-classification-prompt',
    'application/vnd.google-apps.presentation': 'google-slides-classification-prompt',
    
    // Spreadsheets
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet-classification-prompt',
    'application/vnd.ms-excel': 'spreadsheet-classification-prompt',
    'application/vnd.google-apps.spreadsheet': 'google-sheets-classification-prompt',
    
    // Media
    'video/mp4': 'video-classification-prompt',
    'video/quicktime': 'video-classification-prompt',
    'audio/x-m4a': 'audio-classification-prompt',
    'audio/mpeg': 'audio-classification-prompt',
    'audio/mp3': 'audio-classification-prompt',
    
    // Google Docs
    'application/vnd.google-apps.document': 'google-doc-classification-prompt',
    
    // Images
    'image/jpeg': 'image-classification-prompt',
    'image/png': 'image-classification-prompt',
    'image/gif': 'image-classification-prompt',
  };

  // File extension to mime type mapping for fallback
  private extensionToMimeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'm4a': 'audio/x-m4a',
    'mp3': 'audio/mpeg',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
  };

  constructor(
    private supabase: SupabaseClient<any>,
    private config: UnifiedClassificationServiceConfig,
    logger?: Logger
  ) {
    super('UnifiedClassificationService', { 
      supabase, 
      ...config 
    }, logger);
  }

  protected validateDependencies(): void {
    if (!this.dependencies.googleDriveService) {
      throw new Error('UnifiedClassificationServiceConfig.googleDriveService is required');
    }
    if (!this.dependencies.promptService) {
      throw new Error('UnifiedClassificationServiceConfig.promptService is required');
    }
    if (!this.dependencies.claudeService) {
      throw new Error('UnifiedClassificationServiceConfig.claudeService is required');
    }
    if (!this.dependencies.pdfProcessorService) {
      throw new Error('UnifiedClassificationServiceConfig.pdfProcessorService is required');
    }
    if (!this.dependencies.filterService) {
      throw new Error('UnifiedClassificationServiceConfig.filterService is required');
    }
    if (!this.dependencies.supabase) {
      throw new Error('SupabaseClient is required');
    }
  }

  protected async initialize(): Promise<void> {
    // Service is ready to use immediately after dependency validation
    this.logger?.info('UnifiedClassificationService initialized');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any>; timestamp: Date; latencyMs?: number }> {
    const startTime = Date.now();
    const checks = {
      databaseConnected: false,
      googleDriveService: false,
      promptService: false,
      claudeService: false,
      lastOperationTime: this.lastOperationTime.toISOString()
    };

    try {
      // Check database connection
      const { error: dbError } = await this.supabase
        .from('google_sources')
        .select('id')
        .limit(1);
      checks.databaseConnected = !dbError;

      // Check services health
      if (this.config.googleDriveService && typeof this.config.googleDriveService.getHealthStatus === 'function') {
        const driveHealth = await this.config.googleDriveService.getHealthStatus();
        checks.googleDriveService = driveHealth.healthy;
      }

      if (this.config.promptService && typeof this.config.promptService.getHealthStatus === 'function') {
        const promptHealth = await this.config.promptService.getHealthStatus();
        checks.promptService = promptHealth.healthy;
      }

      if (this.config.claudeService && typeof this.config.claudeService.getHealthStatus === 'function') {
        const claudeHealth = await this.config.claudeService.getHealthStatus();
        checks.claudeService = claudeHealth.healthy;
      }

    } catch (error) {
      this.logger?.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    }

    const healthy = checks.databaseConnected && 
                   checks.googleDriveService && 
                   checks.promptService && 
                   checks.claudeService;

    const latencyMs = Date.now() - startTime;

    return { 
      healthy, 
      details: { ...checks, metrics: this.metrics }, 
      timestamp: new Date(),
      latencyMs
    };
  }

  protected async cleanup(): Promise<void> {
    // No specific cleanup needed for this service
    this.logger?.info('UnifiedClassificationService cleaned up');
  }


  getMetrics(): UnifiedClassificationServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Main entry point for document classification
   */
  async classifyDocuments(options: ClassificationOptions = {}): Promise<BatchClassificationResult> {
    const startTime = Date.now();
    const results: ClassificationResult[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    this.metrics.classificationsRequested++;
    this.lastOperationTime = new Date();

    try {
      this.logger?.info('Starting document classification', { options });

      // Get files to process
      const files = await this.getFilesToProcess(options);
      
      if (files.length === 0) {
        this.logger?.info('No files found to process');
        return this.createBatchResult(results, errors, startTime);
      }

      this.logger?.info(`Found ${files.length} files to process`);

      // Process files with concurrency control
      const concurrency = options.concurrency || 3;
      const chunks = this.chunkArray(files, concurrency);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(file => this.processFile(file, options));
        const chunkResults = await Promise.allSettled(chunkPromises);

        for (let i = 0; i < chunkResults.length; i++) {
          const result = chunkResults[i];
          const file = chunk[i];

          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
            if (result.value.success) {
              this.metrics.classificationsCompleted++;
            } else {
              this.metrics.classificationsFailed++;
            }
          } else if (result.status === 'rejected') {
            const error = result.reason?.message || 'Unknown error';
            errors.push({ fileName: file.name, error });
            this.metrics.classificationsFailed++;
            this.metrics.errors++;
            results.push({
              sourceId: file.id,
              fileName: file.name,
              mimeType: file.mime_type,
              documentTypeId: '',
              documentTypeName: '',
              confidence: 0,
              reasoning: '',
              error,
              success: false
            });
          }
        }
      }

      const batchResult = this.createBatchResult(results, errors, startTime);
      this.metrics.totalProcessingTime += batchResult.processingTime;
      this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.classificationsRequested;

      this.logger?.info('Document classification completed', {
        totalFiles: batchResult.totalFiles,
        successful: batchResult.successfulFiles,
        failed: batchResult.failedFiles,
        processingTime: batchResult.processingTime
      });

      return batchResult;

    } catch (error) {
      this.metrics.classificationsFailed++;
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Error in classifyDocuments', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Process a single file
   */
  private async processFile(file: SourceFile, options: ClassificationOptions): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      if (options.verbose) {
        this.logger?.info(`Processing file: ${file.name} (${file.mime_type})`);
      }

      // Check if already classified and skip if requested
      if (!options.force && options.skipClassified && file.document_type_id) {
        if (options.verbose) {
          this.logger?.info(`Skipping already classified file: ${file.name}`);
        }
        this.metrics.filesSkipped++;
        return {
          sourceId: file.id,
          fileName: file.name,
          mimeType: file.mime_type,
          documentTypeId: file.document_type_id,
          documentTypeName: 'Already classified',
          confidence: 1,
          reasoning: 'File was already classified',
          success: true,
          processingTime: Date.now() - startTime
        };
      }

      // Extract content based on file type
      this.metrics.contentExtractionAttempts++;
      const contentResult = await this.extractContent(file);
      
      if (!contentResult.success || !contentResult.content) {
        this.metrics.contentExtractionFailures++;
        throw new Error(contentResult.error || 'Failed to extract content');
      }
      this.metrics.contentExtractionSuccesses++;

      // Select appropriate prompt
      const promptName = options.customPrompt || this.selectPrompt(file.mime_type, file.name);
      if (!promptName) {
        throw new Error(`No classification prompt found for mime type: ${file.mime_type}`);
      }

      // Classify the content
      this.metrics.promptsUsed++;
      const classification = await this.classifyContent(
        contentResult.content,
        file.name,
        promptName,
        contentResult.metadata
      );

      if (!classification) {
        throw new Error('Classification failed');
      }

      // Save classification results if not dry run
      if (!options.dryRun) {
        this.metrics.databaseUpdates++;
        await this.saveClassification(file, classification);
      } else if (options.verbose) {
        this.logger?.info(`[DRY RUN] Would save classification for ${file.name}`);
      }

      this.metrics.filesProcessed++;

      return {
        sourceId: file.id,
        fileName: file.name,
        mimeType: file.mime_type,
        documentTypeId: classification.document_type_id,
        documentTypeName: classification.name,
        confidence: classification.classification_confidence,
        reasoning: classification.classification_reasoning,
        summary: classification.document_summary,
        keyInsights: classification.unique_insights,
        concepts: this.extractConcepts(classification),
        success: true,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Error processing file ${file.name}`, { error: errorMessage });
      this.metrics.errors++;
      
      return {
        sourceId: file.id,
        fileName: file.name,
        mimeType: file.mime_type,
        documentTypeId: '',
        documentTypeName: '',
        confidence: 0,
        reasoning: '',
        error: errorMessage,
        success: false,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get files to process based on options
   */
  private async getFilesToProcess(options: ClassificationOptions): Promise<SourceFile[]> {
    // Build query
    let query = this.supabase
      .from('google_sources')
      .select(`
        id,
        drive_id,
        name,
        mime_type,
        size,
        path,
        web_view_link,
        document_type_id,
        is_deleted,
        pipeline_status,
        google_sources_experts!inner(
          expert_id
        ),
        google_expert_documents(
          id
        )
      `)
      .eq('is_deleted', false);

    // Apply mime type filters
    if (options.types && options.types.length > 0) {
      const mimeTypes = this.getMimeTypesForFileTypes(options.types);
      query = query.in('mime_type', mimeTypes);
    }

    // Apply status filter
    if (options.status) {
      query = query.eq('pipeline_status', options.status);
    }

    // Apply expert name filter
    if (options.expertName) {
      // First get expert ID
      const { data: expertData } = await this.supabase
        .from('expert_profiles')
        .select('id')
        .eq('expert_name', options.expertName)
        .single();

      if (expertData) {
        query = query.eq('google_sources_experts.expert_id', expertData.id);
      }
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Apply filter profile if specified
    if (options.filterProfile) {
      query = await this.config.filterService.applyFilterToQuery(query);
    }

    const { data, error } = await query;

    if (error) {
      this.logger?.error('Error fetching files', { error: error.message });
      throw error;
    }

    // Transform results
    return (data || []).map(item => ({
      id: item.id,
      drive_id: item.drive_id || '',
      name: item.name || '',
      mime_type: item.mime_type || '',
      size: item.size,
      path: item.path,
      web_view_link: item.web_view_link,
      document_type_id: item.document_type_id,
      is_deleted: item.is_deleted || false,
      pipeline_status: item.pipeline_status,
      expert_id: item.google_sources_experts?.[0]?.expert_id,
      expert_document_id: item.google_expert_documents?.[0]?.id
    }));
  }

  /**
   * Extract content from a file
   */
  private async extractContent(file: SourceFile): Promise<ContentExtractionResult> {
    try {
      // Check if we have an expert document with content
      if (file.expert_document_id) {
        const content = await this.getExpertDocumentContent(file.expert_document_id);
        if (content) {
          this.metrics.cacheHits++;
          return { content, success: true };
        }
      }
      this.metrics.cacheMisses++;

      // Extract based on mime type
      const mimeType = file.mime_type.toLowerCase();

      // Handle PDFs
      if (mimeType === 'application/pdf') {
        return await this.extractPdfContent(file);
      }

      // Handle text-based documents
      if (this.isTextBasedDocument(mimeType)) {
        return await this.extractTextContent(file);
      }

      // Handle presentations
      if (this.isPresentationDocument(mimeType)) {
        return await this.extractPresentationContent(file);
      }

      // Handle media files
      if (this.isMediaFile(mimeType)) {
        return await this.extractMediaMetadata(file);
      }

      // Handle Google Docs
      if (this.isGoogleDocument(mimeType)) {
        return await this.extractGoogleDocContent(file);
      }

      return {
        content: '',
        error: `Unsupported file type: ${mimeType}`,
        success: false
      };

    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  /**
   * Select appropriate prompt based on mime type and filename
   */
  private selectPrompt(mimeType: string, fileName: string): string | null {
    // Check for direct mime type mapping
    const prompt = this.mimeTypeToPromptMap[mimeType];
    if (prompt) {
      return prompt;
    }

    // Try to determine from file extension
    const extension = path.extname(fileName).toLowerCase().substring(1);
    const mimeFromExtension = this.extensionToMimeMap[extension];
    if (mimeFromExtension && this.mimeTypeToPromptMap[mimeFromExtension]) {
      return this.mimeTypeToPromptMap[mimeFromExtension];
    }

    // Check for special cases based on filename patterns
    if (fileName.toLowerCase().includes('transcript')) {
      return 'transcript-classification-prompt';
    }

    // Default fallback
    return 'document-classification-prompt-new';
  }

  /**
   * Classify content using the appropriate prompt
   */
  private async classifyContent(
    content: string,
    fileName: string,
    promptName: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    try {
      // Load the prompt
      const promptResult = await this.config.promptService.loadPrompt(promptName);
      if (!promptResult.success) {
        throw new Error(`Failed to load prompt: ${promptName}`);
      }

      // Create user message
      let userMessage = `Please classify the following document`;
      if (fileName) {
        userMessage += ` titled "${fileName}"`;
      }
      if (metadata) {
        userMessage += `\n\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
      }
      userMessage += `:\n\n${content}`;

      // Use prompt with Claude
      this.metrics.claudeApiCalls++;
      const response = await this.config.promptService.usePromptWithClaude(
        promptName,
        userMessage,
        { responseFormat: { type: "json" } }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get classification response');
      }

      // Parse JSON response
      return JSON.parse(response.data);

    } catch (error) {
      this.logger?.error('Error in classifyContent', { 
        error: error instanceof Error ? error.message : String(error),
        fileName,
        promptName
      });
      throw error;
    }
  }

  /**
   * Save classification results
   */
  private async saveClassification(file: SourceFile, classification: any): Promise<void> {
    const now = new Date().toISOString();

    // Update google_sources
    const { error: sourceError } = await this.supabase
      .from('google_sources')
      .update({
        document_type_id: classification.document_type_id,
        updated_at: now
      })
      .eq('id', file.id);

    if (sourceError) {
      throw new Error(`Failed to update source: ${sourceError.message}`);
    }

    // Update or create expert document
    if (file.expert_document_id) {
      const { error: expertError } = await this.supabase
        .from('google_expert_documents')
        .update({
          document_type_id: classification.document_type_id,
          classification_confidence: classification.classification_confidence,
          classification_reasoning: classification.classification_reasoning,
          classification_metadata: classification,
          document_processing_status: 'processed',
          updated_at: now
        })
        .eq('id', file.expert_document_id);

      if (expertError) {
        throw new Error(`Failed to update expert document: ${expertError.message}`);
      }
    }

    // Save concepts if present
    if (classification.key_topics && Array.isArray(classification.key_topics)) {
      await this.saveConcepts(file.expert_document_id || file.id, classification.key_topics);
    }
  }

  /**
   * Save document concepts
   */
  private async saveConcepts(documentId: string, topics: string[]): Promise<void> {
    // Convert topics to concepts with weights
    const concepts = topics.map((topic, index) => ({
      id: uuidv4(),
      document_id: documentId,
      concept: topic,
      weight: 1.0 - (index * 0.1), // Decreasing weight by position
      created_at: new Date().toISOString()
    }));

    const { error } = await this.supabase
      .from('learn_document_concepts')
      .insert(concepts);

    if (error) {
      this.logger?.warn('Failed to save concepts', { error: error.message });
    } else {
      this.metrics.conceptsSaved += concepts.length;
    }
  }

  // Helper methods

  private getMimeTypesForFileTypes(types: SupportedFileType[]): string[] {
    const mimeTypes: Set<string> = new Set();

    for (const type of types) {
      switch (type) {
        case 'pdf':
          mimeTypes.add('application/pdf');
          break;
        case 'docx':
        case 'doc':
          mimeTypes.add('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          mimeTypes.add('application/msword');
          break;
        case 'txt':
          mimeTypes.add('text/plain');
          break;
        case 'md':
          mimeTypes.add('text/markdown');
          break;
        case 'pptx':
        case 'ppt':
          mimeTypes.add('application/vnd.openxmlformats-officedocument.presentationml.presentation');
          mimeTypes.add('application/vnd.ms-powerpoint');
          break;
        case 'xlsx':
        case 'xls':
          mimeTypes.add('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          mimeTypes.add('application/vnd.ms-excel');
          break;
        case 'audio':
          mimeTypes.add('audio/x-m4a');
          mimeTypes.add('audio/mpeg');
          mimeTypes.add('audio/mp3');
          break;
        case 'video':
          mimeTypes.add('video/mp4');
          mimeTypes.add('video/quicktime');
          break;
        case 'image':
          mimeTypes.add('image/jpeg');
          mimeTypes.add('image/png');
          mimeTypes.add('image/gif');
          break;
        case 'google-doc':
          mimeTypes.add('application/vnd.google-apps.document');
          break;
        case 'google-slides':
          mimeTypes.add('application/vnd.google-apps.presentation');
          break;
        case 'google-sheets':
          mimeTypes.add('application/vnd.google-apps.spreadsheet');
          break;
      }
    }

    return Array.from(mimeTypes);
  }

  private isTextBasedDocument(mimeType: string): boolean {
    return mimeType.includes('wordprocessingml') || 
           mimeType === 'application/msword' ||
           mimeType === 'text/plain' ||
           mimeType === 'text/markdown';
  }

  private isPresentationDocument(mimeType: string): boolean {
    return mimeType.includes('presentationml') ||
           mimeType === 'application/vnd.ms-powerpoint' ||
           mimeType === 'application/vnd.google-apps.presentation';
  }

  private isMediaFile(mimeType: string): boolean {
    return mimeType.startsWith('audio/') || mimeType.startsWith('video/');
  }

  private isGoogleDocument(mimeType: string): boolean {
    return mimeType.startsWith('application/vnd.google-apps.');
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private createBatchResult(
    results: ClassificationResult[],
    errors: Array<{ fileName: string; error: string }>,
    startTime: number
  ): BatchClassificationResult {
    const successfulFiles = results.filter(r => r.success).length;
    const failedFiles = results.filter(r => !r.success).length;
    const skippedFiles = results.filter(r => r.reasoning === 'File was already classified').length;

    return {
      totalFiles: results.length,
      processedFiles: results.length - skippedFiles,
      successfulFiles,
      failedFiles,
      skippedFiles,
      results,
      processingTime: Date.now() - startTime,
      errors
    };
  }

  private extractConcepts(classification: any): Concept[] {
    const concepts: Concept[] = [];

    // Extract from different possible fields
    if (classification.concepts && Array.isArray(classification.concepts)) {
      return classification.concepts;
    }

    if (classification.key_topics && Array.isArray(classification.key_topics)) {
      return classification.key_topics.map((topic: string, index: number) => ({
        name: topic,
        weight: 1.0 - (index * 0.1)
      }));
    }

    if (classification.keyConcepts && Array.isArray(classification.keyConcepts)) {
      return classification.keyConcepts.map((concept: string, index: number) => ({
        name: concept,
        weight: 1.0 - (index * 0.1)
      }));
    }

    return concepts;
  }

  // Content extraction methods

  private async getExpertDocumentContent(id: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('google_expert_documents')
      .select('raw_content, processed_content')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    // Try processed content first, then raw content
    if (data.processed_content) {
      if (typeof data.processed_content === 'string') {
        return data.processed_content;
      }
      if (data.processed_content.content) {
        return data.processed_content.content;
      }
      if (data.processed_content.text) {
        return data.processed_content.text;
      }
    }

    if (data.raw_content) {
      if (typeof data.raw_content === 'string') {
        return data.raw_content;
      }
      if (data.raw_content.content) {
        return data.raw_content.content;
      }
    }

    return null;
  }

  private async extractPdfContent(file: SourceFile): Promise<ContentExtractionResult> {
    try {
      // Download PDF from Google Drive
      const tempFilePath = await this.config.googleDriveService.downloadFile(
        file.drive_id,
        `/tmp/${uuidv4()}.pdf`
      );

      // Process with PDF processor service
      const result = await this.config.pdfProcessorService.processPdf(tempFilePath);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      if (result.success && result.content) {
        return {
          content: result.content,
          metadata: result.metadata,
          success: true
        };
      }

      return {
        content: '',
        error: result.error || 'Failed to extract PDF content',
        success: false
      };

    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async extractTextContent(file: SourceFile): Promise<ContentExtractionResult> {
    try {
      // For now, download and read the file
      // In the future, this should use Google Drive API to read content directly
      const tempFilePath = await this.config.googleDriveService.downloadFile(
        file.drive_id,
        `/tmp/${uuidv4()}.txt`
      );

      const content = fs.readFileSync(tempFilePath, 'utf-8');
      fs.unlinkSync(tempFilePath);

      return {
        content,
        success: true
      };

    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async extractPresentationContent(file: SourceFile): Promise<ContentExtractionResult> {
    // TODO: Implement presentation content extraction
    // This would use a PowerPoint processing service similar to PDF processor
    return {
      content: '',
      error: 'Presentation extraction not yet implemented',
      success: false
    };
  }

  private async extractMediaMetadata(file: SourceFile): Promise<ContentExtractionResult> {
    // For media files, we extract metadata instead of content
    return {
      content: JSON.stringify({
        fileName: file.name,
        mimeType: file.mime_type,
        size: file.size,
        path: file.path
      }),
      metadata: {
        type: 'media',
        requiresTranscription: true
      },
      success: true
    };
  }

  private async extractGoogleDocContent(file: SourceFile): Promise<ContentExtractionResult> {
    try {
      // Export Google Doc as plain text
      const content = await this.config.googleDriveService.exportFile(
        file.drive_id,
        'text/plain'
      );

      return {
        content,
        success: true
      };

    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }
}