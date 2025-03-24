import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/error-handler';
import { DocumentType, Prompt, Relationship } from '../models';

// Script types
export interface Script {
  id: string;
  file_path: string;
  title: string;
  language: string;
  document_type: string;
  summary: string;
  tags: string[];
  code_quality: number;
  maintainability: number;
  utility: number;
  documentation: number;
  relevance_score: number;
  relevance_reasoning: string;
  referenced: boolean;
  status: string;
  status_confidence: number;
  status_reasoning: string;
  script_type: string;
  usage_status: string;
  last_analyzed: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptRelationship {
  id: string;
  source_script_id: string;
  target_script_id: string;
  relationship_type: string;
  confidence: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface QueryOptions {
  columns?: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  order?: Array<{
    field: string;
    ascending: boolean;
  }>;
  limit?: number;
}

/**
 * Environment and utility functions for Supabase connections
 */
export interface EnvDiagnostics {
  envFiles: Record<string, {exists: boolean, variables: Record<string, string | null>}>;
  supabaseUrl: string | null;
  serviceKey: string | null;
  anonKey: string | null;
  tablesInfo: Array<{name: string, exists: boolean, columns: Array<{name: string, type: string}>}> | null;
  connectionSuccess: boolean;
}

export class SupabaseService {
  private client: SupabaseClient;
  
  constructor(url: string, key: string) {
    Logger.debug('Initializing Supabase client');
    this.client = createClient(url, key);
  }
  
  /**
   * Read and log environment variables from a file
   * @param filePath Path to the environment file
   * @returns Object containing environment variables (masking sensitive values)
   */
  static readEnvFile(filePath: string): {exists: boolean, variables: Record<string, string | null>} {
    try {
      if (fs.existsSync(filePath)) {
        Logger.debug(`Reading ${filePath} for diagnostics...`);
        const content = fs.readFileSync(filePath, 'utf8');
        const envVars: Record<string, string | null> = {};
        
        content.split('\n').forEach(line => {
          // Skip comments and empty lines
          if (line.trim() && !line.trim().startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('='); // Rejoin in case value contains =
            
            if (key) {
              // Mask sensitive values
              if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || 
                  key.includes('PASSWORD') || key.includes('PASS')) {
                envVars[key.trim()] = value ? '[REDACTED]' : null;
              } else {
                envVars[key.trim()] = value ? value.trim() : null;
              }
            }
          }
        });
        
        return { exists: true, variables: envVars };
      } else {
        return { exists: false, variables: {} };
      }
    } catch (error) {
      Logger.error(`Error reading ${filePath}:`, error);
      return { exists: false, variables: {} };
    }
  }
  
  /**
   * Run environment diagnostics to check for configuration issues
   * @returns Diagnostic information about environment and connection status
   */
  static async runEnvDiagnostics(): Promise<EnvDiagnostics> {
    const results: EnvDiagnostics = {
      envFiles: {},
      supabaseUrl: null,
      serviceKey: null,
      anonKey: null,
      tablesInfo: null,
      connectionSuccess: false
    };
    
    // Check for environment files
    const cwd = process.cwd();
    const envFiles = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production'
    ];
    
    for (const file of envFiles) {
      const filePath = path.join(cwd, file);
      results.envFiles[file] = this.readEnvFile(filePath);
    }
    
    // Get environment variables that matter for Supabase
    results.supabaseUrl = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL || null;
    results.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : null;
    results.anonKey = process.env.SUPABASE_ANON_KEY ? '[SET]' : null;
    
    if (!results.supabaseUrl || (!results.serviceKey && !results.anonKey)) {
      Logger.error('Missing required Supabase environment variables');
      return results;
    }
    
    // Try to connect to Supabase and check tables
    try {
      // Use service key with fallback to anon key
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabase = createClient(results.supabaseUrl, key);
      
      // Test connection with a simple query
      const { error } = await supabase.from('_prisma_migrations').select('id').limit(1);
      
      if (error) {
        Logger.warn(`Connection test error: ${error.message}`);
        
        // Try with a different table
        const { error: error2 } = await supabase.from('document_types').select('id').limit(1);
        
        if (error2) {
          Logger.error(`Second connection test error: ${error2.message}`);
          return results;
        }
      }
      
      // Connection successful
      results.connectionSuccess = true;
      
      // Check for important tables
      results.tablesInfo = [];
      const tables = ['documentation_files', 'document_types', 'scripts'];
      
      for (const table of tables) {
        try {
          // Check if table exists and get its columns
          const { data, error: tableError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_schema', 'public')
            .eq('table_name', table);
          
          if (tableError || !data || data.length === 0) {
            results.tablesInfo.push({
              name: table,
              exists: false,
              columns: []
            });
          } else {
            results.tablesInfo.push({
              name: table,
              exists: true,
              columns: data.map(column => ({
                name: column.column_name,
                type: column.data_type
              }))
            });
          }
        } catch (tableError) {
          Logger.error(`Error checking table ${table}:`, tableError);
          results.tablesInfo.push({
            name: table,
            exists: false,
            columns: []
          });
        }
      }
      
    } catch (error) {
      Logger.error('Error during diagnostics:', error);
    }
    
    return results;
  }
  
  /**
   * Normalize a file path to use the project-relative format
   * Converts paths like /Users/username/path/to/dhg-mono/apps/my-app/file.js
   * to apps/my-app/file.js
   * 
   * @param filePath The file path to normalize
   * @returns The normalized file path
   */
  static normalizePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return filePath;
    }
    
