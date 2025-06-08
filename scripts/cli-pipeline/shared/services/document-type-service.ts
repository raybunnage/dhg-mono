/**
 * Document Type Service
 * 
 * A service for managing document types in the Supabase database
 * Uses the SupabaseClientService singleton
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { logger } from './logger-service';

export class DocumentTypeService {
  private static instance: DocumentTypeService;
  private supabaseService: SupabaseClientService;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
    logger.debug('DocumentTypeService initialized with SupabaseClientService singleton');
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
   * Get Supabase client
   */
  private getClient(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  /**
   * Get all document types with hierarchical structure
   */
  async getAllDocumentTypes() {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, name, category, description, is_general_type, is_ai_generated, mnemonic, prompt_id')
        .order('is_general_type', { ascending: false })
        .order('name');
      
      if (error) {
        logger.error('Error fetching document types:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      logger.error('Error in getAllDocumentTypes:', error);
      return [];
    }
  }

  /**
   * Find document type by ID
   */
  async getDocumentTypeById(typeId: string) {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, name, category, description, is_general_type, is_ai_generated, mnemonic, prompt_id')
        .eq('id', typeId)
        .single();
      
      if (error) {
        logger.error(`Error fetching document type ${typeId}:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      logger.error(`Error in getDocumentTypeById for ${typeId}:`, error);
      return null;
    }
  }

  /**
   * Find document type by name
   */
  async getDocumentTypeByName(typeName: string) {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, name, category, description, is_general_type, is_ai_generated, mnemonic, prompt_id')
        .ilike('name', typeName)
        .limit(1);
      
      if (error) {
        logger.error(`Error fetching document type by name ${typeName}:`, error);
        return null;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      return data[0];
    } catch (error) {
      logger.error(`Error in getDocumentTypeByName for ${typeName}:`, error);
      return null;
    }
  }

  /**
   * Get only general document type categories
   */
  async getGeneralDocumentTypes() {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, name, category, description, is_general_type')
        .eq('is_general_type', true)
        .order('name');
      
      if (error) {
        logger.error('Error fetching general document types:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      logger.error('Error in getGeneralDocumentTypes:', error);
      return [];
    }
  }

  /**
   * Get only specific document types (non-general)
   */
  async getSpecificDocumentTypes() {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, name, category, description, is_general_type, is_ai_generated, mnemonic, prompt_id')
        .eq('is_general_type', false)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) {
        logger.error('Error fetching specific document types:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      logger.error('Error in getSpecificDocumentTypes:', error);
      return [];
    }
  }

  /**
   * Get specific document types for a general category
   */
  async getDocumentTypesByCategory(categoryName: string) {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, name, category, description, is_general_type, is_ai_generated, mnemonic, prompt_id')
        .eq('is_general_type', false)
        .eq('category', categoryName)
        .order('name');
      
      if (error) {
        logger.error(`Error fetching document types for category ${categoryName}:`, error);
        return [];
      }
      
      return data;
    } catch (error) {
      logger.error(`Error in getDocumentTypesByCategory for ${categoryName}:`, error);
      return [];
    }
  }

  /**
   * Build hierarchical document type structure
   */
  async getHierarchicalDocumentTypes() {
    try {
      const allTypes = await this.getAllDocumentTypes();
      const generalTypes = allTypes.filter(dt => dt.is_general_type === true);
      const specificTypes = allTypes.filter(dt => dt.is_general_type === false);

      const hierarchy = generalTypes.map(generalType => ({
        ...generalType,
        children: specificTypes.filter(specificType => 
          specificType.category === generalType.name
        )
      }));

      const ungroupedTypes = specificTypes.filter(specificType => 
        !generalTypes.some(generalType => generalType.name === specificType.category)
      );

      return {
        generalTypes: hierarchy,
        specificTypes,
        ungroupedTypes
      };
    } catch (error) {
      logger.error('Error in getHierarchicalDocumentTypes:', error);
      return {
        generalTypes: [],
        specificTypes: [],
        ungroupedTypes: []
      };
    }
  }
}

// Export singleton instance
export const documentTypeService = DocumentTypeService.getInstance();