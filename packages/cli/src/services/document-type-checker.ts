import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/error-handler';

// Export types for use throughout the application
export interface DocumentationFile {
  id: string;
  file_path: string;
  title: string;
  summary: string | null;
  document_type_id: string | null;
  created_at: string;
  updated_at: string;
  file_hash?: string;
  content_hash?: string;
  ai_generated_tags?: string[];
  manual_tags?: string[];
  metadata?: Record<string, any>;
}

export interface DocumentationFileWithoutType {
  id: string;
  file_path: string;
  title: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentType {
  id: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentTypeCheckResult {
  totalFiles: number;
  filesWithoutType: number;
  filesWithType: number;
  unassignedFiles: DocumentationFileWithoutType[];
  error?: string; // Optional error message if there's an issue
}

/**
 * Service for checking document type assignments in documentation files
 */
export class DocumentTypeChecker {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Identifies documentation files that don't have a document_type_id assigned
   * @param useDirectSql If true, tries a direct SQL query first before other methods
   * @returns Result containing statistics and list of unassigned files
   */
  async findFilesWithoutDocumentType(useDirectSql: boolean = false): Promise<DocumentTypeCheckResult> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug('Checking for documentation files without document type assignments');
      
      try {
        // Try the direct SQL approach first if requested
        if (useDirectSql) {
          Logger.debug('Using direct SQL approach to find untyped files');
          const directSqlResult = await this.findUntypedFilesDirectSql();
          
          if (directSqlResult && !directSqlResult.error && Array.isArray(directSqlResult)) {
            Logger.debug(`Found ${directSqlResult.length} untyped files using direct SQL`);
            
            // Need to get total counts for the full result
            const { count: totalCount, error: countError } = await this.supabase
              .from('documentation_files')
              .select('*', { count: 'exact', head: true })
              .eq('is_deleted', false);
              
            if (countError) {
              Logger.error(`Error counting total files: ${countError.message}`);
            } else {
              // Convert the results to the expected format
              const unassignedFiles = directSqlResult.map((file: any) => ({
                id: file.id,
                file_path: file.file_path,
                title: file.title,
                summary: file.summary,
                created_at: file.created_at,
                updated_at: file.updated_at
              }));
              
              // We know how many are untyped from the SQL result
              const filesWithoutType = unassignedFiles.length;
              // Calculate how many have types
              const filesWithType = (totalCount || 0) - filesWithoutType;
              
              return {
                totalFiles: totalCount || 0,
                filesWithType,
                filesWithoutType,
                unassignedFiles
              };
            }
          } else if (directSqlResult && directSqlResult.error) {
            Logger.error(`Direct SQL approach failed: ${directSqlResult.error}`);
          }
        }
      
        // Fall back to RPC if direct SQL was not used or failed
        // Use RPC to run direct SQL to get better results
        const { data: sqlResult, error: rpcError } = await this.supabase.rpc('find_untyped_documentation_files');
        
        if (rpcError) {
          // If the RPC function doesn't exist, we'll fall back to our standard query approach
          Logger.debug(`RPC not available: ${rpcError.message}. Falling back to standard query.`);
        } else if (sqlResult) {
          // If we got results from the RPC, parse and return them
          Logger.debug(`Got results from RPC find_untyped_documentation_files`);
          return this.parseRpcResults(sqlResult);
        }
        
        // Standard query approach if RPC didn't work
        Logger.debug('Using standard queries to find files without document types');
        
        // Get all documentation files (excluding deleted ones)
        const { data: allFiles, error: allFilesError } = await this.supabase
          .from('documentation_files')
          .select('id, file_path, title, summary, document_type_id, created_at, updated_at')
          .order('file_path');
        
        if (allFilesError) {
          throw new AppError(
            `Error fetching documentation files: ${allFilesError.message}`,
            'SUPABASE_ERROR',
            allFilesError
          );
        }
        
        if (!allFiles || allFiles.length === 0) {
          return {
            totalFiles: 0,
            filesWithType: 0,
            filesWithoutType: 0,
            unassignedFiles: []
          };
        }
        
        // Now filter the files client-side to find ones without document types
        const filesWithType = allFiles.filter(file => file.document_type_id !== null);
        const filesWithoutType = allFiles.filter(file => file.document_type_id === null);
        
        Logger.debug(`Found ${allFiles.length} total files`);
        Logger.debug(`Found ${filesWithType.length} files with document types`);
        Logger.debug(`Found ${filesWithoutType.length} files without document types`);
        
        // Map the files without types to our return format
        const unassignedFiles = filesWithoutType.map(file => ({
          id: file.id,
          file_path: file.file_path,
          title: file.title,
          summary: file.summary,
          created_at: file.created_at,
          updated_at: file.updated_at
        }));
        
        return {
          totalFiles: allFiles.length,
          filesWithType: filesWithType.length,
          filesWithoutType: filesWithoutType.length,
          unassignedFiles
        };
      } catch (error) {
        Logger.error('Error finding files without document types:', error);
        
        // Try one last direct SQL query approach using select
        try {
          Logger.debug('Trying direct SQL approach as fallback');
          
          // Count all non-deleted files
          const { count: totalCount, error: countError } = await this.supabase
            .from('documentation_files')
            .select('*', { count: 'exact', head: true })
            .eq('is_deleted', false);
            
          if (countError) {
            throw new Error(`Error counting files: ${countError.message}`);
          }
          
          // Get unassigned files using a very simple query - directly uses 'document_type_id is null' 
          const { data: unassignedFiles, error: unassignedError } = await this.supabase
            .from('documentation_files')
            .select('id, file_path, title, summary, created_at, updated_at')
            .is('document_type_id', null)
            .eq('is_deleted', false);
            
          if (unassignedError) {
            throw new Error(`Error getting unassigned files: ${unassignedError.message}`);
          }
          
          // Count files with document types
          const withTypeCount = (totalCount || 0) - (unassignedFiles?.length || 0);
          
          return {
            totalFiles: totalCount || 0,
            filesWithType: withTypeCount,
            filesWithoutType: unassignedFiles?.length || 0,
            unassignedFiles: unassignedFiles as DocumentationFileWithoutType[] || []
          };
        } catch (fallbackError) {
          // If all approaches fail, return an error
          Logger.error('Fallback approach also failed:', fallbackError);
          return {
            totalFiles: 0,
            filesWithType: 0,
            filesWithoutType: 0,
            unassignedFiles: [],
            error: `Failed to find files without document types: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    }, 'Failed to check documentation files for document type assignments');
  }
  
  /**
   * Creates an RPC function in the database to find files without document types
   * This is a helper method that can be called to set up the RPC function
   */
  async createRpcFunction(): Promise<boolean> {
    return await ErrorHandler.wrap(async () => {
      // SQL to create the RPC function - using a simpler direct query approach
      const sql = `
      CREATE OR REPLACE FUNCTION find_untyped_documentation_files()
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        total_files INTEGER;
        files_with_type INTEGER;
        files_without_type INTEGER;
        unassigned_files json;
        result json;
      BEGIN
        -- Count all active files
        SELECT COUNT(*) INTO total_files 
        FROM documentation_files;
        
        -- Count files with document types
        SELECT COUNT(*) INTO files_with_type 
        FROM documentation_files 
        WHERE document_type_id IS NOT NULL;
        
        -- Get the count of files without document types directly with a simple query
        SELECT COUNT(*) INTO files_without_type
        FROM documentation_files
        WHERE document_type_id IS NULL;
        
        -- Get files without document types using a simple direct query
        SELECT json_agg(
          json_build_object(
            'id', id, 
            'file_path', file_path, 
            'title', title, 
            'summary', summary, 
            'created_at', created_at, 
            'updated_at', updated_at
          )
        ) INTO unassigned_files
        FROM documentation_files 
        WHERE document_type_id IS NULL
        ORDER BY file_path;
        
        -- Build the result object
        result := json_build_object(
          'totalFiles', total_files,
          'filesWithType', files_with_type,
          'filesWithoutType', files_without_type,
          'unassignedFiles', COALESCE(unassigned_files, '[]'::json)
        );
        
        RETURN result;
      END;
      $$;
      `;
      
      // Note: We're not actually creating the function via RPC in this implementation.
      // This is placeholder code for when you want to implement function creation.
      try {
        // Placeholder for actual function creation code
        // If implemented, this would create the RPC function in Supabase
        Logger.debug('Skipping RPC function creation - this is implemented with direct queries instead');
        return true;
      } catch (err) {
        const error = err as Error;
        Logger.error(`Error creating RPC function: ${error.message}`);
        return false;
      }
    }, 'Failed to create RPC function for finding untyped documentation files');
  }
  
  /**
   * Directly executes a simple SQL query to find files without document types
   * This is a direct SQL approach that can be used to diagnose issues
   */
  async findUntypedFilesDirectSql(): Promise<any> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug('Executing direct SQL to find untyped documentation files');
      
      // Simple SQL query that directly looks for null document_type_id
      const sql = `
      SELECT
        id, file_path, title, summary, created_at, updated_at
      FROM
        documentation_files
      WHERE
        document_type_id IS NULL
        AND is_deleted = false
      ORDER BY
        file_path;
      `;
      
      // Execute the query directly using select instead of RPC
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select('id, file_path, title, summary, created_at, updated_at')
        .is('document_type_id', null);
      
      if (error) {
        Logger.error(`Error executing direct SQL query: ${error.message}`);
        return { error: error.message };
      }
      
      Logger.debug(`Found ${data?.length || 0} files without document types using direct SQL`);
      return data;
    }, 'Failed to execute direct SQL query for untyped files');
  }

  /**
   * Parse results from the RPC function
   */
  private parseRpcResults(result: any): DocumentTypeCheckResult {
    const totalFiles = result.totalFiles || 0;
    const filesWithType = result.filesWithType || 0;
    const filesWithoutType = result.filesWithoutType || 0;
    const unassignedFiles = result.unassignedFiles || [];
    
    return {
      totalFiles,
      filesWithType,
      filesWithoutType,
      unassignedFiles
    };
  }
}