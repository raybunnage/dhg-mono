import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FileService } from '../../packages/cli/src/services/file-service';
import config from '../../packages/cli/src/utils/config';
import { Logger } from '../../packages/cli/src/utils/logger';
import path from 'path';
import fs from 'fs';

// Create minimal versions of the types we need
interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

interface Relationship {
  id: string;
  prompt_id: string;
  asset_path: string;
  document_type_id?: string;
  relationship_type: string;
  relationship_context?: string;
  created_at: string;
  updated_at: string;
}

// Create a simplified SupabaseService
class SimpleSupabaseService {
  private client: SupabaseClient;
  
  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }
  
  async getPromptByName(name: string): Promise<Prompt | null> {
    Logger.debug(`Getting prompt by name: ${name}`);
    
    const { data, error } = await this.client
      .from('prompts')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(1);
    
    if (error) {
      Logger.error(`Failed to get prompt by name: ${error.message}`);
      throw new Error(`Failed to get prompt by name: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      Logger.warn(`No prompt found with name: ${name}`);
      return null;
    }
    
    Logger.debug(`Found prompt: ${data[0].name}`);
    return data[0] as Prompt;
  }
  
  async getRelationshipsByPromptId(promptId: string): Promise<Relationship[]> {
    Logger.debug(`Getting relationships for prompt ID: ${promptId}`);
    
    const { data, error } = await this.client
      .from('prompt_relationships')
      .select('*')
      .eq('prompt_id', promptId);
    
    if (error) {
      Logger.error(`Failed to get relationships for prompt: ${error.message}`);
      throw new Error(`Failed to get relationships for prompt: ${error.message}`);
    }
    
    Logger.debug(`Found ${data?.length || 0} relationships for prompt ID: ${promptId}`);
    return data as Relationship[] || [];
  }
  
  async executeCustomQuery(queryText: string): Promise<any> {
    try {
      // Use RPC if available
      const { data, error } = await this.client.rpc('execute_query', { query_text: queryText });
      
      if (error) {
        // Fallback to raw query if RPC fails
        Logger.warn(`RPC failed, trying direct query: ${error.message}`);
        const { data: directData, error: directError } = await this.client.from('custom_queries')
          .select('*')
          .eq('query_text', queryText)
          .single();
        
        if (directError) {
          throw new Error(`Failed to execute query: ${directError.message}`);
        }
        
        return directData;
      }
      
      return data;
    } catch (error) {
      Logger.error(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}

/**
 * Lookup a prompt by name and fetch its content, relationships, and related files
 * @param promptName The name of the prompt to look up
 */
async function lookupPrompt(promptName: string) {
  try {
    // Initialize services
    const supabaseService = new SimpleSupabaseService(config.supabaseUrl, config.supabaseKey);
    const fileService = new FileService();
    
    // Step 1: Find the prompt by name
    Logger.info(`Looking up prompt: ${promptName}`);
    const prompt = await supabaseService.getPromptByName(promptName);
    
    if (!prompt) {
      Logger.error(`Prompt not found: ${promptName}`);
      return;
    }
    
    console.log('\n=== PROMPT DETAILS ===');
    console.log(`ID: ${prompt.id}`);
    console.log(`Name: ${prompt.name}`);
    console.log(`Description: ${prompt.description || 'No description'}`);
    console.log(`Created: ${new Date(prompt.created_at).toLocaleString()}`);
    console.log(`Updated: ${new Date(prompt.updated_at).toLocaleString()}`);
    
    // Step 2: Get prompt relationships
    const relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
    
    console.log(`\n=== RELATIONSHIPS (${relationships.length}) ===`);
    if (relationships.length === 0) {
      console.log('No relationships found');
    } else {
      for (const rel of relationships) {
        console.log(`\nRelationship ID: ${rel.id}`);
        console.log(`Type: ${rel.relationship_type}`);
        console.log(`Asset Path: ${rel.asset_path}`);
        console.log(`Context: ${rel.relationship_context || 'No context'}`);
        
        // Try to read the related file
        const fileResult = fileService.readFile(rel.asset_path);
        if (fileResult.success) {
          console.log(`File Content (${fileResult.stats?.lines} lines, ${fileResult.stats?.size} bytes):`);
          console.log('---');
          console.log(fileResult.content?.substring(0, 500) + (fileResult.content && fileResult.content.length > 500 ? '...' : ''));
          console.log('---');
        } else {
          console.log(`Could not read file: ${fileResult.error}`);
        }
      }
    }
    
    // Step 3: Read the prompt file from disk
    // Try to locate the prompt file in the prompts directory
    const possiblePromptPaths = [
      // Try with .md extension
      path.resolve(process.cwd(), 'prompts', `${promptName}.md`),
      // Try without extension
      path.resolve(process.cwd(), 'prompts', promptName),
      // Try in root directory
      path.resolve(process.cwd(), promptName),
    ];
    
    let promptFileContent: string | null = null;
    let promptFilePath: string | null = null;
    
    for (const filePath of possiblePromptPaths) {
      if (fs.existsSync(filePath)) {
        promptFilePath = filePath;
        const fileResult = fileService.readFile(filePath);
        if (fileResult.success) {
          promptFileContent = fileResult.content || null;
          break;
        }
      }
    }
    
    console.log('\n=== PROMPT FILE ===');
    if (promptFileContent) {
      console.log(`File: ${promptFilePath}`);
      console.log('---');
      console.log(promptFileContent);
      console.log('---');
    } else {
      console.log(`Could not find or read prompt file for: ${promptName}`);
    }
    
    // Step 4: Check for database query in metadata and execute it
    if (prompt.metadata) {
      console.log('\n=== PROMPT METADATA ===');
      console.log(JSON.stringify(prompt.metadata, null, 2));
      
      // If there's a database query in the metadata, execute it
      if (prompt.metadata.database_query) {
        console.log('\n=== DATABASE QUERY RESULTS ===');
        try {
          // Execute the query from metadata
          const data = await supabaseService.executeCustomQuery(prompt.metadata.database_query);
          console.log(JSON.stringify(data, null, 2));
        } catch (error) {
          console.log(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
  } catch (error) {
    Logger.error('Error looking up prompt:', error);
  }
}

// Run the function with the provided prompt name or default to "script-analysis-prompt"
const promptName = process.argv[2] || 'script-analysis-prompt';
lookupPrompt(promptName)
  .then(() => console.log('Prompt lookup complete'))
  .catch(err => {
    Logger.error('Fatal error:', err);
    process.exit(1);
  });