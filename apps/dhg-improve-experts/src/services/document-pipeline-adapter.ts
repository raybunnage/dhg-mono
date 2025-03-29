/**
 * Adapter for document pipeline service
 * 
 * This adapter will eventually use the shared document-pipeline-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { ExpertDocument } from '@/types/expert';
import { Logger } from '@/utils/logger';
import { expertService } from './expert-service';
import { documentProcessingService } from './document-processing-service';

export class DocumentPipelineAdapter {
  /**
   * Process a document to extract structured information
   */
  async processDocument(documentId: string): Promise<boolean> {
    try {
      Logger.debug(`Processing document ID: ${documentId}`);
      
      // Get the document from the database
      const document = await expertService.getExpertDocumentById(documentId);
      
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      // Use the document processing service
      return await documentProcessingService.processDocument(document);
    } catch (error) {
      Logger.error(`Error in document pipeline adapter for ${documentId}:`, error);
      return false;
    }
  }
  
  /**
   * Get a list of recent documents
   */
  async getRecentDocuments(limit: number = 20): Promise<ExpertDocument[]> {
    try {
      Logger.debug(`Getting ${limit} recent documents`);
      return await expertService.getExpertDocuments(undefined);
    } catch (error) {
      Logger.error('Error getting recent documents:', error);
      return [];
    }
  }
  
  /**
   * Get untyped documents
   */
  async getUntypedDocuments(limit: number = 10): Promise<ExpertDocument[]> {
    try {
      Logger.debug(`Getting ${limit} untyped documents`);
      // In this mock implementation, we're just returning recent documents
      // In the real implementation, this would filter by document_type
      return await expertService.getExpertDocuments(undefined);
    } catch (error) {
      Logger.error('Error getting untyped documents:', error);
      return [];
    }
  }
  
  /**
   * Queue multiple documents for processing
   */
  async queueDocumentsForProcessing(documentIds: string[]): Promise<number> {
    try {
      Logger.debug(`Queuing ${documentIds.length} documents for processing`);
      
      let successCount = 0;
      
      // Process each document
      for (const id of documentIds) {
        const success = await this.processDocument(id);
        if (success) {
          successCount++;
        }
      }
      
      return successCount;
    } catch (error) {
      Logger.error('Error queuing documents for processing:', error);
      return 0;
    }
  }
  
  /**
   * Process all pending documents
   */
  async processAllPendingDocuments(limit: number = 10): Promise<number> {
    return await documentProcessingService.queueUnprocessedDocuments(limit);
  }
}

// Export singleton instance
export const documentPipelineAdapter = new DocumentPipelineAdapter();