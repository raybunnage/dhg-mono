/**
 * Document Type Service
 * 
 * A service for managing document types in the Supabase database
 */

import { createClient } from '@supabase/supabase-js';

export class DocumentTypeService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get all document types
   */
  async getAllDocumentTypes() {
    try {
      const { data, error } = await this.supabase
        .from('document_types')
        .select('id, document_type, description')
        .order('document_type');
      
      if (error) {
        console.error('Error fetching document types:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('Error in getAllDocumentTypes:', error);
      return [];
    }
  }

  /**
   * Find document type by ID
   */
  async getDocumentTypeById(typeId: string) {
    try {
      const { data, error } = await this.supabase
        .from('document_types')
        .select('id, document_type, description')
        .eq('id', typeId)
        .single();
      
      if (error) {
        console.error(`Error fetching document type ${typeId}:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Error in getDocumentTypeById for ${typeId}:`, error);
      return null;
    }
  }

  /**
   * Find document type by name
   */
  async getDocumentTypeByName(typeName: string) {
    try {
      const { data, error } = await this.supabase
        .from('document_types')
        .select('id, document_type, description')
        .ilike('document_type', typeName)
        .limit(1);
      
      if (error) {
        console.error(`Error fetching document type by name ${typeName}:`, error);
        return null;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      return data[0];
    } catch (error) {
      console.error(`Error in getDocumentTypeByName for ${typeName}:`, error);
      return null;
    }
  }
}

// Export a factory function for easier instantiation
export function createDocumentTypeService(supabaseUrl: string, supabaseKey: string) {
  return new DocumentTypeService(supabaseUrl, supabaseKey);
}