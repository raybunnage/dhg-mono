/**
 * Document Service
 * 
 * A service for managing documentation files in the Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import { DocumentTypeService } from './document-type-service';

export class DocumentService {
  private supabase;
  private documentTypeService: DocumentTypeService;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.documentTypeService = new DocumentTypeService(supabaseUrl, supabaseKey);
  }

  /**
   * Get recent documents
   */
  async getRecentDocuments(limit = 20) {
    try {
      // Fetch documents without relying on foreign key relationship
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at
        `)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching recent documents:', error);
        return [];
      }
      
      // Enhance documents with document type information
      const enhancedDocuments = await this.enhanceDocumentsWithTypes(data);
      
      return enhancedDocuments;
    } catch (error) {
      console.error('Error in getRecentDocuments:', error);
      return [];
    }
  }

  /**
   * Get untyped documents
   */
  async getUntypedDocuments(limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at
        `)
        .is('document_type_id', null)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching untyped documents:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('Error in getUntypedDocuments:', error);
      return [];
    }
  }

  /**
   * Update document type
   */
  async updateDocumentType(documentId: string, documentTypeId: string, metadata: any = {}) {
    try {
      const { error } = await this.supabase
        .from('documentation_files')
        .update({
          document_type_id: documentTypeId,
          metadata: metadata,
          updated_at: new Date()
        })
        .eq('id', documentId);
      
      if (error) {
        console.error(`Error updating document type for ${documentId}:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`Error in updateDocumentType for ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Enhance documents with document type information
   */
  private async enhanceDocumentsWithTypes(documents: any[]) {
    if (!documents || documents.length === 0) {
      return [];
    }
    
    // Get all unique document type IDs
    const typeIds = [...new Set(
      documents
        .filter(doc => doc.document_type_id)
        .map(doc => doc.document_type_id)
    )];
    
    // Fetch all document types at once
    const documentTypes: Record<string, any> = {};
    
    for (const typeId of typeIds) {
      const docType = await this.documentTypeService.getDocumentTypeById(typeId);
      if (docType) {
        documentTypes[typeId] = docType;
      }
    }
    
    // Enhance documents with their types
    return documents.map(doc => {
      return {
        ...doc,
        document_type: doc.document_type_id ? documentTypes[doc.document_type_id] : null
      };
    });
  }
}

// Export a factory function for easier instantiation
export function createDocumentService(supabaseUrl: string, supabaseKey: string) {
  return new DocumentService(supabaseUrl, supabaseKey);
}