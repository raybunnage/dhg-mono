import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/error-handler';
import { DocumentType, Prompt, Relationship } from '../models';

export class SupabaseService {
  private client: SupabaseClient;
  
  constructor(url: string, key: string) {
    Logger.debug('Initializing Supabase client');
    this.client = createClient(url, key);
  }
  
  /**
   * Get a prompt by name
   */
  async getPromptByName(name: string): Promise<Prompt | null> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting prompt by name: ${name}`);
      
      const { data, error } = await this.client
        .from('prompts')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(1);
      
      if (error) {
        throw new AppError(
          `Failed to get prompt by name: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      if (!data || data.length === 0) {
        Logger.warn(`No prompt found with name: ${name}`);
        return null;
      }
      
      Logger.debug(`Found prompt: ${data[0].name}`);
      return data[0] as Prompt;
    }, `Failed to get prompt by name: ${name}`);
  }
  
  /**
   * Get relationships by prompt ID
   */
  async getRelationshipsByPromptId(promptId: string): Promise<Relationship[]> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting relationships for prompt ID: ${promptId}`);
      
      const { data, error } = await this.client
        .from('prompt_relationships')
        .select('*')
        .eq('prompt_id', promptId);
      
      if (error) {
        throw new AppError(
          `Failed to get relationships for prompt: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Found ${data?.length || 0} relationships for prompt ID: ${promptId}`);
      return data as Relationship[] || [];
    }, `Failed to get relationships for prompt ID: ${promptId}`);
  }
  
  /**
   * Get document types by category
   */
  async getDocumentTypesByCategory(category: string): Promise<DocumentType[]> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting document types for category: ${category}`);
      
      const { data, error } = await this.client
        .from('document_types')
        .select('*')
        .eq('category', category);
      
      if (error) {
        throw new AppError(
          `Failed to get document types by category: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Found ${data?.length || 0} document types for category: ${category}`);
      return data as DocumentType[] || [];
    }, `Failed to get document types for category: ${category}`);
  }
  
  /**
   * Get a document type by ID
   */
  async getDocumentTypeById(id: string): Promise<DocumentType | null> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting document type by ID: ${id}`);
      
      const { data, error } = await this.client
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned error
          Logger.warn(`No document type found with ID: ${id}`);
          return null;
        }
        throw new AppError(
          `Failed to get document type by ID: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Found document type: ${data.name}`);
      return data as DocumentType;
    }, `Failed to get document type by ID: ${id}`);
  }
}