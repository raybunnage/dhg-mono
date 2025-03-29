/**
 * Content service for retrieving and managing document content
 * 
 * This service abstracts the retrieval of content from different sources
 * and prepares it for processing by other services.
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

export interface DocumentInfo {
  id: string;
  sourceName?: string;
  mimeType?: string;
  index?: number;
  total?: number;
}

export interface ContentResult {
  content: string | null;
  documentInfo: DocumentInfo;
  needsExtraction: boolean;
  error?: string;
}

export class ContentService {
  /**
   * Get a list of document IDs
   */
  async getDocumentIds(): Promise<string[]> {
    try {
      Logger.debug('Getting document IDs');
      
      const { data, error } = await supabase
        .from('expert_documents')
        .select('id')
        .order('id');
      
      if (error) {
        throw new Error(`Failed to fetch document list: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        Logger.warn('No documents found');
        return [];
      }
      
      Logger.info(`Found ${data.length} documents`);
      return data.map(doc => doc.id);
    } catch (error) {
      Logger.error('Error getting document IDs:', error);
      return [];
    }
  }
  
  /**
   * Get content for a specific document
   */
  async getDocumentContent(docId: string): Promise<ContentResult> {
    try {
      Logger.debug(`Getting content for document ID: ${docId}`);
      
      // Get the document and its source with detailed information
      const { data: doc, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          content_type,
          processing_status,
          source_id,
          error_message,
          processing_error,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name,
            mime_type,
            drive_id,
            content_extracted,
            extraction_error,
            extracted_content,
            metadata
          )
        `)
        .eq('id', docId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch document ${docId}: ${error.message}`);
      }
      
      // Debug log the document structure
      Logger.debug('Document structure:', {
        id: doc.id,
        hasRawContent: !!doc.raw_content,
        source: doc.source ? {
          id: doc.source.id,
          name: doc.source.name,
          contentExtracted: doc.source.content_extracted
        } : 'No source record'
      });
      
      // Create the document info object
      const documentInfo: DocumentInfo = {
        id: doc.id,
        sourceName: doc.source?.name,
        mimeType: doc.source?.mime_type
      };
      
      // Check if the document needs content extraction
      if (!doc.raw_content && doc?.source?.drive_id && !doc.source.content_extracted) {
        Logger.info('Document needs content extraction', {
          name: doc.source.name,
          driveId: doc.source.drive_id
        });
        
        return {
          content: null,
          documentInfo,
          needsExtraction: true
        };
      }
      
      // Handle content from the document or source
      let contentToUse = null;
      
      if (doc?.raw_content) {
        contentToUse = typeof doc.raw_content === 'object' 
          ? JSON.stringify(doc.raw_content)
          : doc.raw_content;
      } else if (doc?.source?.extracted_content) {
        contentToUse = typeof doc.source.extracted_content === 'object'
          ? JSON.stringify(doc.source.extracted_content)
          : doc.source.extracted_content;
      }
      
      if (!contentToUse) {
        Logger.warn(`Document ${docId} has no usable content`, {
          rawContentExists: !!doc?.raw_content,
          sourceContentExists: !!doc?.source?.extracted_content
        });
        
        return {
          content: null,
          documentInfo,
          needsExtraction: false,
          error: 'Document has no usable content'
        };
      }
      
      // Return the content
      return {
        content: contentToUse,
        documentInfo,
        needsExtraction: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error getting content for document ${docId}:`, error);
      
      return {
        content: null,
        documentInfo: { id: docId },
        needsExtraction: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Process content for a batch of documents
   * @param callback Function to call for each document with content
   */
  async batchProcessDocuments(
    callback: (content: string, info: DocumentInfo) => Promise<void>,
    limit: number = 20
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    try {
      const docIds = await this.getDocumentIds();
      
      // Limit the number of documents to process
      const documentsToProcess = docIds.slice(0, limit);
      
      let processed = 0;
      let skipped = 0;
      let errors = 0;
      
      for (let i = 0; i < documentsToProcess.length; i++) {
        const docId = documentsToProcess[i];
        
        // Add index and total to track progress
        const result = await this.getDocumentContent(docId);
        result.documentInfo.index = i + 1;
        result.documentInfo.total = documentsToProcess.length;
        
        if (result.needsExtraction) {
          Logger.info(`Skipping document ${docId} - needs extraction first`);
          skipped++;
          continue;
        }
        
        if (result.error || !result.content) {
          Logger.warn(`Skipping document ${docId} due to error: ${result.error}`);
          errors++;
          continue;
        }
        
        // Process the document
        try {
          await callback(result.content, result.documentInfo);
          processed++;
        } catch (error) {
          Logger.error(`Error in callback for document ${docId}:`, error);
          errors++;
        }
      }
      
      return { processed, skipped, errors };
    } catch (error) {
      Logger.error('Error in batch processing documents:', error);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }
}

// Export singleton instance
export const contentService = new ContentService();