    let normalizedPath = filePath;
    
    // Regular expression patterns to match
    const appsFolderPattern = /(?:\/|^)apps\/([^/].+)/i;
    const docsFolderPattern = /(?:\/|^)docs\/([^/].+)/i;
    const srcFolderPattern = /(?:\/|^)src\/([^/].+)/i;
    const packagesFolderPattern = /(?:\/|^)packages\/([^/].+)/i;
    
    // Match patterns for top-level folders
    let match;
    if (match = filePath.match(appsFolderPattern)) {
      normalizedPath = 'apps/' + match[1];
    } else if (match = filePath.match(docsFolderPattern)) {
      normalizedPath = 'docs/' + match[1];
    } else if (match = filePath.match(srcFolderPattern)) {
      normalizedPath = 'src/' + match[1];
    } else if (match = filePath.match(packagesFolderPattern)) {
      normalizedPath = 'packages/' + match[1];
    } else {
      // For any other paths, remove everything up to the last directory
      // that isn't a known top-level folder
      const parts = filePath.split('/');
      const validParts = parts.filter(part => part && part !== 'dhg-mono' && 
        !part.includes('Users') && !part.includes('Documents') && !part.includes('github'));
      normalizedPath = validParts.join('/');
    }
    
    // Remove any leading slash
    normalizedPath = normalizedPath.replace(/^\/+/, '');
    
