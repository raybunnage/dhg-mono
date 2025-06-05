/**
 * Adapter for documentation service
 * 
 * This adapter will eventually use the shared documentation-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import DocumentationService, { 
  DocumentMetadata, 
  DocumentSection, 
  DocumentFile,
  DocumentRelation
} from './documentationService';

// Use a default base path for documentation
const DEFAULT_DOCS_PATH = './docs';
// Create a singleton instance of the base service
const documentationService = new DocumentationService(DEFAULT_DOCS_PATH);

export class DocumentationAdapter {
  /**
   * Process a markdown file and register it in the database
   */
  async processMarkdownFile(filePath: string): Promise<string> {
    try {
      return await documentationService.processMarkdownFile(filePath);
    } catch (error) {
      console.error('Error in processMarkdownFile adapter:', error);
      throw error;
    }
  }

  /**
   * Scan a directory for markdown files and process them
   */
  async scanDirectory(dirPath: string = ''): Promise<string[]> {
    try {
      return await documentationService.scanDirectory(dirPath);
    } catch (error) {
      console.error('Error in scanDirectory adapter:', error);
      throw error;
    }
  }

  /**
   * Process the next file in the AI processing queue
   */
  async processNextFileWithAI(): Promise<boolean> {
    try {
      return await documentationService.processNextFileWithAI();
    } catch (error) {
      console.error('Error in processNextFileWithAI adapter:', error);
      return false;
    }
  }

  /**
   * Search documentation
   */
  async searchDocumentation(query: string, limit: number = 20): Promise<any[]> {
    try {
      return await documentationService.searchDocumentation(query, limit);
    } catch (error) {
      console.error('Error in searchDocumentation adapter:', error);
      return [];
    }
  }

  /**
   * Find related documents
   */
  async findRelatedDocuments(documentId: string, limit: number = 10): Promise<any[]> {
    try {
      return await documentationService.findRelatedDocuments(documentId, limit);
    } catch (error) {
      console.error('Error in findRelatedDocuments adapter:', error);
      return [];
    }
  }

  /**
   * Search documents by tag
   */
  async searchDocumentsByTag(tag: string, limit: number = 20): Promise<any[]> {
    try {
      return await documentationService.searchDocumentsByTag(tag, limit);
    } catch (error) {
      console.error('Error in searchDocumentsByTag adapter:', error);
      return [];
    }
  }

  /**
   * Get document details
   */
  async getDocumentDetails(documentId: string): Promise<DocumentFile | null> {
    try {
      return await documentationService.getDocumentDetails(documentId);
    } catch (error) {
      console.error('Error in getDocumentDetails adapter:', error);
      return null;
    }
  }
}

// Export singleton instance
export const documentationAdapter = new DocumentationAdapter();