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
      console.log(`Executing query: ${queryText}`);
      
      // Check for specific known queries and handle them directly
      if (queryText.includes("FROM document_types WHERE category IN")) {
        console.log("Detected document_types query - using direct table access");
        
        // Extract the categories from the query using regex
        const categoryMatch = queryText.match(/IN\s*\(\s*'([^']+)'(?:\s*,\s*'([^']+)')*\s*\)/i);
        
        if (!categoryMatch) {
          throw new Error("Could not parse categories from query");
        }
        
        // Get all the categories - first match is the full string, subsequent ones are capture groups
        const categories: string[] = [];
        for (let i = 1; i < categoryMatch.length; i++) {
          if (categoryMatch[i]) {
            categories.push(categoryMatch[i]);
          }
        }
        
        console.log(`Querying document_types table for categories: ${categories.join(', ')}`);
        
        // Execute a direct query on the document_types table
        const { data, error } = await this.client
          .from('document_types')
          .select('*')
          .in('category', categories);
          
        if (error) {
          throw new Error(`Failed to query document_types: ${error.message}`);
        }
        
        return data;
      }
      
      // Try standard RPCs for other queries
      try {
        const { data, error } = await this.client.rpc('execute_sql', { sql: queryText });
        
        if (!error) {
          console.log("Query execution successful via RPC");
          return data;
        }
        
        Logger.warn(`RPC execute_sql failed: ${error.message}`);
      } catch (rpcError) {
        Logger.warn(`RPC method not available: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
      }
      
      throw new Error("No method available to execute this query directly");
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
    // Hardcode Supabase URL and key for testing since config might not be loading properly
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-id.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    // Debug configuration
    console.log('Current configuration:');
    console.log(`- Using Supabase URL: ${supabaseUrl.replace(/^(https?:\/\/[^\/]+).*$/, '$1...')}`);
    console.log(`- Using Supabase Key: ${supabaseKey ? supabaseKey.substring(0, 5) + '...' : 'Not set'}`);
    
    // Initialize services
    const supabaseService = new SimpleSupabaseService(supabaseUrl, supabaseKey);
    const fileService = new FileService();
    
    // Step 1: Find the prompt by name
    Logger.info(`Looking up prompt: ${promptName}`);
    
    let prompt: Prompt | null = null;
    
    try {
      prompt = await supabaseService.getPromptByName(promptName);
      if (prompt) {
        console.log('\n=== PROMPT DETAILS FROM DATABASE ===');
        console.log(`ID: ${prompt.id}`);
        console.log(`Name: ${prompt.name}`);
        console.log(`Description: ${prompt.description || 'No description'}`);
        console.log(`Created: ${new Date(prompt.created_at).toLocaleString()}`);
        console.log(`Updated: ${new Date(prompt.updated_at).toLocaleString()}`);
        
        // Display the full prompt content from the database
        console.log('\n=== PROMPT CONTENT FROM DATABASE ===');
        console.log(prompt.content || 'No content available in the database');
      } else {
        console.log(`No prompt found in database with name: ${promptName}`);
      }
    } catch (error) {
      console.log(`Error accessing database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log("Will attempt to read prompt file from disk only.");
    }
    
    // Step 2: Get prompt relationships (if we have database access)
    let relationships: Relationship[] = [];
    
    if (prompt && prompt.id) {
      try {
        relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
        
        console.log(`\n=== RELATIONSHIPS (${relationships.length}) ===`);
        if (relationships.length === 0) {
          console.log('No relationships found in database');
        } else {
          for (const rel of relationships) {
            console.log(`\nRelationship ID: ${rel.id}`);
            console.log(`Type: ${rel.relationship_type}`);
            console.log(`Asset Path: ${rel.asset_path}`);
            console.log(`Context: ${rel.relationship_context || 'No context'}`);
            
            // Try to read the related file
            try {
              const fileResult = fileService.readFile(rel.asset_path);
              if (fileResult.success) {
                console.log(`File Content (${fileResult.stats?.lines} lines, ${fileResult.stats?.size} bytes):`);
                console.log('---');
                // Display the full file content instead of truncating
                console.log(fileResult.content || '');
                console.log('---');
              } else {
                console.log(`Could not read file: ${fileResult.error}`);
              }
            } catch (fileError) {
              console.log(`Error reading file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
            }
          }
        }
      } catch (error) {
        console.log(`Error fetching relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('\n=== RELATIONSHIPS ===');
      console.log('Cannot fetch relationships without database access or prompt ID');
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
    if (prompt && prompt.metadata) {
      console.log('\n=== PROMPT METADATA ===');
      console.log(JSON.stringify(prompt.metadata, null, 2));
      
      // If there's a database query in the metadata, execute it
      if (prompt.metadata.database_query || prompt.metadata.databaseQuery) {
        console.log('\n=== DATABASE QUERY RESULTS ===');
        try {
          // Get the query from either field name
          const queryText = prompt.metadata.database_query || prompt.metadata.databaseQuery;
          console.log(`Query: ${queryText}`);
          
          // Execute the query from metadata
          const data = await supabaseService.executeCustomQuery(queryText);
          console.log(JSON.stringify(data, null, 2));
        } catch (error) {
          console.log(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log('Database query could not be executed due to connection issues.');
        }
      }
      
      // Step 5: Process package.json files referenced in metadata
      if (prompt.metadata.packageJsonFiles && Array.isArray(prompt.metadata.packageJsonFiles)) {
        console.log('\n=== PACKAGE.JSON FILES ===');
        
        // Process each package.json file
        for (const pkgFile of prompt.metadata.packageJsonFiles) {
          if (pkgFile && pkgFile.path) {
            console.log(`\nPackage.json: ${pkgFile.path}`);
            console.log(`Title: ${pkgFile.title || 'No title'}`);
            console.log(`Context: ${pkgFile.context || 'No context'}`);
            
            try {
              // Path might start with / indicating repo root, or might be a relative path
              const filePath = pkgFile.path.startsWith('/') 
                ? path.join(process.cwd(), pkgFile.path) 
                : path.resolve(process.cwd(), pkgFile.path);
              
              // Read the package.json file
              const fileResult = fileService.readFile(filePath);
              
              if (fileResult.success) {
                console.log(`File Content (${fileResult.stats?.lines} lines, ${fileResult.stats?.size} bytes):`);
                console.log('---');
                console.log(fileResult.content || '');
                console.log('---');
              } else {
                // Try alternative locations if first attempt fails
                const alternativePaths = [
                  // Remove leading slash
                  path.join(process.cwd(), pkgFile.path.replace(/^\//, '')),
                  // Check in root
                  path.join(process.cwd(), 'package.json'),
                  // Check in apps directory with specific app
                  pkgFile.path.includes('dhg-improve-experts') 
                    ? path.join(process.cwd(), 'apps/dhg-improve-experts/package.json')
                    : null
                ].filter(Boolean) as string[];
                
                let found = false;
                for (const altPath of alternativePaths) {
                  const altResult = fileService.readFile(altPath);
                  if (altResult.success) {
                    console.log(`File found at alternative location: ${altPath}`);
                    console.log(`Content (${altResult.stats?.lines} lines, ${altResult.stats?.size} bytes):`);
                    console.log('---');
                    console.log(altResult.content || '');
                    console.log('---');
                    found = true;
                    break;
                  }
                }
                
                if (!found) {
                  console.log(`Could not read file: ${fileResult.error}`);
                  console.log(`Tried alternative paths: ${alternativePaths.join(', ')}`);
                }
              }
            } catch (fileError) {
              console.log(`Error reading package.json: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
            }
          }
        }
      }
    } else {
      console.log('\n=== PROMPT METADATA ===');
      console.log('No metadata available (no database access)');
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