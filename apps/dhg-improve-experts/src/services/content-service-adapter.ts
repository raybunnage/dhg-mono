/**
 * Adapter for content service
 * 
 * This adapter will eventually use the shared content-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { Logger } from '@/utils/logger';
import { contentService } from './content-service';
import { DocumentInfo, ContentResult } from './content-service';

export class ContentServiceAdapter {
  /**
   * Get a list of document IDs
   */
  async getDocumentIds(): Promise<string[]> {
    try {
      Logger.debug('Getting document IDs via adapter');
      return await contentService.getDocumentIds();
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
      Logger.debug(`Getting content for document ID: ${docId} via adapter`);
      return await contentService.getDocumentContent(docId);
    } catch (error) {
      Logger.error(`Error getting content for document ${docId}:`, error);
      return {
        content: null,
        documentInfo: { id: docId },
        needsExtraction: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
      Logger.debug(`Batch processing documents via adapter (limit: ${limit})`);
      return await contentService.batchProcessDocuments(callback, limit);
    } catch (error) {
      Logger.error('Error in batch processing documents:', error);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }
}

// Export singleton instance
export const contentServiceAdapter = new ContentServiceAdapter();