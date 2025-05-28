/**
 * Prompt Service
 * 
 * A central service for managing AI prompts across the application.
 * Handles prompt retrieval, relationships, metadata extraction, and database queries.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils';
import { FileService } from '../file-service/file-service';
import { claudeService } from '../claude-service/claude-service';
import { SupabaseClientService } from '../../services/supabase-client';
import { promptOutputTemplateService, PromptOutputTemplate } from './prompt-output-templates';

/**
 * Prompt data structure
 */
export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

/**
 * Prompt relationship data structure
 */
export interface PromptRelationship {
  id: string;
  prompt_id: string;
  asset_id?: string;
  asset_path: string;
  document_type_id?: string;
  relationship_type: string;
  relationship_context?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Options for loading a prompt
 */
export interface PromptLoadOptions {
  includeDatabaseQueries?: boolean;
  includeRelationships?: boolean;
  includeRelatedFiles?: boolean;
  executeQueries?: boolean;
  returnAsMarkdown?: boolean;
  returnAll?: boolean;
  includeOutputTemplates?: boolean; // Include associated output templates
}

/**
 * Results from loading a prompt with relationships and queries
 */
export interface PromptLoadResult {
  prompt: Prompt | null;
  relationships: PromptRelationship[];
  relatedFiles: {
    relationship: PromptRelationship;
    content: string;
    stats?: {
      lines: number;
      size: number;
    };
  }[];
  databaseQueries: {
    queryName: string;
    queryText: string;
    queryResults: any;
  }[];
  outputTemplates?: {
    id: string;
    name: string;
    template: any;
    priority: number;
  }[];
  combinedContent: string;
}

/**
 * Prompt Service Implementation
 */
export class PromptService {
  private static instance: PromptService;
  private fileService: FileService;
  private supabaseService: SupabaseClientService;
  
