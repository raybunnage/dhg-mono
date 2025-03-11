import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
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
  
  /**
   * Get a documentation file record by file path
   */
  async getDocumentationFileByPath(filePath: string): Promise<any | null> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting documentation file record by path: ${filePath}`);
      
      // Extract the filename from the path
      const filename = path.basename(filePath);
      
      // Try direct file_path match first
      let { data, error } = await this.client
        .from('documentation_files')
        .select('*')
        .eq('file_path', filePath)
        .limit(1);
      
      if (error) {
        throw new AppError(
          `Failed to get documentation file by path: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      // If not found, try a more flexible search
      if (!data || data.length === 0) {
        Logger.debug(`No exact match found for path: ${filePath}, trying with file name: ${filename}`);
        
        // Try to find by filename part
        ({ data, error } = await this.client
          .from('documentation_files')
          .select('*')
          .ilike('file_path', `%${filename}%`)
          .limit(1));
        
        if (error) {
          throw new AppError(
            `Failed to get documentation file by filename: ${error.message}`,
            'SUPABASE_ERROR',
            error
          );
        }
      }
      
      if (!data || data.length === 0) {
        Logger.warn(`No documentation file found matching path: ${filePath} or filename: ${filename}`);
        return null;
      }
      
      Logger.debug(`Found documentation file with ID: ${data[0].id}`);
      return data[0];
    }, `Failed to get documentation file by path: ${filePath}`);
  }
  
  /**
   * Update documentation file assessment fields
   * 
   * Maps AI API response directly to documentation_files table fields
   */
  async updateDocumentationFileAssessment(docFileId: string, assessment: any, documentTypeId?: string): Promise<any> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Updating assessment for documentation file ID: ${docFileId}`);
      const timestamp = new Date().toISOString();
      
      // Initialize update data with direct field mappings
      const updateData: any = {
        // Store the complete assessment JSON
        ai_assessment: assessment,
        
        // Basic metadata fields
        updated_at: timestamp,
        
        // Direct mappings from documentation_files table fields
        title: assessment.title || null,
        summary: assessment.summary || null,
        ai_generated_tags: assessment.key_topics || assessment.tags || [],
        assessment_quality_score: assessment.confidence || (assessment.quality_assessment?.overall ? assessment.quality_assessment.overall / 5.0 : 0.7),
        assessment_created_at: timestamp,
        assessment_updated_at: timestamp,
        assessment_model: 'claude-3-7-sonnet-20250219',
        assessment_version: 1
      };
      
      // Log direct field mappings for debugging
      Logger.debug('Direct field mappings:');
      Logger.debug(`- title: ${updateData.title}`);
      Logger.debug(`- summary: ${updateData.summary}`);
      Logger.debug(`- ai_generated_tags: ${JSON.stringify(updateData.ai_generated_tags)}`);
      Logger.debug(`- assessment_quality_score: ${updateData.assessment_quality_score}`);
      
      // Validate and normalize fields
      
      // Ensure ai_generated_tags is always an array
      if (!Array.isArray(updateData.ai_generated_tags)) {
        if (updateData.ai_generated_tags) {
          updateData.ai_generated_tags = [updateData.ai_generated_tags];
        } else {
          updateData.ai_generated_tags = [];
        }
      }
      
      // Normalize assessment_quality_score to [0,1] range
      if (typeof updateData.assessment_quality_score === 'number') {
        if (updateData.assessment_quality_score < 0) updateData.assessment_quality_score = 0;
        if (updateData.assessment_quality_score > 1) updateData.assessment_quality_score = 1;
      } else {
        updateData.assessment_quality_score = 0.7; // Default
      }
      
      // Set document_type_id - THE MOST CRITICAL FIELD
      // Direct mapping approach with priority order
      
      // Priority 1: Use explicit parameter if provided
      if (documentTypeId) {
        Logger.debug(`Setting document_type_id from parameter: ${documentTypeId}`);
        updateData.document_type_id = documentTypeId;
      } 
      // Priority 2: Use the field from assessment (direct mapping)
      else if (assessment.document_type_id) {
        Logger.debug(`Setting document_type_id from assessment: ${assessment.document_type_id}`);
        updateData.document_type_id = assessment.document_type_id;
      }
      // Priority 3: Field exists but might be null/empty
      else if (typeof assessment === 'object' && 'document_type_id' in assessment) {
        Logger.debug(`Setting document_type_id from direct property check: ${assessment.document_type_id}`);
        updateData.document_type_id = assessment.document_type_id;
      }
      // Log error if missing
      else {
        Logger.error('No document_type_id available in assessment!');
      }
      
      // Final validation of critical fields
      if (!updateData.document_type_id) {
        Logger.error('⚠️ document_type_id is missing - this is the most critical field!');
      } else {
        Logger.debug(`✅ document_type_id set to: ${updateData.document_type_id}`);
      }
      
      // If summary is missing but description exists, use description
      if (!updateData.summary && assessment.description) {
        updateData.summary = assessment.description;
        Logger.debug(`Using description as summary: ${updateData.summary}`);
      }
      
      // Log complete update data for debugging
      Logger.debug('Final update data prepared:', updateData);
      
      // Perform the database update
      const { data, error } = await this.client
        .from('documentation_files')
        .update(updateData)
        .eq('id', docFileId)
        .select()
        .single();
      
      if (error) {
        throw new AppError(
          `Failed to update documentation file assessment: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Documentation file assessment updated successfully`);
      
      // Log success with field verification
      Logger.debug('Updated fields verification:');
      Logger.debug(`- document_type_id: ${data.document_type_id || 'NULL'}`);
      Logger.debug(`- title: ${data.title || 'NULL'}`);
      Logger.debug(`- summary: ${data.summary ? 'Set (length: ' + data.summary.length + ')' : 'NULL'}`);
      Logger.debug(`- ai_generated_tags: ${JSON.stringify(data.ai_generated_tags || 'NULL')}`);
      Logger.debug(`- assessment_quality_score: ${data.assessment_quality_score || 'NULL'}`);
      Logger.debug(`- assessment_model: ${data.assessment_model || 'NULL'}`);
      
      return data;
    }, `Failed to update assessment for documentation file ID: ${docFileId}`);
  }
}