    return normalizedPath;
  }
  
  /**
   * Get diagnostic information about Supabase connection and environment
   * @returns Diagnostic information
   */
  async getDiagnostics(): Promise<EnvDiagnostics> {
    return await ErrorHandler.wrap(async () => {
      return SupabaseService.runEnvDiagnostics();
    }, 'Failed to run Supabase diagnostics');
  }
  
  /**
   * Execute a query on a table
   */
  async executeQuery(table: string, action: 'select' | 'insert' | 'update' | 'delete', options: QueryOptions): Promise<any> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Executing ${action} query on ${table}`);
      
      let query: any;
      
      if (action === 'select') {
        query = this.client.from(table).select(options.columns || '*');
        
        // Apply filters
        if (options.filters) {
          for (const filter of options.filters) {
            query = query.filter(filter.field, filter.operator, filter.value);
          }
        }
        
        // Apply ordering
        if (options.order && options.order.length > 0) {
          for (const order of options.order) {
            query = query.order(order.field, { ascending: order.ascending });
          }
        }
        
        // Apply limit
        if (options.limit) {
          query = query.limit(options.limit);
        }
        
        const { data, error } = await query;
        
        if (error) {
          throw new AppError(`Query error: ${error.message}`, 'SUPABASE_ERROR', error);
        }
        
        return data;
      } else if (action === 'update') {
        // Use for update operations
        throw new AppError('Update operation must use the update method', 'OPERATION_ERROR');
      } else if (action === 'insert') {
        // Use for insert operations
        throw new AppError('Insert operation must use the insert method', 'OPERATION_ERROR');
      } else if (action === 'delete') {
        // Use for delete operations
        throw new AppError('Delete operation must use the delete method', 'OPERATION_ERROR');
      }
      
      throw new AppError(`Unsupported action: ${action}`, 'OPERATION_ERROR');
    }, `Failed to execute ${action} query on ${table}`);
  }
  
  /**
   * Get a record by ID
   */
  async getById(table: string, id: string): Promise<any> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting record from ${table} by ID: ${id}`);
      
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw new AppError(`Failed to get record by ID: ${error.message}`, 'SUPABASE_ERROR', error);
      }
      
      return data;
    }, `Failed to get record from ${table} with ID: ${id}`);
  }
  
  /**
   * Update a record
   */
  async update(table: string, id: string, updates: any): Promise<any> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Updating record in ${table} with ID: ${id}`);
      
      const { data, error } = await this.client
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new AppError(`Failed to update record: ${error.message}`, 'SUPABASE_ERROR', error);
      }
      
      return data;
    }, `Failed to update record in ${table} with ID: ${id}`);
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
   * This method tries multiple path formats to handle both
   * project-root relative paths and other path formats
   */
  async getDocumentationFileByPath(filePath: string): Promise<any | null> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting documentation file record by path: ${filePath}`);
      
      // Extract the filename and basename from the path
      const filename = path.basename(filePath);
      
      // 1. Use SupabaseService.normalizePath to get a standard format
      const standardPath = SupabaseService.normalizePath(filePath);
      Logger.debug(`Normalized path using standard function: ${standardPath}`);
      
      // Create a list of paths to try
      const normalizedPaths = [];
      
      // Start with the standardized path from our normalization function
      normalizedPaths.push(standardPath);
      
      // 2. Use the exact path provided
      normalizedPaths.push(filePath);
      
      // 3. If the path starts with a project root, extract the relative part
      // Look for common patterns like /Users/.../dhg-mono/apps/... or /home/.../dhg-mono/...
      const monoRepoMatch = filePath.match(/^.*?(\/dhg-mono\/)(.*)/);
      if (monoRepoMatch && monoRepoMatch[2]) {
        normalizedPaths.push(monoRepoMatch[2]);
      }
      
      // 4. Handle src/ paths for app-specific components
      if (filePath.includes('/src/') && !normalizedPaths.includes('src/' + filename)) {
        normalizedPaths.push('src/' + path.basename(path.dirname(filePath)) + '/' + filename);
        normalizedPaths.push('src/' + filename);
      }
      
      // 5. Handle apps/ paths for monorepo components
      if (filePath.includes('/apps/')) {
        const appsMatch = filePath.match(/.*?\/apps\/([^\/]+)\/(.*)/);
        if (appsMatch && appsMatch[2]) {
          normalizedPaths.push('apps/' + appsMatch[1] + '/' + appsMatch[2]);
        }
      }
      
      // 6. Add just the filename as last resort
      normalizedPaths.push(filename);
      
      // Remove duplicates
      const uniquePaths = [...new Set(normalizedPaths)];
      Logger.debug(`Trying these normalized paths: ${uniquePaths.join(', ')}`);
      
      // Try each path format until we find a match
      for (const normPath of uniquePaths) {
        const { data, error } = await this.client
          .from('documentation_files')
          .select('*')
          .eq('file_path', normPath)
          .limit(1);
        
        if (error) {
          Logger.error(`Error querying file path: ${normPath}`, error);
          continue;
        }
        
        if (data && data.length > 0) {
          Logger.debug(`Found documentation file with path: ${normPath}, ID: ${data[0].id}`);
          return data[0];
        }
      }
      
      // Try a more flexible search if none of the exact matches worked
      Logger.debug(`No exact match found, trying a flexible search with filename: ${filename}`);
      const { data, error } = await this.client
        .from('documentation_files')
        .select('*')
        .ilike('file_path', `%${filename}%`)
        .limit(1);
      
      if (error) {
        throw new AppError(
          `Failed to get documentation file by filename: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      if (data && data.length > 0) {
        Logger.debug(`Found documentation file with fuzzy match: ${data[0].file_path}, ID: ${data[0].id}`);
        return data[0];
      }
      
      Logger.warn(`No documentation file found matching any of the attempted paths or filename: ${filename}`);
      return null;
    }, `Failed to get documentation file by path: ${filePath}`);
  }
  
  /**
   * Update file paths in documentation_files to use normalized format
   * @param dryRun If true, only show what would be updated without making changes
   * @returns Information about the update operation
   */
  async updateDocumentationFilePaths(dryRun: boolean = false): Promise<{
    totalPaths: number;
    pathsToUpdate: number;
    updatedPaths: number;
    failedUpdates: number;
    details: Array<{id: string, originalPath: string, normalizedPath: string, updated: boolean}>;
  }> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug('Looking for file paths to normalize in documentation_files table');
      
      // Get all documentation files
      const { data, error } = await this.client
        .from('documentation_files')
        .select('id, file_path')
        .order('file_path');
      
      if (error) {
        throw new AppError(
          `Failed to get documentation files: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      if (!data || data.length === 0) {
        Logger.debug('No documentation files found');
        return {
          totalPaths: 0,
          pathsToUpdate: 0,
          updatedPaths: 0,
          failedUpdates: 0,
          details: []
        };
      }
      
      Logger.debug(`Found ${data.length} documentation files`);
      
      // Determine which paths need to be updated
      const pathsToUpdate: Array<{id: string, originalPath: string, normalizedPath: string, updated: boolean}> = [];
      
      for (const file of data) {
        if (!file.file_path) continue;
        
        const normalizedPath = SupabaseService.normalizePath(file.file_path);
        
        if (normalizedPath !== file.file_path) {
          pathsToUpdate.push({
            id: file.id,
            originalPath: file.file_path,
            normalizedPath,
            updated: false
          });
        }
      }
      
      Logger.debug(`Found ${pathsToUpdate.length} paths that need to be normalized`);
      
      // If dry run, just return the results without making changes
      if (dryRun) {
        Logger.debug('Dry run - not making any changes');
        return {
          totalPaths: data.length,
          pathsToUpdate: pathsToUpdate.length,
          updatedPaths: 0,
          failedUpdates: 0,
          details: pathsToUpdate
        };
      }
      
      // Update each path
      let updatedPaths = 0;
      let failedUpdates = 0;
      
      for (const path of pathsToUpdate) {
        try {
          const { error: updateError } = await this.client
            .from('documentation_files')
            .update({ file_path: path.normalizedPath })
            .eq('id', path.id);
          
          if (updateError) {
            Logger.error(`Failed to update path ${path.id}: ${updateError.message}`);
            failedUpdates++;
            continue;
          }
          
          updatedPaths++;
          path.updated = true;
          Logger.debug(`Updated path ${path.id} from "${path.originalPath}" to "${path.normalizedPath}"`);
        } catch (error) {
          Logger.error(`Error updating path ${path.id}:`, error);
          failedUpdates++;
        }
      }
      
      Logger.debug(`Successfully updated ${updatedPaths} of ${pathsToUpdate.length} paths`);
      
      return {
        totalPaths: data.length,
        pathsToUpdate: pathsToUpdate.length,
        updatedPaths,
        failedUpdates,
        details: pathsToUpdate
      };
    }, 'Failed to update documentation file paths');
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
        // Get a score in the 0-1 range first
        assessment_quality_score: assessment.assessment_quality_score || assessment.confidence || 
          (assessment.quality_assessment?.overall ? parseFloat((assessment.quality_assessment.overall / 5.0).toFixed(2)) : 0.7),
        // We'll convert it to an integer in the 0-100 range in the normalization step
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
      try {
        // Convert to number if it's a string
        if (typeof updateData.assessment_quality_score === 'string') {
          updateData.assessment_quality_score = parseFloat(updateData.assessment_quality_score);
        }
        
        // Make sure it's a valid number
        if (isNaN(updateData.assessment_quality_score) || typeof updateData.assessment_quality_score !== 'number') {
          updateData.assessment_quality_score = 0.7; // We'll convert to integer (70) later
        }
        
        // Normalize assessment_quality_score to [0,100] range (integer percent)
        // This is necessary because the database column appears to be an integer, not a decimal
        if (updateData.assessment_quality_score < 0) updateData.assessment_quality_score = 0;
        if (updateData.assessment_quality_score > 1) {
          // If it's already greater than 1, assume it's already in the 0-100 range
          updateData.assessment_quality_score = Math.round(updateData.assessment_quality_score);
        } else {
          // Convert from 0-1 scale to 0-100 integer
          updateData.assessment_quality_score = Math.round(updateData.assessment_quality_score * 100);
        }
        
        // Ensure it's an integer
        updateData.assessment_quality_score = Math.floor(updateData.assessment_quality_score);
      } catch (error) {
        Logger.warn('Error normalizing assessment_quality_score, using default', error);
        updateData.assessment_quality_score = 70; // Default (0.7 on 0-1 scale = 70 on 0-100 scale)
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
  
  /**
   * Get script by file path
   */
  async getScriptByPath(filePath: string): Promise<Script | null> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting script with file path: ${filePath}`);
      
      const { data, error } = await this.client
        .from('scripts')
        .select('*')
        .eq('file_path', filePath)
        .maybeSingle();
      
      if (error) {
        throw new AppError(
          `Failed to get script by path: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      if (!data) {
        Logger.debug(`No script found with path: ${filePath}`);
        return null;
      }
      
      Logger.debug(`Found script with path: ${filePath}`);
      return data as Script;
    }, `Failed to get script by path: ${filePath}`);
  }
  
  /**
   * Get all scripts
   */
  async getAllScripts(): Promise<Script[]> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug('Getting all scripts');
      
      const { data, error } = await this.client
        .from('scripts')
        .select('*')
        .order('file_path');
      
      if (error) {
        throw new AppError(
          `Failed to get all scripts: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Found ${data?.length || 0} scripts`);
      return data as Script[] || [];
    }, 'Failed to get all scripts');
  }
  
  /**
   * Get scripts by document type
   */
  async getScriptsByDocumentType(documentType: string): Promise<Script[]> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting scripts with document type: ${documentType}`);
      
      const { data, error } = await this.client
        .from('scripts')
        .select('*')
        .eq('document_type', documentType)
        .order('file_path');
      
      if (error) {
        throw new AppError(
          `Failed to get scripts by document type: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Found ${data?.length || 0} scripts with document type: ${documentType}`);
      return data as Script[] || [];
    }, `Failed to get scripts with document type: ${documentType}`);
  }
  
  /**
   * Get scripts by status
   */
  async getScriptsByStatus(status: string): Promise<Script[]> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting scripts with status: ${status}`);
      
      const { data, error } = await this.client
        .from('scripts')
        .select('*')
        .eq('status', status)
        .order('file_path');
      
      if (error) {
        throw new AppError(
          `Failed to get scripts by status: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Found ${data?.length || 0} scripts with status: ${status}`);
      return data as Script[] || [];
    }, `Failed to get scripts with status: ${status}`);
  }
  
  /**
   * Insert or update a script
   */
  async upsertScript(scriptData: Partial<Script>): Promise<Script> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Upserting script with file path: ${scriptData.file_path}`);
      
      // Ensure required fields are present
      if (!scriptData.file_path) {
        throw new AppError('Script file_path is required for upsert', 'VALIDATION_ERROR');
      }
      
      const now = new Date().toISOString();
      
      // Add timestamps if not present
      if (!scriptData.created_at) {
        scriptData.created_at = now;
      }
      scriptData.updated_at = now;
      
      const { data, error } = await this.client
        .from('scripts')
        .upsert(scriptData, { 
          onConflict: 'file_path',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) {
        throw new AppError(
          `Failed to upsert script: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Successfully upserted script: ${scriptData.file_path}`);
      return data as Script;
    }, `Failed to upsert script with file path: ${scriptData.file_path}`);
  }
  
  /**
   * Delete a script
   */
  async deleteScript(filePath: string): Promise<void> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Deleting script with file path: ${filePath}`);
      
      const { error } = await this.client
        .from('scripts')
        .delete()
        .eq('file_path', filePath);
      
      if (error) {
        throw new AppError(
          `Failed to delete script: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Successfully deleted script: ${filePath}`);
    }, `Failed to delete script with file path: ${filePath}`);
  }
  
  /**
   * Add a script relationship
   */
  async addScriptRelationship(relationshipData: {
    source_path: string;
    target_path: string;
    relationship_type: string;
    confidence: number;
    notes?: string;
  }): Promise<ScriptRelationship> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Adding script relationship: ${relationshipData.source_path} -> ${relationshipData.target_path}`);
      
      // Get source script
      const sourceScript = await this.getScriptByPath(relationshipData.source_path);
      if (!sourceScript) {
        throw new AppError(
          `Source script not found: ${relationshipData.source_path}`,
          'NOT_FOUND_ERROR'
        );
      }
      
      // Get target script
      const targetScript = await this.getScriptByPath(relationshipData.target_path);
      if (!targetScript) {
        throw new AppError(
          `Target script not found: ${relationshipData.target_path}`,
          'NOT_FOUND_ERROR'
        );
      }
      
      // Create relationship
      const now = new Date().toISOString();
      const relationship = {
        source_script_id: sourceScript.id,
        target_script_id: targetScript.id,
        relationship_type: relationshipData.relationship_type,
        confidence: relationshipData.confidence,
        notes: relationshipData.notes || null,
        created_at: now,
        updated_at: now
      };
      
      const { data, error } = await this.client
        .from('script_relationships')
        .upsert(relationship, {
          onConflict: 'source_script_id,target_script_id,relationship_type',
          ignoreDuplicates: false
        })
        .select()
        .single();
      
      if (error) {
        throw new AppError(
          `Failed to add script relationship: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      Logger.debug(`Successfully added script relationship: ${relationshipData.source_path} -> ${relationshipData.target_path}`);
      return data as ScriptRelationship;
    }, `Failed to add script relationship: ${relationshipData.source_path} -> ${relationshipData.target_path}`);
  }
  
  /**
   * Get script relationships for a specific script
   */
  async getScriptRelationships(scriptPath: string): Promise<Array<{
    id: string;
    relationship_type: string;
    confidence: number;
    notes?: string;
    related_script: {
      id: string;
      file_path: string;
      title: string;
    };
    is_source: boolean;
  }>> {
    return await ErrorHandler.wrap(async () => {
      Logger.debug(`Getting relationships for script: ${scriptPath}`);
      
      // Get script ID
      const script = await this.getScriptByPath(scriptPath);
      if (!script) {
        throw new AppError(
          `Script not found: ${scriptPath}`,
          'NOT_FOUND_ERROR'
        );
      }
      
      // Get relationships where this script is either source or target
      const { data: relationshipsData, error } = await this.client
        .from('script_relationships')
        .select(`
          id,
          relationship_type,
          confidence,
          notes,
          source_script:source_script_id(id, file_path, title),
          target_script:target_script_id(id, file_path, title)
        `)
        .or(`source_script_id.eq.${script.id},target_script_id.eq.${script.id}`);
      
      if (error) {
        throw new AppError(
          `Failed to get script relationships: ${error.message}`,
          'SUPABASE_ERROR',
          error
        );
      }
      
      if (!relationshipsData || relationshipsData.length === 0) {
        Logger.debug(`No relationships found for script: ${scriptPath}`);
        return [];
      }
      
      // Format the relationships for easier consumption
      const formattedRelationships = relationshipsData.map((rel: any) => {
        // Check if the script is the source or target
        const isSource = rel.source_script && rel.source_script.id === script.id;
        
        // The related script is the opposite of what the current script is
        const relatedScript = isSource && rel.target_script ? rel.target_script : 
                             (!isSource && rel.source_script ? rel.source_script : {id: '', file_path: '', title: ''});
        
        return {
          id: rel.id,
          relationship_type: rel.relationship_type,
          confidence: rel.confidence,
          notes: rel.notes,
          related_script: {
            id: relatedScript.id || '',
            file_path: relatedScript.file_path || '',
            title: relatedScript.title || ''
          },
          is_source: isSource
        };
      });
      
      Logger.debug(`Found ${formattedRelationships.length} relationships for script: ${scriptPath}`);
      return formattedRelationships;
    }, `Failed to get relationships for script: ${scriptPath}`);
  }
}