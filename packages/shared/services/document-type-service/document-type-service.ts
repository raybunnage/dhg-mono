/**
 * Document Type Service
 * 
 * Provides CRUD operations and management functionality for document types.
 * Extracted from ClassifyDocument.tsx UI component.
 */
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../supabase-client';
import { Logger } from '../../utils/logger';

/**
 * Document Type interface matching the database schema
 */
export interface DocumentType {
  id: string;
  document_type: string;
  category: string;
  description?: string | null;
  file_extension?: string | null;
  is_ai_generated?: boolean;
  classifier?: 'pdf' | 'powerpoint' | 'docx' | 'expert' | null;
  required_fields?: Record<string, any> | null;
  validation_rules?: Record<string, any> | null;
  ai_processing_rules?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for document type creation
 */
export interface CreateDocumentTypeParams {
  document_type: string;
  category: string;
  description?: string | null;
  file_extension?: string | null;
  is_ai_generated?: boolean;
  classifier?: 'pdf' | 'powerpoint' | 'docx' | 'expert' | null;
  required_fields?: Record<string, any> | null;
  validation_rules?: Record<string, any> | null;
  ai_processing_rules?: Record<string, any> | null;
}

/**
 * Document Type Service Implementation
 */
export class DocumentTypeService {
  private static instance: DocumentTypeService;
  private supabaseService: SupabaseClientService;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
    Logger.debug('DocumentTypeService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentTypeService {
    if (!DocumentTypeService.instance) {
      DocumentTypeService.instance = new DocumentTypeService();
    }
    return DocumentTypeService.instance;
  }

