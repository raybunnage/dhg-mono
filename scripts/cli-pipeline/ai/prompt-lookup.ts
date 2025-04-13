import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FileService, FileResult } from '../../packages/shared/services/file-service/file-service';
import { SupabaseService } from '../../packages/shared/services/supabase-service/supabase-service';
import config from '../../packages/shared/utils/config';
import { Logger } from '../../packages/shared/utils/logger';
import path from 'path';
import fs from 'fs';

// Helper function to write results to a markdown file
async function writeResultsToMarkdown(fileName: string, content: string): Promise<boolean> {
  try {
    // Use docs/cli-pipeline directory for output files
    const outDir = path.join(process.cwd(), 'docs', 'cli-pipeline');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outDir)) {
      console.log(`Creating output directory at ${outDir}`);
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    const filePath = path.join(outDir, fileName);
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
  asset_id?: string;     // Add asset_id property
  asset_path: string;
  document_type_id?: string;
  relationship_type: string;
  relationship_context?: string;
  created_at: string;
  updated_at: string;
}

// Use a standalone class specifically for executing custom queries that aren't in the SupabaseService
class CustomQueryExecutor {
  public client: SupabaseClient;
  
  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }
  
  async executeCustomQuery(queryText: string): Promise<any> {
    try {
      // Remove trailing semicolons which cause syntax errors in RPC calls
      queryText = queryText.trim().replace(/;+$/, '');
      
      // Debug the query format
      console.log(`Executing query: ${queryText}`);
      
      // Check if the query contains an unquoted UUID (common issue with parameter substitution)
      const uuidPattern = /WHERE\s+\w+\s*=\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*(?:;|$|AND|OR)/i;
      if (uuidPattern.test(queryText)) {
        console.log("WARNING: Query may contain an unquoted UUID. Adding quotes to prevent SQL error.");
        queryText = queryText.replace(uuidPattern, (match, uuid) => {
          return match.replace(uuid, `'${uuid}'`);
        });
        console.log(`Fixed query: ${queryText}`);
      }
      
      // Check for specific known queries and handle them directly
      if (queryText.includes("document_types")) {
        // Handle direct Documentation category query
        if (queryText.includes("category = \"Documentation\"") || 
            queryText.includes("category = 'Documentation'")) {
          console.log("Detected Documentation category query - using direct table access");
          
          try {
            // Execute a direct query for Documentation category
            const { data, error } = await this.client
              .from('document_types')
              .select('*')
              .eq('category', 'Documentation');
              
            if (error) {
              throw new Error(`Failed to query document_types with category=Documentation: ${error.message}`);
            }
            
            console.log(`Found ${data?.length || 0} records with category=Documentation`);
            return data;
          } catch (error) {
            console.log(`Error in document_types query: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
          }
        }
        
        // Handle IN queries for multiple categories
        // First, extract the entire IN clause
        const inClauseMatch = queryText.match(/category\s+IN\s*\(([^)]+)\)/i);
        if (inClauseMatch && inClauseMatch[1]) {
          // Extract all quoted categories from within the parentheses
          const categoryValues: string[] = [];
          const categoryMatches = inClauseMatch[1].match(/['"]([^'"]+)['"]/g);
          
          if (categoryMatches) {
            categoryMatches.forEach(match => {
              // Remove the quotes to get just the category value
              const value = match.replace(/^['"]|['"]$/g, '');
              if (value) categoryValues.push(value);
            });
          }
          
          // Log for debugging purposes
          console.log(`Raw IN clause: ${inClauseMatch[1]}`);
          console.log(`Extracted category matches: ${JSON.stringify(categoryMatches)}`);
          
          // Alternative approach using split and map for more reliable extraction
          if (categoryValues.length === 0 || categoryValues.length < 4) {
            const cleanedInClause = inClauseMatch[1].trim();
            const alternativeCategories = cleanedInClause
              .split(',')
              .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean);
            
            if (alternativeCategories.length > 0) {
              console.log(`Using alternative extraction method, found: ${alternativeCategories.join(', ')}`);
              categoryValues.length = 0; // Clear existing array
              categoryValues.push(...alternativeCategories);
            }
          }
          
          // If we still don't have categories, try the old approach as fallback
          if (categoryValues.length === 0) {
            const inMatch = queryText.match(/category\s+IN\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])*\s*\)/i);
            if (inMatch) {
              // Process all capture groups starting from index 1
              for (let i = 1; i < inMatch.length; i++) {
                if (inMatch[i]) {
                  categoryValues.push(inMatch[i]);
                }
              }
            }
          }
          
          // If we found categories, execute the query using the in() method
          if (categoryValues.length > 0) {
            console.log(`Detected IN query with categories: ${categoryValues.join(', ')}`);
            
            try {
              const { data, error } = await this.client
                .from('document_types')
                .select('*')
                .in('category', categoryValues);
                
              if (error) {
                throw new Error(`Failed to query document_types with categories: ${error.message}`);
              }
              
              console.log(`Found ${data?.length || 0} records with specified categories`);
              return data;
            } catch (error) {
              console.log(`Error in document_types IN query: ${error instanceof Error ? error.message : 'Unknown error'}`);
              throw error;
            }
          }
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
      originalConsoleLog(...args);
      results.push(args.join(' '));
    };
  }

  try {
    // Initialize services
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    // Initialize our services - we use SupabaseService for standard operations
    // and CustomQueryExecutor for the custom SQL queries
    const supabaseService = new SupabaseService(supabaseUrl, supabaseKey);
    const queryExecutor = new CustomQueryExecutor(supabaseUrl, supabaseKey);
    const fileService = new FileService();

    // Step 1: Find prompt by name
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
        
        // Try to find the prompt on disk
        try {
          console.log(`\nTrying to load prompt from disk...`);
          const promptFileDir = path.join(process.cwd(), 'prompts');
          const possiblePaths = [
            path.join(promptFileDir, `${promptName}.md`),
            path.join(promptFileDir, promptName),
            path.join(process.cwd(), promptName)
          ];
          
          let promptFilePath = null;
          let promptContent = null;
          
          for (const tryPath of possiblePaths) {
            if (fs.existsSync(tryPath)) {
              promptFilePath = tryPath;
              promptContent = fs.readFileSync(tryPath, 'utf8');
              break;
            }
          }
          
          if (promptContent) {
            console.log(`Found prompt file on disk: ${promptFilePath}`);
            console.log('\n=== PROMPT CONTENT FROM DISK ===');
            console.log(promptContent);
            
            // Try to extract metadata from the prompt file using front matter or <!-- --> comments
            const metadataMatch = promptContent.match(/<!--\s*([\s\S]*?)\s*-->/);
            if (metadataMatch && metadataMatch[1]) {
              try {
                const metadata = JSON.parse(metadataMatch[1]);
                
                // Create a prompt object from the file content
                prompt = {
                  id: 'local-file',
                  name: promptName,
                  content: promptContent,
                  description: 'Loaded from local file',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  metadata: metadata
                };
                
                console.log('\n=== METADATA FROM PROMPT FILE ===');
                console.log(JSON.stringify(metadata, null, 2));
              } catch (parseError) {
                console.log(`Error parsing metadata from prompt file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
              }
            } else {
              console.log('No metadata found in prompt file');
            }
          } else {
            console.log(`Could not find prompt file on disk. Tried: ${possiblePaths.join(', ')}`);
          }
        } catch (diskError) {
          console.log(`Error reading prompt from disk: ${diskError instanceof Error ? diskError.message : 'Unknown error'}`);
        }
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
          const data = await queryExecutor.executeCustomQuery(queryText);
          
          // Add count of records returned to help with troubleshooting
          const recordCount = Array.isArray(data) ? data.length : 1;
          console.log(`Records found: ${recordCount}`);
          console.log(JSON.stringify(data, null, 2));
        } catch (error) {
          console.log(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log('Database query could not be executed due to connection issues.');
        }
      }
      
      // If there's a second database query in the metadata, execute it
      if (prompt.metadata.databaseQuery2) {
        console.log('\n=== DATABASE QUERY2 RESULTS ===');
        try {
          // Get the second query
          let queryText = prompt.metadata.databaseQuery2;
          
          // Remove trailing semicolons which cause syntax errors in RPC calls
          queryText = queryText.trim().replace(/;+$/, '');
          
          console.log(`Query: ${queryText}`);
          
          // Check if we need to replace a parameter
          if (queryText.includes(":script_id")) {
            if (relationships && relationships.length > 0) {
              // Get the first relationship's asset ID or asset_path to use as script_id
              const scriptId = relationships[0].asset_id || relationships[0].id || relationships[0].asset_path.split('/').pop();
              console.log(`Replacing :script_id parameter with: ${scriptId}`);
              queryText = queryText.replace(/:script_id/g, `'${scriptId}'`);
              console.log(`Modified query: ${queryText}`);
            } else {
              console.log("Warning: :script_id parameter found but no relationships available for replacement");
              
              // Check if we have a sample script ID from the global context
              if ((global as any).sampleScriptId) {
                const scriptId = (global as any).sampleScriptId;
                console.log(`Using sample script ID from initialization: ${scriptId}`);
                
                // Always surround with single quotes to ensure proper SQL syntax
                let replacement = scriptId;
                if (!replacement.startsWith("'") && !replacement.endsWith("'")) {
                  replacement = `'${replacement}'`;
                }
                
                queryText = queryText.replace(/:script_id/g, replacement);
                console.log(`Modified query: ${queryText}`);
              } else {
                console.log("Attempting to find a script ID from the database...");
                
                // Try to extract the document ID from the file path if no relationships are available
                try {
                  // Query for any script ID in the database as a fallback
                  const { data, error } = await queryExecutor.client
                    .from('scripts')
                    .select('id, file_path')
                    .limit(1)
                    .single();
                    
                  if (data && data.id) {
                    console.log(`Found script ID ${data.id} from database lookup`);
                    // Always surround with single quotes to ensure proper SQL syntax
                    let replacement = data.id;
                    if (!replacement.startsWith("'") && !replacement.endsWith("'")) {
                      replacement = `'${replacement}'`;
                    }
                    
                    queryText = queryText.replace(/:script_id/g, replacement);
                    console.log(`Modified query: ${queryText}`);
                  } else {
                    console.log("No scripts found in the database");
                    console.log("Using fallback script ID to avoid query errors");
                    queryText = queryText.replace(/:script_id/g, "'00000000-0000-0000-0000-000000000000'");
                  }
                } catch (error) {
                  console.log(`Error finding script ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  console.log("Using fallback script ID to avoid query errors");
                  queryText = queryText.replace(/:script_id/g, "'00000000-0000-0000-0000-000000000000'");
                }
              }
            }
          }
          
          // Execute the second query from metadata
          const data = await queryExecutor.executeCustomQuery(queryText);
          
          // Add count of records returned to help with troubleshooting
          const recordCount = Array.isArray(data) ? data.length : 1;
          console.log(`Records found: ${recordCount}`);
          console.log(JSON.stringify(data, null, 2));
        } catch (error) {
          console.log(`Error executing second query: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log('Second database query could not be executed due to connection issues.');
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
                let found = false;
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
                
                for (const altPath of alternativePaths) {
                  try {
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
                  } catch (e) {
                    console.log(`Error reading alternative path ${altPath}: ${e instanceof Error ? e.message : 'Unknown error'}`);
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

// Function to load a sample script ID from the database
async function getSampleScriptId(supabaseClient: SupabaseClient): Promise<string | null> {
  try {
    console.log('Fetching a sample script ID from the database...');
    const { data, error } = await supabaseClient
      .from('scripts')
      .select('id, file_path')
      .limit(1)
      .single();
      
    if (error) {
      console.log(`Error fetching sample script: ${error.message}`);
      return null;
    }
    
    if (data && data.id) {
      console.log(`Found sample script: ID=${data.id}, Path=${data.file_path}`);
      return data.id;
    }
    
    console.log('No scripts found in the database');
    return null;
  } catch (error) {
    console.error(`Error getting sample script ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

// Main execution
async function main() {
  try {
    // Initialize Supabase client for sample script ID
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Get a sample script ID first
    const sampleScriptId = await getSampleScriptId(supabaseClient);
    
    // Set the sample script ID as a global variable for use in query replacement
    if (sampleScriptId) {
      (global as any).sampleScriptId = sampleScriptId;
      console.log(`Using sample script ID for demonstration: ${sampleScriptId}`);
    } else {
      console.log('No sample script ID found. Will use fallback UUID.');
      (global as any).sampleScriptId = '00000000-0000-0000-0000-000000000000';
    }
    
    // Run the prompt lookup with the provided prompt name or default
    const promptName = process.argv[2] || 'script-analysis-prompt';
    // Always output to markdown file
    const outputToMarkdown = true;
    
    await lookupPrompt(promptName, outputToMarkdown);
    console.log('Prompt lookup complete');
  } catch (err) {
    Logger.error('Fatal error:', err);
    process.exit(1);
  }
}

main();