import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface PromptQueryResult {
  prompt: Prompt | null;
  databaseQueryResults: any[] | null;
  error?: string;
}

/**
 * PromptQueryService - Shared utility for executing prompt database queries
 * 
 * This service extracts the query execution logic from prompt-lookup.ts into a shared class
 * that can be used by multiple scripts. It handles special cases for document_types queries
 * and provides robust fallbacks for different query formats.
 */
export class PromptQueryService {
  private client: SupabaseClient;
  
  constructor(config: { url?: string; key?: string } = {}) {
    const url = config.url || process.env.SUPABASE_URL || '';
    const key = config.key || process.env.SUPABASE_SERVICE_KEY || '';
    
    if (!url || !key) {
      Logger.warn('PromptQueryService initialized with empty URL or key');
    }
    
    this.client = createClient(url, key);
    Logger.debug('PromptQueryService initialized');
  }
  
  /**
   * Get a prompt by name
   * @param promptName The name of the prompt to look up
   * @returns The prompt object or null if not found
   */
  async getPromptByName(promptName: string): Promise<Prompt | null> {
    try {
      Logger.debug(`Getting prompt by name: ${promptName}`);
      
      const { data, error } = await this.client
        .from('prompts')
        .select('*')
        .eq('name', promptName)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          Logger.warn(`No prompt found with name: ${promptName}`);
          return null;
        }
        
        Logger.error(`Error fetching prompt: ${error.message}`);
        throw new Error(`Failed to get prompt by name: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      Logger.error(`Error in getPromptByName: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Get relationships for a prompt
   * @param promptId The ID of the prompt
   * @returns Array of relationships
   */
  async getRelationshipsByPromptId(promptId: string): Promise<any[]> {
    try {
      Logger.debug(`Getting relationships for prompt ID: ${promptId}`);
      
      const { data, error } = await this.client
        .from('prompt_relationships')
        .select('*')
        .eq('prompt_id', promptId);
      
      if (error) {
        Logger.error(`Error fetching relationships: ${error.message}`);
        return [];
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Error in getRelationshipsByPromptId: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Execute a database query from prompt metadata
   * This is the core function extracted from prompt-lookup.ts
   * 
   * @param queryText The SQL query text to execute
   * @returns Query results or null if the query fails
   */
  async executeQuery(queryText: string): Promise<any[] | null> {
    try {
      Logger.debug(`Executing query: ${queryText}`);
      
      // Special handling for document_types with Documentation category
      if (queryText.includes("document_types") && 
          (queryText.includes("category = \"Documentation\"") || 
           queryText.includes("category = 'Documentation'"))) {
        
        Logger.debug("Detected Documentation category query - using direct table access");
        
        try {
          const { data, error } = await this.client
            .from('document_types')
            .select('*')
            .eq('category', 'Documentation');
            
          if (error) {
            Logger.error(`Failed to query document_types: ${error.message}`);
            throw error;
          }
          
          Logger.debug(`Found ${data?.length || 0} document types with category=Documentation`);
          return data || [];
        } catch (error) {
          Logger.error(`Error in document_types query: ${error instanceof Error ? error.message : 'Unknown error'}`);
          throw error;
        }
      }
      
      // Handle IN queries for multiple categories
      const inClauseMatch = queryText.match(/category\s+IN\s*\(([^)]+)\)/i);
      if (inClauseMatch && inClauseMatch[1]) {
        // Extract all quoted categories from within the parentheses
        const categoryValues: string[] = [];
        const categoryMatches = inClauseMatch[1].match(/['"]([^'"]+)['"]/g);
        
        if (categoryMatches) {
          categoryMatches.forEach((match: string) => {
            // Remove the quotes to get just the category value
            const value = match.replace(/^['"]|['"]$/g, '');
            if (value) categoryValues.push(value);
          });
        }
        
        // Alternative approach using split and map for more reliable extraction
        if (categoryValues.length === 0 || categoryValues.length < 4) {
          const cleanedInClause = inClauseMatch[1].trim();
          const alternativeCategories = cleanedInClause
            .split(',')
            .map((part: string) => part.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
          
          if (alternativeCategories.length > 0) {
            Logger.debug(`Using alternative extraction method, found: ${alternativeCategories.join(', ')}`);
            categoryValues.length = 0; // Clear existing array
            categoryValues.push(...alternativeCategories);
          }
        }
        
        // If we found categories, execute the query using the in() method
        if (categoryValues.length > 0) {
          Logger.debug(`Detected IN query with categories: ${categoryValues.join(', ')}`);
          
          try {
            const { data, error } = await this.client
              .from('document_types')
              .select('*')
              .in('category', categoryValues);
              
            if (error) {
              Logger.error(`Failed to query document_types with categories: ${error.message}`);
              throw error;
            }
            
            Logger.debug(`Found ${data?.length || 0} records with specified categories`);
            return data || [];
          } catch (error) {
            Logger.error(`Error in document_types IN query: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
          }
        }
      }
      
      // Try with single quotes instead of double quotes
      if (queryText.includes("\"")) {
        const singleQuoteQuery = queryText.replace(/(\w+\s*=\s*)"([^"]+)"/g, "$1'$2'");
        Logger.debug(`Trying with SQL-compatible single quotes: ${singleQuoteQuery}`);
        
        try {
          const { data, error } = await this.client.rpc('execute_sql', { sql: singleQuoteQuery });
          
          if (!error) {
            Logger.debug("Query execution successful via RPC with modified quotes");
            return data || [];
          }
          
          Logger.warn(`Modified quote RPC execute_sql failed: ${error.message}`);
        } catch (rpcError) {
          Logger.warn(`Modified quote RPC method error: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
        }
      }
      
      // Try standard RPCs for other queries with original syntax
      try {
        const { data, error } = await this.client.rpc('execute_sql', { sql: queryText });
        
        if (!error) {
          Logger.debug("Query execution successful via RPC");
          return data || [];
        }
        
        Logger.warn(`RPC execute_sql failed: ${error.message}`);
      } catch (rpcError) {
        Logger.warn(`RPC method not available: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
      }
      
      // Last resort - try to parse and execute a simple query directly
      Logger.debug("Attempting to execute a simple direct query as last resort");
      try {
        // Try a simple query for document_types
        const { data, error } = await this.client.from('document_types').select('*').limit(50);
        
        if (!error && data && data.length > 0) {
          Logger.debug(`Found ${data.length} document types with direct query fallback`);
          return data;
        }
      } catch (directError) {
        Logger.error(`Direct query failed: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
      }
      
      Logger.error("All query execution methods failed");
      return null;
    } catch (error) {
      Logger.error(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Complete workflow for getting a prompt with its query results
   * @param promptName The name of the prompt to look up
   * @returns The prompt data and the results of any database query in its metadata
   */
  async getPromptWithQueryResults(promptName: string): Promise<PromptQueryResult> {
    try {
      Logger.debug(`Getting prompt '${promptName}' with query execution...`);
      
      // Step 1: Find prompt by name
      const prompt = await this.getPromptByName(promptName);
      
      if (!prompt) {
        return {
          prompt: null,
          databaseQueryResults: null,
          error: `Prompt '${promptName}' not found`
        };
      }
      
      Logger.debug(`Found prompt '${promptName}' in database`);
      
      // Step 2: Check for database query in metadata and execute it
      if (!prompt.metadata) {
        return {
          prompt,
          databaseQueryResults: null
        };
      }
      
      // Check for database query in either field
      const queryText = prompt.metadata.database_query || prompt.metadata.databaseQuery;
      
      if (!queryText) {
        return {
          prompt,
          databaseQueryResults: null
        };
      }
      
      Logger.debug(`Found database query in prompt metadata: ${queryText}`);
      
      // Step 3: Execute the query
      const queryResults = await this.executeQuery(queryText);
      
      // Return the results
      return {
        prompt,
        databaseQueryResults: queryResults
      };
    } catch (error) {
      Logger.error(`Error in getPromptWithQueryResults: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        prompt: null,
        databaseQueryResults: null,
        error: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}