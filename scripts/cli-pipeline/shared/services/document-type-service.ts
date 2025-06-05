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
   * Get all document types
   */
  async getAllDocumentTypes() {
    try {
      const { data, error } = await this.getClient()
        .from('document_types')
        .select('id, document_type, description')
        .order('document_type');
      
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
        .select('id, document_type, description')
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
        .select('id, document_type, description')
        .ilike('document_type', typeName)
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
}

// Export singleton instance
export const documentTypeService = DocumentTypeService.getInstance();