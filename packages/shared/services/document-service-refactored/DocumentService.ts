/**
 * Document Service - Refactored
 * 
 * A service for managing documentation files in the Supabase database
 * Refactored to extend BusinessService with dependency injection pattern
 * 
 * @module DocumentService
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { Logger } from '../logger/logger-interface';

// Types
interface DocumentFile {
  id: string;
  file_path: string;
  title: string;
  language?: string;
  document_type_id?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: any;
  document_type?: DocumentType | null;
}

interface DocumentType {
  id: string;
  name: string;
  description?: string;
}

interface DocumentServiceConfig {
  defaultLimit?: number;
}

interface DocumentServiceMetrics {
  totalQueries: number;
  totalUpdates: number;
  errorCount: number;
  lastQueryTime?: Date;
  lastUpdateTime?: Date;
}

export class DocumentService extends BusinessService {
  private config: DocumentServiceConfig;
  private metrics: DocumentServiceMetrics = {
    totalQueries: 0,
    totalUpdates: 0,
    errorCount: 0
  };

  constructor(
    private supabase: SupabaseClient,
    private documentTypeService?: any, // Will be injected for decoupling
    logger?: Logger,
    config: DocumentServiceConfig = {}
  ) {
    super('DocumentService', logger);
    this.config = {
      defaultLimit: 20,
      ...config
    };
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    this.logger?.info('DocumentService initializing...');
    
    // Verify database connection
    try {
      const { error } = await this.supabase
        .from('documentation_files')
        .select('id')
        .limit(1);
      
      if (error) {
        throw new Error(`Database connection test failed: ${error.message}`);
      }
      
      this.logger?.info('DocumentService initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize DocumentService:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('DocumentService cleaning up...');
    // No specific cleanup needed for this service
    this.logger?.info('DocumentService cleanup completed');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    const startTime = Date.now();
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      database: 'unknown'
    };

    try {
      // Test database connection
      const { error } = await this.supabase
        .from('documentation_files')
        .select('count')
        .limit(1);

      if (error) {
        healthy = false;
        details.database = `error: ${error.message}`;
      } else {
        details.database = 'connected';
      }

      details.responseTime = `${Date.now() - startTime}ms`;
    } catch (error) {
      healthy = false;
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return {
      healthy,
      details,
      timestamp: new Date()
    };
  }

  // Public API methods

  /**
   * Get recent documents
   */
  async getRecentDocuments(limit?: number): Promise<DocumentFile[]> {
    const queryLimit = limit || this.config.defaultLimit || 20;
    
    try {
      this.metrics.totalQueries++;
      this.metrics.lastQueryTime = new Date();
      
      this.logger?.debug(`Fetching ${queryLimit} recent documents`);
      
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at,
          metadata
        `)
        .order('updated_at', { ascending: false })
        .limit(queryLimit);
      
      if (error) {
        this.metrics.errorCount++;
        this.logger?.error('Error fetching recent documents:', error);
        throw new Error(`Failed to fetch recent documents: ${error.message}`);
      }
      
      // Enhance documents with document type information if service is available
      if (this.documentTypeService && data) {
        const enhancedDocuments = await this.enhanceDocumentsWithTypes(data);
        this.logger?.debug(`Enhanced ${enhancedDocuments.length} documents with type information`);
        return enhancedDocuments;
      }
      
      return data || [];
    } catch (error) {
      this.metrics.errorCount++;
      this.logger?.error('Error in getRecentDocuments:', error);
      throw error;
    }
  }

  /**
   * Get untyped documents
   */
  async getUntypedDocuments(limit?: number): Promise<DocumentFile[]> {
    const queryLimit = limit || this.config.defaultLimit || 20;
    
    try {
      this.metrics.totalQueries++;
      this.metrics.lastQueryTime = new Date();
      
      this.logger?.debug(`Fetching ${queryLimit} untyped documents`);
      
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at,
          metadata
        `)
        .is('document_type_id', null)
        .order('updated_at', { ascending: false })
        .limit(queryLimit);
      
      if (error) {
        this.metrics.errorCount++;
        this.logger?.error('Error fetching untyped documents:', error);
        throw new Error(`Failed to fetch untyped documents: ${error.message}`);
      }
      
      this.logger?.debug(`Found ${data?.length || 0} untyped documents`);
      return data || [];
    } catch (error) {
      this.metrics.errorCount++;
      this.logger?.error('Error in getUntypedDocuments:', error);
      throw error;
    }
  }

  /**
   * Update document type
   */
  async updateDocumentType(
    documentId: string, 
    documentTypeId: string, 
    metadata: any = {}
  ): Promise<boolean> {
    try {
      this.metrics.totalUpdates++;
      this.metrics.lastUpdateTime = new Date();
      
      this.logger?.debug(`Updating document ${documentId} with type ${documentTypeId}`);
      
      const { error } = await this.supabase
        .from('documentation_files')
        .update({
          document_type_id: documentTypeId,
          metadata: metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
      
      if (error) {
        this.metrics.errorCount++;
        this.logger?.error(`Error updating document type for ${documentId}:`, error);
        throw new Error(`Failed to update document type: ${error.message}`);
      }
      
      this.logger?.info(`Successfully updated document ${documentId} with type ${documentTypeId}`);
      return true;
    } catch (error) {
      this.metrics.errorCount++;
      this.logger?.error(`Error in updateDocumentType for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): DocumentServiceMetrics {
    return { ...this.metrics };
  }

  // Private methods

  /**
   * Enhance documents with document type information
   */
  private async enhanceDocumentsWithTypes(documents: any[]): Promise<DocumentFile[]> {
    if (!documents || documents.length === 0 || !this.documentTypeService) {
      return documents;
    }
    
    try {
      // Get all unique document type IDs
      const typeIds = [...new Set(
        documents
          .filter(doc => doc.document_type_id)
          .map(doc => doc.document_type_id)
      )];
      
      if (typeIds.length === 0) {
        return documents;
      }
      
      // Fetch all document types at once
      const documentTypes: Record<string, DocumentType> = {};
      
      for (const typeId of typeIds) {
        try {
          const docType = await this.documentTypeService.getDocumentTypeById(typeId);
          if (docType) {
            documentTypes[typeId] = docType;
          }
        } catch (error) {
          this.logger?.warn(`Failed to fetch document type ${typeId}:`, error);
        }
      }
      
      // Enhance documents with their types
      return documents.map(doc => ({
        ...doc,
        document_type: doc.document_type_id ? documentTypes[doc.document_type_id] : null
      }));
    } catch (error) {
      this.logger?.error('Error enhancing documents with types:', error);
      // Return documents without enhancement rather than failing
      return documents;
    }
  }
}

export default DocumentService;