import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FileService, FileResult } from '../../packages/cli/src/services/file-service';
import config from '../../packages/cli/src/utils/config';
import { Logger } from '../../packages/cli/src/utils/logger';
import path from 'path';
import fs from 'fs';

// Helper function to write results to a markdown file
async function writeResultsToMarkdown(fileName: string, content: string): Promise<boolean> {
  try {
    const docsDir = path.join(process.cwd(), 'docs');
    
    // Create docs directory if it doesn't exist
    if (!fs.existsSync(docsDir)) {
      console.log(`Creating docs directory at ${docsDir}`);
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const filePath = path.join(docsDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\nResults saved to: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error writing to markdown file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

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
      
      // Replace double quotes with single quotes for SQL compatibility
      // Note: This is a simple replacement that might not handle all SQL edge cases
      let normalizedQuery = queryText;
      if (queryText.includes("\"")) {
        // Only process if we detect double quotes
        console.log("Converting double quotes to single quotes for SQL compatibility");
        
        // First replace double-quoted column identifiers with temporary placeholders 
        // We'll only convert string literals with double quotes to single quotes
        normalizedQuery = queryText.replace(/("[\w\s]+")(\s*=\s*)/g, (match, p1, p2) => {
          // Keep identifiers as is, but add a note about them
          console.log(`Found possible column reference: ${p1}`);
          return `${p1}${p2}`;
        });
        
        // Then convert string literals (values in WHERE clauses)
        normalizedQuery = normalizedQuery.replace(/(\w+\s*=\s*)"([^"]+)"/g, "$1'$2'");
        console.log(`Normalized query: ${normalizedQuery}`);
      }
      
      // Check for specific known queries and handle them directly
      if (normalizedQuery.includes("FROM document_types WHERE category") || 
          queryText.includes("FROM document_types WHERE category")) {
        console.log("Detected document_types query - using direct table access");
        
        try {
          // For more consistent results, we'll use a direct query to get all document types
          // and then filter them in-memory if needed
          
          // First get all document types to see the total count
          const { data: allData, error: allError } = await this.client
            .from('document_types')
            .select('*')
            .order('category');
            
          if (allError) {
            throw new Error(`Failed to query all document_types: ${allError.message}`);
          }
          
          console.log(`Total document_types in database: ${allData?.length || 0}`);
          
          // Log the first few document types to debug
          if (allData && allData.length > 0) {
            console.log("Sample document types:");
            for (let i = 0; i < Math.min(3, allData.length); i++) {
              console.log(`- ${i+1}: ${allData[i].document_type} (category: ${allData[i].category})`);
            }
            
            // Log all categories for reference
            const categories = [...new Set(allData.map(dt => dt.category))];
            console.log(`Available categories: ${categories.join(', ')}`);
          }
          
          // Check for specific query patterns we know about
          let categories: string[] = [];
          let useDirectEquality = false;
          
          // Log all document_types that exist in the database to help debugging
          console.log("\n=== Document Types By Category in Database ===");
          
          const categoryGroups: Record<string, any[]> = {};
          allData.forEach(item => {
            if (!categoryGroups[item.category]) {
              categoryGroups[item.category] = [];
            }
            categoryGroups[item.category].push({
              id: item.id,
              document_type: item.document_type
            });
          });
          
          Object.keys(categoryGroups).sort().forEach(category => {
            console.log(`\nCategory: ${category}`);
            categoryGroups[category].forEach(item => {
              console.log(`- ${item.document_type} (${item.id})`);
            });
          });
          
          // The query might use double quotes (JSON format) or single quotes (SQL format)
          // Special case for Documentation category
          if (queryText.includes("category = \"Documentation\"") || queryText.includes("category = 'Documentation'")) {
            console.log("Detected Documentation category query");
            categories = ["Documentation"];
            useDirectEquality = true;
          } 
          // Otherwise, try to extract categories with regex
          else {
            // Try the IN pattern first
            let categoryMatch = queryText.match(/IN\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])*\s*\)/i);
          
          // If we didn't find an IN pattern, check for equality pattern (category = 'X')
          if (!categoryMatch) {
            // Look for category = "X" or category = 'X' or category = X pattern (with or without quotes)
            // Try with quotes (both double and single)
            let equalityMatch = queryText.match(/category\s*=\s*['"]([^'"]+)['"]/i);
            
            // If not found, try without quotes
            if (!equalityMatch) {
              equalityMatch = queryText.match(/category\s*=\s*([^\s;]+)/i);
            }
            if (equalityMatch && equalityMatch[1]) {
              categories = [equalityMatch[1]];
              useDirectEquality = true;
              console.log(`Found equality match for category: ${equalityMatch[1]}`);
            } else {
              console.log("Could not parse category from query, returning all document types");
              return allData;
            }
          } else {
            // Process IN pattern - get all the categories from capture groups
            for (let i = 1; i < categoryMatch.length; i++) {
              if (categoryMatch[i]) {
                categories.push(categoryMatch[i]);
              }
            }
          }
          }
          
          // Log all categories found in the database
          const allCategories = [...new Set(allData.map(item => item.category))];
          console.log(`All categories in database: ${allCategories.join(', ')}`);
          console.log(`Filtering for categories: ${categories.join(', ')}`);
          
          // Execute a direct query based on the pattern found
          let queryBuilder = this.client.from('document_types').select('*');
          
          if (useDirectEquality && categories.length === 1) {
            // Use eq for single category (category = 'X')
            queryBuilder = queryBuilder.eq('category', categories[0]);
          } else if (categories.length > 0) {
            // Use in for multiple categories (category IN ('X', 'Y'))
            queryBuilder = queryBuilder.in('category', categories);
          }
          
          const { data, error } = await queryBuilder;
            
          if (error) {
            throw new Error(`Failed to query document_types: ${error.message}`);
          }
          
          // Compare the counts to help with troubleshooting
          console.log(`Found ${data?.length || 0} records out of ${allData?.length || 0} total document types`);
          
          return data;
        } catch (error) {
          console.log(`Error in document_types query: ${error instanceof Error ? error.message : 'Unknown error'}`);
          throw error;
        }
      }
      
      // For document_types query with double quotes, attempt a direct query approach  
      if (queryText.includes("document_types") && queryText.includes("\"Documentation\"")) {
        console.log("Attempting direct query for Documentation category");
        try {
          const { data, error } = await this.client
            .from('document_types')
            .select('*')
            .eq('category', 'Documentation');
            
          if (error) {
            console.log(`Direct query failed: ${error.message}`);
          } else {
            console.log(`Direct query successful, found ${data?.length || 0} records`);
            return data;
          }
        } catch (directError) {
          console.log(`Error in direct query: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
        }
      }
      
      // Try with single quotes instead of double quotes
      if (queryText.includes("\"")) {
        const singleQuoteQuery = queryText.replace(/(\w+\s*=\s*)"([^"]+)"/g, "$1'$2'");
        console.log(`Trying with SQL-compatible single quotes: ${singleQuoteQuery}`);
        
        try {
          const { data, error } = await this.client.rpc('execute_sql', { sql: singleQuoteQuery });
          
          if (!error) {
            console.log("Query execution successful via RPC with modified quotes");
            return data;
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
          console.log("Query execution successful via RPC");
          return data;
        }
        
        Logger.warn(`RPC execute_sql failed: ${error.message}`);
      } catch (rpcError) {
        Logger.warn(`RPC method not available: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
      }
      
      // Last resort: check for specific known queries and handle them natively
      if (queryText.includes("document_types") && queryText.includes("Documentation")) {
        console.log("Last resort: Using direct document_types query for Documentation category");
        try {
          const { data, error } = await this.client
            .from('document_types')
            .select('*')
            .eq('category', 'Documentation');
            
          if (error) {
            console.log(`Last resort query failed: ${error.message}`);
          } else {
            console.log(`Last resort query successful, found ${data?.length || 0} records`);
            return data;
          }
        } catch (lastError) {
          console.log(`Error in last resort query: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
        }
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
 * @param outputToMarkdown Whether to output results to a markdown file
 */
async function lookupPrompt(promptName: string, outputToMarkdown: boolean = false) {
  // Create a results array to collect all output
  const results: string[] = [];
  
  // Override console.log to capture output to our results array
  const originalConsoleLog = console.log;
  if (outputToMarkdown) {
    console.log = (...args) => {
      // Still output to the console
      originalConsoleLog(...args);
      // Capture the output to our results array
      results.push(args.join(' '));
    };
  }
  
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
    
    // We're now using the prompt content from the database instead of reading the file from disk
    // The prompt.content field is the source of truth
    
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
          
          // Add count of records returned to help with troubleshooting
          const recordCount = Array.isArray(data) ? data.length : 1;
          console.log(`Records found: ${recordCount}`);
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
  } finally {
    // Restore original console.log
    if (outputToMarkdown) {
      console.log = originalConsoleLog;
      
      // Generate markdown content
      const markdownContent = `# Prompt Lookup: ${promptName}

Generated: ${new Date().toISOString()}

${results.join('\n')}
`;
      
      // Write results to markdown file
      const fileName = `prompt-lookup-${promptName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
      await writeResultsToMarkdown(fileName, markdownContent);
    }
  }
}

// Run the function with the provided prompt name or default to "script-analysis-prompt"
const promptName = process.argv[2] || 'script-analysis-prompt';
// Always output to markdown file
const outputToMarkdown = true;

lookupPrompt(promptName, outputToMarkdown)
  .then(() => console.log('Prompt lookup complete'))
  .catch(err => {
    Logger.error('Fatal error:', err);
    process.exit(1);
  });