  /**
   * Create a new Prompt service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Initialize services
    this.fileService = new FileService();
    this.supabaseService = SupabaseClientService.getInstance();
    
    Logger.debug('PromptService initialized with SupabaseClientService');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService();
    }
    return PromptService.instance;
  }
  
  /**
   * Get a prompt by name
   * Tries database first, then falls back to filesystem
   */
  public async getPromptByName(promptName: string): Promise<Prompt | null> {
    try {
      // First try to get the prompt from the database
      try {
        Logger.debug(`Looking for prompt '${promptName}' in database`);
        
        // Use SupabaseClientService
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
          .from('ai_prompts')
          .select('*')
          .eq('name', promptName)
          .limit(1)
          .single();
        
        if (error) {
          Logger.debug(`Error fetching prompt from database: ${error.message}`);
        } else if (data) {
          Logger.debug(`Found prompt '${promptName}' in database`);
          return data as Prompt;
        } else {
          Logger.debug(`Prompt '${promptName}' not found in database`);
        }
      } catch (dbError) {
        Logger.debug(`Database error when fetching prompt: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      
      // If database fetch fails, try the file system
      Logger.debug(`Trying to find prompt '${promptName}' in file system`);
      
      // Try multiple possible file locations
      const promptFileDir = path.join(process.cwd(), 'prompts');
      const possiblePaths = [
        path.join(promptFileDir, `${promptName}.md`),
        path.join(promptFileDir, promptName),
        path.join(process.cwd(), promptName)
      ];
      
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          Logger.debug(`Found prompt file on disk: ${filePath}`);
          
          // Extract metadata from the prompt file if available
          const metadata = this.extractMetadataFromContent(content);
          
          // Create a prompt object from the file content
          const prompt: Prompt = {
            id: 'local-file',
            name: promptName,
            content: content,
            description: 'Loaded from local file',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: metadata
          };
          
          return prompt;
        }
      }
      
      Logger.debug(`Prompt '${promptName}' not found in either database or file system`);
      return null;
    } catch (error) {
      Logger.error(`Error getting prompt by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Extract metadata from prompt content
   */
  private extractMetadataFromContent(content: string): Record<string, any> | undefined {
    try {
      // Try to extract metadata from HTML comments <!-- -->
      const metadataMatch = content.match(/<!--\s*([\s\S]*?)\s*-->/);
      if (metadataMatch && metadataMatch[1]) {
        try {
          return JSON.parse(metadataMatch[1]);
        } catch (parseError) {
          Logger.debug(`Error parsing metadata from HTML comments: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
      
      // Try to extract metadata from markdown front matter
      const frontMatterMatch = content.match(/---\s*([\s\S]*?)\s*---/);
      if (frontMatterMatch && frontMatterMatch[1]) {
        const metadata: Record<string, any> = {};
        const lines = frontMatterMatch[1].split('\n');
        
        for (const line of lines) {
          const keyValueMatch = line.match(/([^:]+):\s*(.+)/);
          if (keyValueMatch) {
            const [, key, value] = keyValueMatch;
            if (key && value) {
              // Try to parse JSON values
              try {
                metadata[key.trim()] = JSON.parse(value.trim());
              } catch {
                // If not JSON, use as string
                metadata[key.trim()] = value.trim();
              }
            }
          }
        }
        
        return Object.keys(metadata).length > 0 ? metadata : undefined;
      }
      
      return undefined;
    } catch (error) {
      Logger.debug(`Error extracting metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }
  
  /**
   * Get relationships for a prompt by prompt ID
   */
  public async getRelationshipsByPromptId(promptId: string): Promise<PromptRelationship[]> {
    try {
      Logger.debug(`Getting relationships for prompt ID: ${promptId}`);
      
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('ai_prompt_relationships')
        .select('*')
        .eq('prompt_id', promptId);
      
      if (error) {
        Logger.error(`Error fetching relationships: ${error.message}`);
        return [];
      }
      
      Logger.debug(`Found ${data?.length || 0} relationships for prompt ID: ${promptId}`);
      return data as PromptRelationship[];
    } catch (error) {
      Logger.error(`Error getting relationships by prompt ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
  
  /**
   * Execute a database query
   */
  public async executeQuery(queryText: string, parameters?: Record<string, any>): Promise<any> {
    try {
      Logger.debug(`Executing database query: ${queryText}`);
      
      // Clean query - remove trailing semicolons which cause syntax errors in RPC calls
      queryText = queryText.trim().replace(/;+$/, '');
      
      // Replace parameters in the query if provided
      if (parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          // If value is a string, wrap it in quotes for SQL
          const replacement = typeof value === 'string' ? `'${value}'` : value;
          queryText = queryText.replace(new RegExp(`:${key}\\b`, 'g'), replacement);
        });
        
        Logger.debug(`Query with parameters replaced: ${queryText}`);
      }
      
      // Use Supabase client to execute RPC
      const supabase = this.supabaseService.getClient();
      
      try {
        Logger.debug('Executing query via RPC execute_sql function');
        const { data, error } = await supabase.rpc('execute_sql', { sql: queryText });
        
        if (error) {
          Logger.warn(`RPC execute_sql failed: ${error.message}`);
        } else {
          Logger.debug('Query execution successful via RPC');
          return data;
        }
      } catch (rpcError) {
        Logger.warn(`RPC method not available: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
      }
      
      // Handle specific table queries as fallback
      if (queryText.toLowerCase().includes('from document_types')) {
        // Handle document_types query
        Logger.debug('Falling back to direct table query for document_types');
        
        // Try to determine filters from the SQL query
        let categoryFilter = null;
        
        // Check for Documentation category
        if (queryText.includes("category = 'Documentation'") || queryText.includes('category = "Documentation"')) {
          const { data, error } = await supabase
            .from('document_types')
            .select('*')
            .eq('category', 'Documentation');
            
          if (error) {
            throw new Error(`Failed to query document_types: ${error.message}`);
          }
          
          return data;
        }
        
        // Handle IN queries for multiple categories
        const inClauseMatch = queryText.match(/category\s+IN\s*\(([^)]+)\)/i);
        if (inClauseMatch && inClauseMatch[1]) {
          // Extract categories from the IN clause
          const categoryValues: string[] = [];
          
          // Capture quoted strings in the IN clause
          const categoryMatches = inClauseMatch[1].match(/['"]([^'"]+)['"]/g);
          if (categoryMatches) {
            categoryMatches.forEach(match => {
              const value = match.replace(/^['"]|['"]$/g, '');
              if (value) categoryValues.push(value);
            });
          }
          
          // If no categories found with quotes, try splitting by comma
          if (categoryValues.length === 0) {
            const cleanedInClause = inClauseMatch[1].trim();
            const alternativeCategories = cleanedInClause
              .split(',')
              .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean);
              
            if (alternativeCategories.length > 0) {
              categoryValues.push(...alternativeCategories);
            }
          }
          
          if (categoryValues.length > 0) {
            Logger.debug(`Using IN filter for document_types with categories: ${categoryValues.join(', ')}`);
            
            const { data, error } = await supabase
              .from('document_types')
              .select('*')
              .in('category', categoryValues);
              
            if (error) {
              throw new Error(`Failed to query document_types with IN clause: ${error.message}`);
            }
            
            return data;
          }
        }
        
        // Fallback to simple select without filters
        const { data, error } = await supabase
          .from('document_types')
          .select('*');
          
        if (error) {
          throw new Error(`Failed to query document_types: ${error.message}`);
        }
        
        return data;
      }
      
      throw new Error("No method available to execute this query");
    } catch (error) {
      Logger.error(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Load and process a prompt with all related data
   */
  public async loadPrompt(
    promptName: string, 
    options: PromptLoadOptions = {}
  ): Promise<PromptLoadResult> {
    const defaultOptions: PromptLoadOptions = {
      includeDatabaseQueries: true,
      includeRelationships: true,
      includeRelatedFiles: true,
      executeQueries: true,
      returnAsMarkdown: false,
      returnAll: true
    };
    
    // Merge with default options
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Initialize result object
    const result: PromptLoadResult = {
      prompt: null,
      relationships: [],
      relatedFiles: [],
      databaseQueries: [],
      combinedContent: ''
    };
    
    try {
      // Step 1: Get the prompt
      result.prompt = await this.getPromptByName(promptName);
      
      if (!result.prompt) {
        throw new Error(`Prompt '${promptName}' not found`);
      }
      
      // Start building combined content
      let combinedContent = result.prompt.content;
      
      // Step 2: Get relationships if option is enabled
      if (mergedOptions.includeRelationships && result.prompt.id !== 'local-file') {
        result.relationships = await this.getRelationshipsByPromptId(result.prompt.id);
        
        // Step 3: Get related file contents if option is enabled
        if (mergedOptions.includeRelatedFiles) {
          for (const relationship of result.relationships) {
            try {
              const fileResult = this.fileService.readFile(relationship.asset_path);
              
              if (fileResult.success) {
                result.relatedFiles.push({
                  relationship,
                  content: fileResult.content || '',
                  stats: fileResult.stats
                });
                
                // Add file content to combined content
                combinedContent += `\n\n## ${relationship.relationship_type} - ${path.basename(relationship.asset_path)}\n\n`;
                combinedContent += fileResult.content || '';
              }
            } catch (fileError) {
              Logger.debug(`Error reading file ${relationship.asset_path}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
            }
          }
        }
      }
      
      // Step 4: Handle database queries from metadata
      if (mergedOptions.includeDatabaseQueries && result.prompt.metadata) {
        // Check for database queries in metadata
        const databaseQueries: { queryName: string, queryText: string }[] = [];
        
        // Check for primary database query
        if (result.prompt.metadata.database_query || result.prompt.metadata.databaseQuery) {
          databaseQueries.push({
            queryName: 'primary',
            queryText: result.prompt.metadata.database_query || result.prompt.metadata.databaseQuery
          });
        }
        
        // Check for secondary database query
        if (result.prompt.metadata.databaseQuery2) {
          databaseQueries.push({
            queryName: 'secondary',
            queryText: result.prompt.metadata.databaseQuery2
          });
        }
        
        // Execute queries if option is enabled
        if (mergedOptions.executeQueries) {
          for (const queryInfo of databaseQueries) {
            try {
              // Create parameters from metadata if needed
              const parameters: Record<string, any> = {};
              
              // If we have relationships, add first relationship's ID as script_id parameter
              if (result.relationships.length > 0 && queryInfo.queryText.includes(':script_id')) {
                const scriptId = result.relationships[0].asset_id || result.relationships[0].id;
                parameters.script_id = scriptId;
              }
              
              // Execute the query
              const queryResults = await this.executeQuery(queryInfo.queryText, parameters);
              
              // Add to results
              result.databaseQueries.push({
                queryName: queryInfo.queryName,
                queryText: queryInfo.queryText,
                queryResults
              });
              
              // Add query results to combined content
              combinedContent += `\n\n## Database Query Results - ${queryInfo.queryName}\n\n`;
              combinedContent += '```json\n';
              combinedContent += JSON.stringify(queryResults, null, 2);
              combinedContent += '\n```\n';
            } catch (queryError) {
              Logger.error(`Error executing query '${queryInfo.queryName}': ${queryError instanceof Error ? queryInfo.queryText : 'Unknown error'}`);
              
              // Add error to results
              result.databaseQueries.push({
                queryName: queryInfo.queryName,
                queryText: queryInfo.queryText,
                queryResults: { error: queryError instanceof Error ? queryError.message : 'Unknown error' }
              });
              
              // Add error to combined content
              combinedContent += `\n\n## Database Query Error - ${queryInfo.queryName}\n\n`;
              combinedContent += '```\n';
              combinedContent += `Error: ${queryError instanceof Error ? queryError.message : 'Unknown error'}\n`;
              combinedContent += 'Query: ' + queryInfo.queryText + '\n';
              combinedContent += '```\n';
            }
          }
        } else {
          // Just add queries without execution
          for (const queryInfo of databaseQueries) {
            result.databaseQueries.push({
              queryName: queryInfo.queryName,
              queryText: queryInfo.queryText,
              queryResults: null
            });
          }
        }
      }
      
      // Update combined content
      result.combinedContent = combinedContent;
      
      return result;
    } catch (error) {
      Logger.error(`Error loading prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Use a prompt with Claude to get a response
   */
  public async usePromptWithClaude<T = any>(
    promptName: string,
    userMessage: string,
    options: {
      expectJson?: boolean;
      claudeOptions?: any;
      promptOptions?: PromptLoadOptions;
    } = {}
  ): Promise<T | string> {
    try {
      // Set default options
      const mergedOptions = {
        expectJson: false,
        claudeOptions: {},
        promptOptions: {
          includeDatabaseQueries: true,
          includeRelationships: true,
          includeRelatedFiles: true,
          executeQueries: true
        },
        ...options
      };
      
      // Load the prompt with all context
      const promptResult = await this.loadPrompt(promptName, mergedOptions.promptOptions);
      
      if (!promptResult.prompt) {
        throw new Error(`Prompt '${promptName}' not found`);
      }
      
      // Use the combined content as the system message
      mergedOptions.claudeOptions.system = promptResult.combinedContent;
      
      // Get response from Claude
      if (mergedOptions.expectJson) {
        return await claudeService.getJsonResponse<T>(userMessage, mergedOptions.claudeOptions);
      } else {
        return await claudeService.sendPrompt(userMessage, mergedOptions.claudeOptions);
      }
    } catch (error) {
      Logger.error(`Error using prompt with Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Write results to a markdown file in the docs/cli-pipeline directory
   */
  public async writeResultsToMarkdown(fileName: string, content: string): Promise<string> {
    try {
      // Use docs/cli-pipeline directory for output files
      const outDir = path.join(process.cwd(), 'docs', 'cli-pipeline');
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outDir)) {
        Logger.debug(`Creating output directory at ${outDir}`);
        fs.mkdirSync(outDir, { recursive: true });
      }
      
      const filePath = path.join(outDir, fileName);
      fs.writeFileSync(filePath, content, 'utf8');
      Logger.debug(`Results saved to: ${filePath}`);
      
      return filePath;
    } catch (error) {
      Logger.error(`Error writing to markdown file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Export a prompt load result to markdown
   */
  public formatPromptResultAsMarkdown(
    promptName: string,
    result: PromptLoadResult
  ): string {
    const lines: string[] = [];
    
    // Add header
    lines.push(`# Prompt: ${promptName}`);
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    // Add prompt details
    if (result.prompt) {
      lines.push('## Prompt Details');
      lines.push('');
      lines.push(`- **Name**: ${result.prompt.name}`);
      lines.push(`- **ID**: ${result.prompt.id}`);
      if (result.prompt.description) {
        lines.push(`- **Description**: ${result.prompt.description}`);
      }
      lines.push(`- **Created**: ${new Date(result.prompt.created_at).toLocaleString()}`);
      lines.push(`- **Updated**: ${new Date(result.prompt.updated_at).toLocaleString()}`);
      lines.push('');
      
      // Add prompt content
      lines.push('## Prompt Content');
      lines.push('');
      lines.push('```');
      lines.push(result.prompt.content);
      lines.push('```');
      lines.push('');
    }
    
    // Add metadata if available
    if (result.prompt?.metadata) {
      lines.push('## Metadata');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(result.prompt.metadata, null, 2));
      lines.push('```');
      lines.push('');
    }
    
    // Add relationships
    if (result.relationships.length > 0) {
      lines.push(`## Relationships (${result.relationships.length})`);
      lines.push('');
      
      for (const rel of result.relationships) {
        lines.push(`### ${rel.relationship_type} - ${path.basename(rel.asset_path)}`);
        lines.push('');
        lines.push(`- **ID**: ${rel.id}`);
        lines.push(`- **Asset Path**: ${rel.asset_path}`);
        if (rel.relationship_context) {
          lines.push(`- **Context**: ${rel.relationship_context}`);
        }
        lines.push('');
      }
    }
    
    // Add related files
    if (result.relatedFiles.length > 0) {
      lines.push(`## Related Files (${result.relatedFiles.length})`);
      lines.push('');
      
      for (const fileInfo of result.relatedFiles) {
        const stats = fileInfo.stats ? ` (${fileInfo.stats.lines} lines, ${fileInfo.stats.size} bytes)` : '';
        lines.push(`### ${fileInfo.relationship.relationship_type} - ${path.basename(fileInfo.relationship.asset_path)}${stats}`);
        lines.push('');
        lines.push('```');
        lines.push(fileInfo.content);
        lines.push('```');
        lines.push('');
      }
    }
    
    // Add database queries
    if (result.databaseQueries.length > 0) {
      lines.push(`## Database Queries (${result.databaseQueries.length})`);
      lines.push('');
      
      for (const query of result.databaseQueries) {
        lines.push(`### ${query.queryName} Query`);
        lines.push('');
        lines.push('```sql');
        lines.push(query.queryText);
        lines.push('```');
        lines.push('');
        
        if (query.queryResults) {
          lines.push('#### Results');
          lines.push('');
          lines.push('```json');
          lines.push(JSON.stringify(query.queryResults, null, 2));
          lines.push('```');
          lines.push('');
        }
      }
    }
    
    return lines.join('\n');
  }
}

// Export singleton instance
export const promptService = PromptService.getInstance();