  /**
   * Get all document types
   * @returns Array of document types
   */
  public async getAllDocumentTypes(): Promise<DocumentType[]> {
    try {
      Logger.debug('Fetching all document types');
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('document_type', { ascending: true });
      
      if (error) {
        Logger.error(`Error fetching document types: ${error.message}`);
        throw error;
      }
      
      Logger.debug(`Retrieved ${data?.length || 0} document types`);
      return data || [];
    } catch (error) {
      Logger.error(`Exception in getAllDocumentTypes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get document type by ID
   * @param id Document type ID
   * @returns Document type or null if not found
   */
  public async getDocumentTypeById(id: string): Promise<DocumentType | null> {
    try {
      Logger.debug(`Fetching document type with ID: ${id}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Not found error
          Logger.debug(`Document type with ID ${id} not found`);
          return null;
        }
        Logger.error(`Error fetching document type: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      Logger.error(`Exception in getDocumentTypeById: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get document types by category
   * @param category Category name
   * @returns Array of document types in the category
   */
  public async getDocumentTypesByCategory(category: string): Promise<DocumentType[]> {
    try {
      Logger.debug(`Fetching document types in category: ${category}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('category', category)
        .order('document_type', { ascending: true });
      
      if (error) {
        Logger.error(`Error fetching document types by category: ${error.message}`);
        throw error;
      }
      
      Logger.debug(`Retrieved ${data?.length || 0} document types in category ${category}`);
      return data || [];
    } catch (error) {
      Logger.error(`Exception in getDocumentTypesByCategory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create a new document type
   * @param params Document type creation parameters
   * @returns The newly created document type
   */
  public async createDocumentType(params: CreateDocumentTypeParams): Promise<DocumentType> {
    try {
      Logger.debug(`Creating new document type: ${params.document_type}`);
      const supabase = this.supabaseService.getClient();
      
      // Check if document type already exists
      const { data: existingTypes, error: checkError } = await supabase
        .from('document_types')
        .select('id, document_type')
        .eq('document_type', params.document_type);
      
      if (checkError) {
        Logger.error(`Error checking for existing document type: ${checkError.message}`);
        throw checkError;
      }
      
      if (existingTypes && existingTypes.length > 0) {
        const error = new Error(`Document type "${params.document_type}" already exists`);
        Logger.error(error.message);
        throw error;
      }
      
      // Generate a new UUID
      const newId = uuidv4();
      const now = new Date().toISOString();
      
      // Create the full document type object
      const documentType: DocumentType = {
        id: newId,
        document_type: params.document_type,
        category: params.category,
        description: params.description || null,
        file_extension: params.file_extension || null,
        is_ai_generated: params.is_ai_generated || false,
        classifier: params.classifier || null,
        required_fields: params.required_fields || null,
        validation_rules: params.validation_rules || null,
        ai_processing_rules: params.ai_processing_rules || null,
        created_at: now,
        updated_at: now
      };
      
      // Insert into database
      const { error: insertError } = await supabase
        .from('document_types')
        .insert(documentType);
      
      if (insertError) {
        Logger.error(`Error creating document type: ${insertError.message}`);
        throw insertError;
      }
      
      Logger.debug(`Created document type ${params.document_type} with ID ${newId}`);
      return documentType;
    } catch (error) {
      Logger.error(`Exception in createDocumentType: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update an existing document type
   * @param id Document type ID
   * @param params Updated document type parameters
   * @returns The updated document type
   */
  public async updateDocumentType(id: string, params: Partial<CreateDocumentTypeParams>): Promise<DocumentType> {
    try {
      Logger.debug(`Updating document type with ID: ${id}`);
      const supabase = this.supabaseService.getClient();
      
      // Check if document type exists
      const { data: existingType, error: checkError } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single();
      
      if (checkError) {
        Logger.error(`Error checking for existing document type: ${checkError.message}`);
        throw checkError;
      }
      
      if (!existingType) {
        const error = new Error(`Document type with ID ${id} not found`);
        Logger.error(error.message);
        throw error;
      }
      
      // If document_type is changing, check that the new name doesn't conflict
      if (params.document_type && params.document_type !== existingType.document_type) {
        const { data: nameCheck, error: nameCheckError } = await supabase
          .from('document_types')
          .select('id')
          .eq('document_type', params.document_type);
        
        if (nameCheckError) {
          Logger.error(`Error checking for name conflicts: ${nameCheckError.message}`);
          throw nameCheckError;
        }
        
        if (nameCheck && nameCheck.length > 0) {
          const error = new Error(`Document type "${params.document_type}" already exists`);
          Logger.error(error.message);
          throw error;
        }
      }
      
      // Prepare update data
      const updateData = {
        ...params,
        updated_at: new Date().toISOString()
      };
      
      // Update in database
      const { error: updateError } = await supabase
        .from('document_types')
        .update(updateData)
        .eq('id', id);
      
      if (updateError) {
        Logger.error(`Error updating document type: ${updateError.message}`);
        throw updateError;
      }
      
      // Retrieve the updated document type
      const { data: updatedType, error: retrieveError } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single();
      
      if (retrieveError) {
        Logger.error(`Error retrieving updated document type: ${retrieveError.message}`);
        throw retrieveError;
      }
      
      Logger.debug(`Updated document type with ID ${id}`);
      return updatedType;
    } catch (error) {
      Logger.error(`Exception in updateDocumentType: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Delete a document type
   * @param id Document type ID
   * @returns True if deletion was successful
   */
  public async deleteDocumentType(id: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting document type with ID: ${id}`);
      const supabase = this.supabaseService.getClient();
      
      // Check for references to this document type in other tables
      const { count: referencesCount, error: referencesError } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact', head: true })
        .eq('document_type_id', id);
      
      if (referencesError) {
        Logger.error(`Error checking references in sources_google: ${referencesError.message}`);
        throw referencesError;
      }
      
      if (referencesCount && referencesCount > 0) {
        const warning = `Document type is referenced by ${referencesCount} records in sources_google`;
        Logger.warn(warning);
        // We'll continue with deletion, but logged the warning
      }
      
      // Check for references in expert_documents
      const { count: expertDocsCount, error: expertDocsError } = await supabase
        .from('expert_documents')
        .select('id', { count: 'exact', head: true })
        .eq('document_type_id', id);
      
      if (expertDocsError) {
        Logger.error(`Error checking references in expert_documents: ${expertDocsError.message}`);
        throw expertDocsError;
      }
      
      if (expertDocsCount && expertDocsCount > 0) {
        const warning = `Document type is referenced by ${expertDocsCount} records in expert_documents`;
        Logger.warn(warning);
        // We'll continue with deletion, but logged the warning
      }
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('document_types')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        Logger.error(`Error deleting document type: ${deleteError.message}`);
        throw deleteError;
      }
      
      Logger.debug(`Deleted document type with ID ${id}`);
      return true;
    } catch (error) {
      Logger.error(`Exception in deleteDocumentType: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get unique categories from document types
   * @returns Array of unique category names
   */
  public async getUniqueCategories(): Promise<string[]> {
    try {
      Logger.debug('Fetching unique document type categories');
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('document_types')
        .select('category')
        .not('category', 'is', null);
      
      if (error) {
        Logger.error(`Error fetching categories: ${error.message}`);
        throw error;
      }
      
      // Extract unique values
      const uniqueCategories = Array.from(
        new Set(data?.map(item => item.category) || [])
      ).filter(Boolean).sort();
      
      Logger.debug(`Retrieved ${uniqueCategories.length} unique categories`);
      return uniqueCategories;
    } catch (error) {
      Logger.error(`Exception in getUniqueCategories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return ["Research", "Communication", "Documentation", "Legal"]; // Default categories as fallback
    }
  }

  // Method getUniqueMimeTypes removed as mime_type field is no longer in document_types table
  
  /**
   * Get statistics about document types and their usage
   * @returns Object containing document type usage statistics
   */
  public async getDocumentTypeStats(): Promise<{
    totalDocumentTypes: number;
    documentTypesInUse: number;
    categoryCounts: Record<string, number>;
    topUsedTypes: Array<{id: string, document_type: string, count: number}>;
  }> {
    try {
      Logger.debug('Gathering document type statistics');
      const supabase = this.supabaseService.getClient();
      
      // Get all document types
      const { data: documentTypes, error: typesError } = await supabase
        .from('document_types')
        .select('id, document_type, category');
      
      if (typesError) {
        Logger.error(`Error fetching document types: ${typesError.message}`);
        throw typesError;
      }
      
      // Count references in sources_google
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('sources_google')
        .select('document_type_id');
      
      if (sourcesError) {
        Logger.error(`Error fetching sources references: ${sourcesError.message}`);
        throw sourcesError;
      }
      
      // Count by document type and category
      const typeCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      
      // Initialize all document types with zero count
      documentTypes?.forEach(type => {
        typeCounts[type.id] = 0;
        if (type.category) {
          categoryCounts[type.category] = categoryCounts[type.category] || 0;
        }
      });
      
      // Count references
      sourcesData?.forEach(source => {
        if (source.document_type_id) {
          typeCounts[source.document_type_id] = (typeCounts[source.document_type_id] || 0) + 1;
        }
      });
      
      // Count document types in use and by category
      let documentTypesInUse = 0;
      documentTypes?.forEach(type => {
        if (typeCounts[type.id] > 0) {
          documentTypesInUse++;
        }
        if (type.category) {
          categoryCounts[type.category]++;
        }
      });
      
      // Get top used types
      const typeUsage = documentTypes?.map(type => ({
        id: type.id,
        document_type: type.document_type,
        count: typeCounts[type.id] || 0
      })) || [];
      
      const topUsedTypes = typeUsage
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      const stats = {
        totalDocumentTypes: documentTypes?.length || 0,
        documentTypesInUse,
        categoryCounts,
        topUsedTypes
      };
      
      Logger.debug(`Document type statistics gathered: ${stats.totalDocumentTypes} total types, ${documentTypesInUse} in use`);
      return stats;
    } catch (error) {
      Logger.error(`Exception in getDocumentTypeStats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return minimal stats as fallback
      return {
        totalDocumentTypes: 0,
        documentTypesInUse: 0,
        categoryCounts: {},
        topUsedTypes: []
      };
    }
  }
}

// Export singleton instance
export const documentTypeService = DocumentTypeService.getInstance();