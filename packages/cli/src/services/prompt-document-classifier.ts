import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FileService, FileResult } from './file-service';
import { ClaudeService } from './claude-service';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// Helper function to write results to a markdown file
export async function writeResultsToMarkdown(fileName: string, content: string): Promise<boolean> {
  try {
    const docsDir = path.join(process.cwd(), 'docs');
    
    // Create docs directory if it doesn't exist
    if (!fs.existsSync(docsDir)) {
      Logger.info(`Creating docs directory at ${docsDir}`);
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const filePath = path.join(docsDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    Logger.info(`Results saved to: ${filePath}`);
    return true;
  } catch (error) {
    Logger.error(`Error writing to markdown file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Create minimal versions of the types we need
export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface Relationship {
  id: string;
  prompt_id: string;
  asset_path: string;
  document_type_id?: string;
  relationship_type: string;
  relationship_context?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentTypeAssignment {
  document_type_id: string;
  document_type_name: string;
  confidence: number;
  file_id: string;
  file_path: string;
}

// Class for executing custom queries that aren't in the standard Supabase service
export class CustomQueryExecutor {
  private client: SupabaseClient;
  
  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }
  
  async executeCustomQuery(queryText: string): Promise<any> {
    try {
      Logger.info(`Executing query: ${queryText}`);
      
      // Check for specific known queries and handle them directly
      if (queryText.includes("document_types")) {
        // Handle direct Documentation category query
        if (queryText.includes("category = \"Documentation\"") || 
            queryText.includes("category = 'Documentation'")) {
          Logger.info("Detected Documentation category query - using direct table access");
          
          try {
            // Execute a direct query for Documentation category
            const { data, error } = await this.client
              .from('document_types')
              .select('*')
              .eq('category', 'Documentation');
              
            if (error) {
              throw new Error(`Failed to query document_types with category=Documentation: ${error.message}`);
            }
            
            Logger.info(`Found ${data?.length || 0} records with category=Documentation`);
            return data;
          } catch (error) {
            Logger.error(`Error in document_types query: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          
          // Alternative approach using split and map for more reliable extraction
          if (categoryValues.length === 0 || categoryValues.length < 4) {
            const cleanedInClause = inClauseMatch[1].trim();
            const alternativeCategories = cleanedInClause
              .split(',')
              .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean);
            
            if (alternativeCategories.length > 0) {
              Logger.info(`Using alternative extraction method, found: ${alternativeCategories.join(', ')}`);
              categoryValues.length = 0; // Clear existing array
              categoryValues.push(...alternativeCategories);
            }
          }
          
          // If we found categories, execute the query using the in() method
          if (categoryValues.length > 0) {
            Logger.info(`Detected IN query with categories: ${categoryValues.join(', ')}`);
            
            try {
              const { data, error } = await this.client
                .from('document_types')
                .select('*')
                .in('category', categoryValues);
                
              if (error) {
                throw new Error(`Failed to query document_types with categories: ${error.message}`);
              }
              
              Logger.info(`Found ${data?.length || 0} records with specified categories`);
              return data;
            } catch (error) {
              Logger.error(`Error in document_types IN query: ${error instanceof Error ? error.message : 'Unknown error'}`);
              throw error;
            }
          }
        }
      }
      
      // Try with single quotes instead of double quotes
      if (queryText.includes("\"")) {
        const singleQuoteQuery = queryText.replace(/(\w+\s*=\s*)"([^"]+)"/g, "$1'$2'");
        Logger.info(`Trying with SQL-compatible single quotes: ${singleQuoteQuery}`);
        
        try {
          const { data, error } = await this.client.rpc('execute_sql', { sql: singleQuoteQuery });
          
          if (!error) {
            Logger.info("Query execution successful via RPC with modified quotes");
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
          Logger.info("Query execution successful via RPC");
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

export class PromptDocumentClassifier {
  private supabaseUrl: string;
  private supabaseKey: string;
  private supabaseClient: SupabaseClient;
  private fileService: FileService;
  private queryExecutor: CustomQueryExecutor;
  private claudeService: ClaudeService;
  
  constructor(supabaseUrl: string, supabaseKey: string, claudeApiKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    this.fileService = new FileService();
    this.queryExecutor = new CustomQueryExecutor(supabaseUrl, supabaseKey);
    this.claudeService = new ClaudeService(claudeApiKey);
  }
  
  /**
   * Lookup a prompt by name and fetch its content, relationships, and related files
   * @param promptName The name of the prompt to look up
   * @param outputToMarkdown Whether to output results to a markdown file
   * @returns The prompt data and related information
   */
  async lookupPrompt(promptName: string, outputToMarkdown: boolean = false): Promise<{
    prompt: Prompt | null;
    relationships: Relationship[];
    files: Record<string, string>;
    metadata: Record<string, any> | null;
    databaseQueryResults: any[] | null;
    databaseQuery2Results: any[] | null;
  }> {
    // Create a results array to collect all output for markdown
    const results: string[] = [];
    const originalConsoleLog = console.log;
    
    if (outputToMarkdown) {
      console.log = (...args) => {
        originalConsoleLog(...args);
        results.push(args.join(' '));
      };
    }
    
    try {
      // Return data structure
      const promptData = {
        prompt: null as Prompt | null,
        relationships: [] as Relationship[],
        files: {} as Record<string, string>,
        metadata: null as Record<string, any> | null,
        databaseQueryResults: null as any[] | null,
        databaseQuery2Results: null as any[] | null
      };
      
      // Step 1: Find prompt by name
      Logger.info(`Looking up prompt: ${promptName}`);
      
      try {
        // Get prompt from database
        const { data: prompt, error } = await this.supabaseClient
          .from('prompts')
          .select('*')
          .eq('name', promptName)
          .single();
          
        if (error) {
          Logger.warn(`Error fetching prompt from database: ${error.message}`);
        } else if (prompt) {
          promptData.prompt = prompt as Prompt;
          Logger.info(`Found prompt in database: ${prompt.name}`);
          
          if (outputToMarkdown) {
            console.log('\n=== PROMPT DETAILS FROM DATABASE ===');
            console.log(`ID: ${prompt.id}`);
            console.log(`Name: ${prompt.name}`);
            console.log(`Description: ${prompt.description || 'No description'}`);
            console.log(`Created: ${new Date(prompt.created_at).toLocaleString()}`);
            console.log(`Updated: ${new Date(prompt.updated_at).toLocaleString()}`);
            
            console.log('\n=== PROMPT CONTENT FROM DATABASE ===');
            console.log(prompt.content || 'No content available in the database');
          }
        } else {
          Logger.warn(`No prompt found in database with name: ${promptName}`);
          
          // Try to find the prompt on disk
          try {
            Logger.info(`Trying to load prompt from disk...`);
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
              Logger.info(`Found prompt file on disk: ${promptFilePath}`);
              
              if (outputToMarkdown) {
                console.log('\n=== PROMPT CONTENT FROM DISK ===');
                console.log(promptContent);
              }
              
              // Try to extract metadata from the prompt file using front matter or <!-- --> comments
              const metadataMatch = promptContent.match(/<!--\s*([\s\S]*?)\s*-->/);
              if (metadataMatch && metadataMatch[1]) {
                try {
                  const metadata = JSON.parse(metadataMatch[1]);
                  
                  // Create a prompt object from the file content
                  promptData.prompt = {
                    id: 'local-file',
                    name: promptName,
                    content: promptContent,
                    description: 'Loaded from local file',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: metadata
                  };
                  
                  promptData.metadata = metadata;
                  
                  if (outputToMarkdown) {
                    console.log('\n=== METADATA FROM PROMPT FILE ===');
                    console.log(JSON.stringify(metadata, null, 2));
                  }
                } catch (parseError) {
                  Logger.error(`Error parsing metadata from prompt file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
                }
              } else {
                Logger.warn('No metadata found in prompt file');
                
                // Still create a prompt object without metadata
                promptData.prompt = {
                  id: 'local-file',
                  name: promptName,
                  content: promptContent,
                  description: 'Loaded from local file',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                
                if (outputToMarkdown) {
                  console.log('No metadata found in prompt file');
                }
              }
            } else {
              Logger.warn(`Could not find prompt file on disk. Tried: ${possiblePaths.join(', ')}`);
              
              if (outputToMarkdown) {
                console.log(`Could not find prompt file on disk. Tried: ${possiblePaths.join(', ')}`);
              }
            }
          } catch (diskError) {
            Logger.error(`Error reading prompt from disk: ${diskError instanceof Error ? diskError.message : 'Unknown error'}`);
            
            if (outputToMarkdown) {
              console.log(`Error reading prompt from disk: ${diskError instanceof Error ? diskError.message : 'Unknown error'}`);
            }
          }
        }
      } catch (error) {
        Logger.error(`Error accessing database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (outputToMarkdown) {
          console.log(`Error accessing database: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log("Will attempt to read prompt file from disk only.");
        }
      }
      
      // Step 2: Get prompt relationships (if we have database access)
      if (promptData.prompt && promptData.prompt.id && promptData.prompt.id !== 'local-file') {
        try {
          const { data: relationships, error } = await this.supabaseClient
            .from('file_relationships')
            .select('*')
            .eq('prompt_id', promptData.prompt.id);
            
          if (error) {
            Logger.error(`Error fetching relationships: ${error.message}`);
          } else if (relationships) {
            promptData.relationships = relationships as Relationship[];
            
            if (outputToMarkdown) {
              console.log(`\n=== RELATIONSHIPS (${relationships.length}) ===`);
              if (relationships.length === 0) {
                console.log('No relationships found in database');
              }
            }
            
            // Load each related file
            for (const rel of relationships) {
              if (outputToMarkdown) {
                console.log(`\nRelationship ID: ${rel.id}`);
                console.log(`Type: ${rel.relationship_type}`);
                console.log(`Asset Path: ${rel.asset_path}`);
                console.log(`Context: ${rel.relationship_context || 'No context'}`);
              }
              
              // Try to read the related file
              try {
                const fileResult = this.fileService.readFile(rel.asset_path);
                if (fileResult.success) {
                  // Store the file content in our return data
                  promptData.files[rel.asset_path] = fileResult.content || '';
                  
                  if (outputToMarkdown) {
                    console.log(`File Content (${fileResult.stats?.lines} lines, ${fileResult.stats?.size} bytes):`);
                    console.log('---');
                    console.log(fileResult.content || '');
                    console.log('---');
                  }
                } else {
                  Logger.warn(`Could not read file: ${fileResult.error}`);
                  
                  if (outputToMarkdown) {
                    console.log(`Could not read file: ${fileResult.error}`);
                  }
                }
              } catch (fileError) {
                Logger.error(`Error reading file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
                
                if (outputToMarkdown) {
                  console.log(`Error reading file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
                }
              }
            }
          }
        } catch (error) {
          Logger.error(`Error fetching relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          if (outputToMarkdown) {
            console.log(`Error fetching relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else if (outputToMarkdown) {
        console.log('\n=== RELATIONSHIPS ===');
        console.log('Cannot fetch relationships without database access or prompt ID');
      }
      
      // Step 3: Check for database query in metadata and execute it
      if (promptData.prompt && promptData.prompt.metadata) {
        // Store the metadata in our return structure
        promptData.metadata = promptData.prompt.metadata;
        
        if (outputToMarkdown) {
          console.log('\n=== PROMPT METADATA ===');
          console.log(JSON.stringify(promptData.prompt.metadata, null, 2));
        }
        
        // If there's a database query in the metadata, execute it
        if (promptData.prompt.metadata.database_query || promptData.prompt.metadata.databaseQuery) {
          try {
            // Get the query from either field name
            const queryText = promptData.prompt.metadata.database_query || promptData.prompt.metadata.databaseQuery;
            
            if (outputToMarkdown) {
              console.log('\n=== DATABASE QUERY RESULTS ===');
              console.log(`Query: ${queryText}`);
            }
            
            // Execute the query from metadata
            const data = await this.queryExecutor.executeCustomQuery(queryText);
            
            // Store the query results
            promptData.databaseQueryResults = data;
            
            if (outputToMarkdown) {
              // Add count of records returned to help with troubleshooting
              const recordCount = Array.isArray(data) ? data.length : 1;
              console.log(`Records found: ${recordCount}`);
              console.log(JSON.stringify(data, null, 2));
            }
          } catch (error) {
            Logger.error(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            if (outputToMarkdown) {
              console.log(`Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
              console.log('Database query could not be executed due to connection issues.');
            }
          }
        }
        
        // If there's a second database query in the metadata, execute it
        if (promptData.prompt.metadata.databaseQuery2) {
          try {
            // Get the second query
            let queryText = promptData.prompt.metadata.databaseQuery2;
            
            // Remove trailing semicolons which cause syntax errors in RPC calls
            queryText = queryText.trim().replace(/;+$/, '');
            
            if (outputToMarkdown) {
              console.log('\n=== DATABASE QUERY2 RESULTS ===');
              console.log(`Query: ${queryText}`);
            }
            
            // Check if we need to replace a parameter
            if (queryText.includes(":script_id")) {
              if (promptData.relationships && promptData.relationships.length > 0) {
                // Get the first relationship's asset ID to use as script_id
                const scriptId = promptData.relationships[0].asset_id;
                
                if (outputToMarkdown) {
                  console.log(`Replacing :script_id parameter with: ${scriptId}`);
                }
                
                // Always surround with single quotes to ensure proper SQL syntax
                let replacement = scriptId;
                if (!replacement.startsWith("'") && !replacement.endsWith("'")) {
                  replacement = `'${replacement}'`;
                }
                
                queryText = queryText.replace(/:script_id/g, replacement);
                
                if (outputToMarkdown) {
                  console.log(`Modified query: ${queryText}`);
                }
              } else {
                if (outputToMarkdown) {
                  console.log("Warning: :script_id parameter found but no relationships available for replacement");
                }
                
                // Try to look up the script ID directly based on context
                try {
                  if (promptData.files && Object.keys(promptData.files).length > 0) {
                    const filePath = Object.keys(promptData.files)[0];
                    
                    if (outputToMarkdown) {
                      console.log(`Attempting to find script ID for file: ${filePath}`);
                    }
                    
                    // Query the scripts table for the script ID
                    const { data, error } = await this.supabaseClient
                      .from('scripts')
                      .select('id')
                      .eq('file_path', filePath)
                      .single();
                      
                    if (data && data.id) {
                      if (outputToMarkdown) {
                        console.log(`Found script ID ${data.id} for file: ${filePath}`);
                      }
                      
                      queryText = queryText.replace(/:script_id/g, `'${data.id}'`);
                    } else {
                      if (outputToMarkdown) {
                        console.log(`No script found for file: ${filePath}`);
                        console.log("Using fallback script ID to avoid query errors");
                      }
                      
                      queryText = queryText.replace(/:script_id/g, "'00000000-0000-0000-0000-000000000000'");
                    }
                  } else {
                    if (outputToMarkdown) {
                      console.log("No files available to lookup script ID, using fallback");
                    }
                    
                    queryText = queryText.replace(/:script_id/g, "'00000000-0000-0000-0000-000000000000'");
                  }
                } catch (error) {
                  if (outputToMarkdown) {
                    console.log(`Error finding script ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    console.log("Using fallback script ID to avoid query errors");
                  }
                  
                  queryText = queryText.replace(/:script_id/g, "'00000000-0000-0000-0000-000000000000'");
                }
              }
            }
            
            // Execute the second query from metadata
            const data = await this.queryExecutor.executeCustomQuery(queryText);
            
            // Store the second query results
            promptData.databaseQuery2Results = data;
            
            if (outputToMarkdown) {
              // Add count of records returned to help with troubleshooting
              const recordCount = Array.isArray(data) ? data.length : 1;
              console.log(`Records found: ${recordCount}`);
              console.log(JSON.stringify(data, null, 2));
            }
          } catch (error) {
            Logger.error(`Error executing second query: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            if (outputToMarkdown) {
              console.log(`Error executing second query: ${error instanceof Error ? error.message : 'Unknown error'}`);
              console.log('Second database query could not be executed due to connection issues.');
            }
          }
        }
      } else if (outputToMarkdown) {
        console.log('\n=== PROMPT METADATA ===');
        console.log('No metadata available (no database access)');
      }
      
      return promptData;
    } catch (error) {
      Logger.error('Error looking up prompt:', error);
      throw error;
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
  
  /**
   * Classify a document using a prompt and Claude API
   * @param documentPath Path to the document to classify
   * @param promptName Name of the prompt to use for classification
   * @param outputToMarkdown Whether to save results to markdown
   * @returns Classification result with document type assignments
   */
  async classifyDocument(documentPath: string, promptName: string, outputToMarkdown: boolean = false): Promise<{
    success: boolean;
    documentType?: DocumentTypeAssignment;
    error?: string;
  }> {
    try {
      // First, load the document content
      Logger.info(`Reading document: ${documentPath}`);
      const fileResult = this.fileService.readFile(documentPath);
      
      if (!fileResult.success) {
        return {
          success: false,
          error: `Failed to read document file: ${fileResult.error}`
        };
      }
      
      // Next, lookup the prompt
      Logger.info(`Looking up prompt: ${promptName}`);
      const promptData = await this.lookupPrompt(promptName, outputToMarkdown);
      
      if (!promptData.prompt) {
        return {
          success: false,
          error: `Prompt not found: ${promptName}`
        };
      }
      
      // Prepare document content and prompt for Claude API
      const documentContent = fileResult.content || '';
      
      // Get document types from the database query results
      const documentTypes = promptData.databaseQueryResults || [];
      
      if (!documentTypes || documentTypes.length === 0) {
        return {
          success: false,
          error: 'No document types found in database query results'
        };
      }
      
      // Build the system prompt for Claude
      let systemPrompt = `${promptData.prompt.content}\n\n`;
      systemPrompt += `Here are the available document types you can choose from:\n`;
      
      documentTypes.forEach((type: any) => {
        systemPrompt += `- ${type.document_type || 'Unnamed'}: ${type.description || 'No description'}\n`;
      });
      
      systemPrompt += `\nAnalyze the following document and classify it as one of these document types. Return your response as a JSON object with document_type_id, document_type_name, and confidence (0-1).`;
      
      // Call Claude API
      Logger.info('Calling Claude API for document classification');
      const claudeResponse = await this.claudeService.classifyDocument(
        documentContent,
        systemPrompt, 
        JSON.stringify({ documentTypes, filePath: documentPath })
      );
      
      if (!claudeResponse.success) {
        return {
          success: false,
          error: `Claude API error: ${claudeResponse.error}`
        };
      }
      
      // Parse the Claude response to get the document type assignment
      let documentTypeAssignment: DocumentTypeAssignment;
      
      try {
        // Extract JSON from the Claude response
        const responseContent = claudeResponse.result || '';
        const jsonMatch = responseContent.match(/```json\s*({[\s\S]*?})\s*```/) || 
                         responseContent.match(/{[\s\S]*?}/);
                         
        if (!jsonMatch) {
          return {
            success: false,
            error: 'Failed to extract JSON from Claude response'
          };
        }
        
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const classification = JSON.parse(jsonStr);
        
        documentTypeAssignment = {
          document_type_id: classification.document_type_id,
          document_type_name: classification.document_type_name,
          confidence: classification.confidence,
          file_id: '', // Will be filled in when saved to database
          file_path: documentPath
        };
        
        // Save to markdown if requested
        if (outputToMarkdown) {
          const markdownContent = `# Document Classification: ${path.basename(documentPath)}

Generated: ${new Date().toISOString()}

## Document Content
\`\`\`
${documentContent.substring(0, 500)}... (truncated)
\`\`\`

## Classification Result
- Document Type: ${documentTypeAssignment.document_type_name}
- Document Type ID: ${documentTypeAssignment.document_type_id}
- Confidence: ${documentTypeAssignment.confidence}

## Claude Response
${claudeResponse.result || 'No response content'}
`;
          
          const fileName = `document-classification-${path.basename(documentPath).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
          await writeResultsToMarkdown(fileName, markdownContent);
        }
        
        return {
          success: true,
          documentType: documentTypeAssignment
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    } catch (error) {
      Logger.error('Error classifying document:', error);
      return {
        success: false,
        error: `Error classifying document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Save document type assignment to the database
   * @param assignment The document type assignment to save
   * @returns Success status and error message if applicable
   */
  async saveDocumentTypeAssignment(assignment: DocumentTypeAssignment): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get the file ID from the database based on file_path
      const { data: file, error: fileError } = await this.supabaseClient
        .from('documentation_files')
        .select('id')
        .eq('file_path', assignment.file_path)
        .single();
        
      if (fileError || !file) {
        return {
          success: false,
          error: `File not found in database: ${assignment.file_path}`
        };
      }
      
      // Update the documentation_files table with the document_type_id
      const { error: updateError } = await this.supabaseClient
        .from('documentation_files')
        .update({
          document_type_id: assignment.document_type_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', file.id);
        
      if (updateError) {
        return {
          success: false,
          error: `Failed to update document type: ${updateError.message}`
        };
      }
      
      return {
        success: true
      };
    } catch (error) {
      Logger.error('Error saving document type assignment:', error);
      return {
        success: false,
        error: `Error saving document type assignment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Process documents without document types using Claude 3.7
   * @param promptName The name of the classification prompt to use
   * @param limit Maximum number of documents to process
   * @param outputToMarkdown Whether to save results to markdown
   * @returns Results of the processing operation
   */
  async processDocumentsWithoutTypes(promptName: string, limit: number = 10, outputToMarkdown: boolean = false): Promise<{
    success: boolean;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: true,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    try {
      // First, get all documentation files without document types
      Logger.info('Finding documents without type assignments...');
      const { data: files, error: filesError } = await this.supabaseClient
        .from('documentation_files')
        .select('id, file_path, title')
        .is('document_type_id', null)
        .eq('is_deleted', false)
        .order('file_path')
        .limit(limit);
        
      if (filesError) {
        results.success = false;
        results.errors.push(`Failed to fetch files: ${filesError.message}`);
        return results;
      }
      
      if (!files || files.length === 0) {
        Logger.info('No documents found without type assignments.');
        return results;
      }
      
      Logger.info(`Found ${files.length} documents without type assignments.`);
      
      // Process each file
      for (const file of files) {
        Logger.info(`Processing file: ${file.file_path}`);
        results.processed++;
        
        // Skip if no file path
        if (!file.file_path) {
          results.failed++;
          results.errors.push(`File ID ${file.id} has no file_path`);
          continue;
        }
        
        // Classify the document
        const classificationResult = await this.classifyDocument(
          file.file_path,
          promptName,
          outputToMarkdown
        );
        
        if (!classificationResult.success || !classificationResult.documentType) {
          results.failed++;
          results.errors.push(`Failed to classify ${file.file_path}: ${classificationResult.error}`);
          continue;
        }
        
        // Save the document type assignment
        const saveResult = await this.saveDocumentTypeAssignment({
          ...classificationResult.documentType,
          file_id: file.id
        });
        
        if (!saveResult.success) {
          results.failed++;
          results.errors.push(`Failed to save assignment for ${file.file_path}: ${saveResult.error}`);
          continue;
        }
        
        results.successful++;
        Logger.info(`Successfully classified ${file.file_path} as ${classificationResult.documentType.document_type_name}`);
      }
      
      return results;
    } catch (error) {
      Logger.error('Error processing documents without types:', error);
      results.success = false;
      results.errors.push(`Error processing documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return results;
    }
  }
}