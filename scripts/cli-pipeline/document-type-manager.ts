import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotEnv } from 'dotenv';
import { ClaudeService } from '../../packages/cli/src/services/claude-service';

// Initialize environment variables
loadDotEnv();

interface FileStatus {
  id: string;
  file_path: string;
  exists_on_disk: boolean;
  document_type_id: string | null;
  document_type: string | null;
  title: string | null;
}

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  category: string | null;
}

interface PromptRelationship {
  id: string;
  prompt_id: string;
  asset_path: string;
  relationship_type: string;
  relationship_context?: string;
}

interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

interface PromptLookupResult {
  prompt: Prompt | null;
  relationships: PromptRelationship[];
  files: Record<string, string>;
  documentTypes: DocumentType[];
}

interface ClassificationResult {
  success: boolean;
  document_type_id?: string;
  document_type_name?: string;
  confidence?: number;
  error?: string;
  summary?: string;
  title?: string;
  ai_generated_tags?: string[];
  status_recommendation?: string;
  ai_assessment?: {
    status_recommendation?: string;
    [key: string]: any;
  };
}

class DocumentTypeManager {
  private _supabase: SupabaseClient;
  private claudeService: ClaudeService;
  private rootDir: string;

  constructor() {
    // Setup Supabase connection
    let supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    // Make sure the URL has proper protocol
    if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
      supabaseUrl = 'https://' + supabaseUrl;
      console.log(`Adding https:// prefix to Supabase URL: ${supabaseUrl}`);
    }

    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
    this._supabase = createClient(supabaseUrl, supabaseKey);
    
    // Setup Claude service
    // Try different environment variable names for Claude API key
    let claudeApiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.CLI_CLAUDE_API_KEY;
    
    if (!claudeApiKey) {
      throw new Error('Missing Claude API key. Please set CLAUDE_API_KEY, ANTHROPIC_API_KEY, or CLI_CLAUDE_API_KEY environment variable.');
    }
    
    console.log(`Claude API key present (length: ${claudeApiKey.length})`);
    console.log(`API key starts with: ${claudeApiKey.substring(0, 10)}...`);
    
    try {
      this.claudeService = new ClaudeService(claudeApiKey);
      console.log('Claude service initialized successfully.');
    } catch (error) {
      console.error('Error initializing Claude service:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to initialize Claude service. Check your API key.');
    }
    
    // Set root directory
    this.rootDir = process.cwd();
  }
  
  // Add a public getter for the supabase client
  public get supabase(): SupabaseClient {
    return this._supabase;
  }

  /**
   * List all document types in the database
   */
  async listDocumentTypes(): Promise<DocumentType[]> {
    try {
      console.log('\n=== LISTING ALL DOCUMENT TYPES ===');
      
      const { data: documentTypes, error } = await this._supabase
        .from('document_types')
        .select('id, document_type, description, category')
        .order('document_type');
        
      if (error) {
        throw new Error(`Error fetching document types: ${error.message}`);
      }
      
      if (!documentTypes || documentTypes.length === 0) {
        console.log('No document types found in the database.');
        return [];
      }
      
      console.log(`Found ${documentTypes.length} document types:`);
      documentTypes.forEach(type => {
        console.log(`- ${type.document_type} (${type.category || 'No category'}): ${type.description || 'No description'}`);
      });
      
      return documentTypes;
    } catch (error) {
      console.error('Error listing document types:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * List all file paths in the database and check their existence on disk
   */
  async listAllFilePaths(): Promise<FileStatus[]> {
    try {
      console.log('\n=== LISTING ALL FILE PATHS ===');
      
      const { data: files, error } = await this._supabase
        .from('documentation_files')
        .select('id, file_path, document_type_id, title')
        .order('file_path');
        
      if (error) {
        throw new Error(`Error fetching files: ${error.message}`);
      }
      
      if (!files || files.length === 0) {
        console.log('No files found in the database.');
        return [];
      }
      
      console.log(`Found ${files.length} files in the database.`);
      
      // Get document types for reference
      const { data: documentTypes, error: typeError } = await this._supabase
        .from('document_types')
        .select('id, document_type');
        
      if (typeError) {
        console.warn(`Warning: Could not fetch document types: ${typeError.message}`);
      }
      
      // Create lookup map for document types
      const typeMap = new Map<string, string>();
      if (documentTypes) {
        documentTypes.forEach(type => {
          typeMap.set(type.id, type.document_type);
        });
      }
      
      // Check each file's existence on disk
      const fileStatusList: FileStatus[] = [];
      
      for (const file of files) {
        const filePath = path.join(this.rootDir, file.file_path);
        const existsOnDisk = fs.existsSync(filePath);
        
        const fileStatus: FileStatus = {
          id: file.id,
          file_path: file.file_path,
          exists_on_disk: existsOnDisk,
          document_type_id: file.document_type_id,
          document_type: file.document_type_id ? typeMap.get(file.document_type_id) || null : null,
          title: file.title
        };
        
        fileStatusList.push(fileStatus);
      }
      
      // Display file status summary
      console.log('\nFile Status Summary:');
      console.log(`- Total files: ${fileStatusList.length}`);
      console.log(`- Files that exist on disk: ${fileStatusList.filter(f => f.exists_on_disk).length}`);
      console.log(`- Files that don't exist on disk: ${fileStatusList.filter(f => !f.exists_on_disk).length}`);
      console.log(`- Files with document type assigned: ${fileStatusList.filter(f => f.document_type_id !== null).length}`);
      
      return fileStatusList;
    } catch (error) {
      console.error('Error listing file paths:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Update file status based on disk existence
   */
  async updateFileStatus(): Promise<void> {
    try {
      console.log('\n=== UPDATING FILE STATUS BASED ON DISK EXISTENCE ===');
      
      // Get all files
      const fileStatusList = await this.listAllFilePaths();
      
      if (fileStatusList.length === 0) {
        console.log('No files to update.');
        return;
      }
      
      // Files to delete (don't exist on disk)
      const filesToDelete = fileStatusList.filter(f => !f.exists_on_disk);
      
      console.log(`Found ${filesToDelete.length} files to delete from database.`);
      
      // Hard delete files that don't exist on disk
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await this._supabase
          .from('documentation_files')
          .delete()
          .in('id', filesToDelete.map(f => f.id));
          
        if (deleteError) {
          console.error(`Error deleting files: ${deleteError.message}`);
        } else {
          console.log(`Successfully deleted ${filesToDelete.length} files from database.`);
        }
      }
      
      console.log('File status update complete.');
    } catch (error) {
      console.error('Error updating file status:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Lookup a prompt by name and fetch its content, relationships, and document types
   */
  async lookupPrompt(promptName: string): Promise<PromptLookupResult> {
    try {
      console.log(`\n=== LOOKING UP PROMPT: ${promptName} ===`);
      
      // Initialize result object
      const result: PromptLookupResult = {
        prompt: null,
        relationships: [],
        files: {},
        documentTypes: []
      };
      
      // Step 1: Get prompt from database
      const { data: prompt, error: promptError } = await this._supabase
        .from('prompts')
        .select('*')
        .eq('name', promptName)
        .single();
        
      if (promptError) {
        console.error(`Error fetching prompt: ${promptError.message}`);
        
        // Try to find prompt in prompts directory
        const promptPath = path.join(this.rootDir, 'prompts', `${promptName}.md`);
        if (fs.existsSync(promptPath)) {
          console.log(`Found prompt file at ${promptPath}`);
          const content = fs.readFileSync(promptPath, 'utf8');
          
          // Create a minimal prompt object
          result.prompt = {
            id: 'local-file',
            name: promptName,
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        } else {
          console.error(`Prompt not found in database or on disk: ${promptName}`);
        }
      } else {
        console.log(`Found prompt in database: ${prompt.name}`);
        result.prompt = prompt;
      }
      
      // If we don't have a prompt, return early
      if (!result.prompt) {
        return result;
      }
      
      // Step 2: Get relationships if prompt is from database
      if (result.prompt.id !== 'local-file') {
        // Try with prompt_relationships first (correct table name)
        const { data: promptRelationships, error: promptRelError } = await this._supabase
          .from('prompt_relationships')
          .select('*')
          .eq('prompt_id', result.prompt.id);
          
        if (promptRelError) {
          // Fall back to file_relationships if prompt_relationships failed
          console.log(`Could not fetch from prompt_relationships: ${promptRelError.message}`);
          console.log('Trying file_relationships table as fallback...');
          
          const { data: fileRelationships, error: fileRelError } = await this._supabase
            .from('file_relationships')
            .select('*')
            .eq('prompt_id', result.prompt.id);
            
          if (fileRelError) {
            console.error(`Error fetching relationships: ${fileRelError.message}`);
          } else if (fileRelationships && fileRelationships.length > 0) {
            console.log(`Found ${fileRelationships.length} relationships in file_relationships table for prompt ${promptName}`);
            result.relationships = fileRelationships;
          }
        } else if (promptRelationships && promptRelationships.length > 0) {
          console.log(`Found ${promptRelationships.length} relationships in prompt_relationships table for prompt ${promptName}`);
          result.relationships = promptRelationships;
          
          // Load the content of each related file
          for (const rel of promptRelationships) {
            try {
              const filePath = path.join(this.rootDir, rel.asset_path);
              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                result.files[rel.asset_path] = content;
                console.log(`Loaded content for: ${rel.asset_path}`);
                
                // Display the relationship context if available
                if (rel.relationship_context) {
                  console.log(`Relationship context for ${rel.asset_path}:`);
                  console.log(rel.relationship_context);
                }
              } else {
                console.warn(`Related file not found: ${rel.asset_path}`);
              }
            } catch (fileError) {
              console.error(`Error reading related file: ${rel.asset_path}`, fileError);
            }
          }
        } else {
          console.log(`No relationships found for prompt ${promptName}`);
        }
      }
      
      // Step 3: Get document types (needed for classification)
      // First, check if we have a database query in the prompt metadata
      let documentTypes = null;
      
      if (result.prompt?.metadata?.database_query || result.prompt?.metadata?.databaseQuery) {
        const queryText = result.prompt.metadata.database_query || result.prompt.metadata.databaseQuery;
        console.log(`\nFound database query in prompt metadata:`);
        console.log(queryText);
        
        try {
          console.log(`Executing database query from prompt metadata...`);
          
          // If it's a document_types query, try to execute it directly
          if (queryText.includes('document_types')) {
            // Look for specific patterns in the query
            if (queryText.toLowerCase().includes("category = 'documentation'") || 
                queryText.toLowerCase().includes('category = "documentation"')) {
              console.log('Using direct table access for document_types with Documentation category');
              
              const { data, error } = await this._supabase
                .from('document_types')
                .select('*')
                .eq('category', 'Documentation');
                
              if (error) {
                console.error(`Error executing direct query: ${error.message}`);
              } else if (data && data.length > 0) {
                console.log(`Found ${data.length} document types using direct query`);
                documentTypes = data;
              }
            } else if (queryText.toLowerCase().includes("category in (")) {
              // Try to extract categories from IN clause
              const categoryMatch = queryText.match(/category\s+in\s*\(\s*['"](.*?)['"](?:\s*,\s*['"]?(.*?)['"]?)*\s*\)/i);
              if (categoryMatch) {
                const categories = categoryMatch
                  .slice(1)
                  .filter(Boolean)
                  .map((cat: string) => cat.trim());
                  
                if (categories.length > 0) {
                  console.log(`Executing IN query with categories: ${categories.join(', ')}`);
                  
                  const { data, error } = await this._supabase
                    .from('document_types')
                    .select('*')
                    .in('category', categories);
                    
                  if (error) {
                    console.error(`Error executing IN query: ${error.message}`);
                  } else if (data && data.length > 0) {
                    console.log(`Found ${data.length} document types using IN query`);
                    documentTypes = data;
                  }
                }
              }
            }
          }
          
          // If we still don't have results, try to use execute_sql RPC
          if (!documentTypes) {
            try {
              console.log('Trying execute_sql RPC method');
              const { data, error } = await this._supabase.rpc('execute_sql', { sql: queryText });
              
              if (error) {
                console.error(`Error executing SQL via RPC: ${error.message}`);
              } else if (data && data.length > 0) {
                console.log(`Found ${data.length} results using RPC query execution`);
                documentTypes = data;
              }
            } catch (rpcError) {
              console.error(`RPC method error: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
            }
          }
        } catch (queryError) {
          console.error(`Error executing query from metadata: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`);
        }
      }
      
      // If we couldn't get document types from metadata query, fall back to direct table access
      if (!documentTypes) {
        console.log('\nFalling back to direct table access for document types');
        const { data, error: typeError } = await this._supabase
          .from('document_types')
          .select('id, document_type, description, category')
          .eq('category', 'Documentation');
          
        if (typeError) {
          console.error(`Error fetching document types: ${typeError.message}`);
        } else if (data && data.length > 0) {
          console.log(`Found ${data.length} document types for category: Documentation`);
          documentTypes = data;
        } else {
          console.warn('No document types found for category: Documentation');
        }
      }
      
      if (documentTypes && documentTypes.length > 0) {
        result.documentTypes = documentTypes;
        console.log(`\nSample document types (first 3):`);
        documentTypes.slice(0, 3).forEach((type: { document_type: string; description?: string; category?: string }) => {
          console.log(`- ${type.document_type}: ${type.description || 'No description'} (Category: ${type.category || 'None'})`);
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error looking up prompt:', error instanceof Error ? error.message : 'Unknown error');
      return {
        prompt: null,
        relationships: [],
        files: {},
        documentTypes: []
      };
    }
  }

  /**
   * Classify a document using Claude 3.7 and a prompt
   */
  async classifyDocument(documentPath: string, promptName: string): Promise<ClassificationResult> {
    try {
      console.log(`\n=== CLASSIFYING DOCUMENT: ${documentPath} ===`);
      
      // Step 1: Check if file exists
      const fullPath = path.resolve(this.rootDir, documentPath);
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `File not found: ${fullPath}`
        };
      }
      
      // Step 2: Read the document content
      const documentContent = fs.readFileSync(fullPath, 'utf8');
      console.log(`Read ${documentContent.length} characters from ${documentPath}`);
      
      // Step 3: Look up the prompt
      const promptData = await this.lookupPrompt(promptName);
      
      if (!promptData.prompt) {
        return {
          success: false,
          error: `Prompt not found: ${promptName}`
        };
      }
      
      if (promptData.documentTypes.length === 0) {
        return {
          success: false,
          error: 'No document types found for classification'
        };
      }
      
      // Step 4: Build the system prompt for Claude
      // Use the prompt content from the database as is, don't modify it
      let systemPrompt = promptData.prompt.content;
      
      // If the prompt doesn't have the document types listed, we'll add them
      if (!systemPrompt.includes('document types you can choose from') && 
          !systemPrompt.includes('document_type_id')) {
        systemPrompt += `\n\nHere are the available document types you can choose from:\n`;
        
        promptData.documentTypes.forEach(type => {
          systemPrompt += `- ${type.document_type} (ID: ${type.id}): ${type.description || 'No description'}\n`;
        });
        
        systemPrompt += `\nAnalyze the following document and classify it as one of these document types. Return your response as a JSON object with document_type_id, document_type_name, and confidence (0-1).`;
      }
      
      console.log('\n=== SYSTEM PROMPT ===');
      console.log(systemPrompt.substring(0, 500) + '...');
      console.log('(Truncated for display)');
      
      // Step 5: Create context object with related information
      const contextObject = {
        documentTypes: promptData.documentTypes,
        filePath: documentPath,
        relationships: promptData.relationships.map(rel => ({
          id: rel.id,
          asset_path: rel.asset_path,
          relationship_type: rel.relationship_type,
          relationship_context: rel.relationship_context || null
        })),
        files: Object.keys(promptData.files).map(filePath => ({
          path: filePath,
          content_summary: `${promptData.files[filePath].substring(0, 100)}...`
        }))
      };
      
      console.log('\n=== CONTEXT OBJECT ===');
      console.log(JSON.stringify(contextObject, null, 2).substring(0, 500) + '...');
      console.log('(Truncated for display)');
      
      // Step 6: Call Claude API
      console.log('Calling Claude API for classification...');
      const claudeResponse = await this.claudeService.classifyDocument(
        documentContent,
        systemPrompt,
        JSON.stringify(contextObject)
      );
      
      if (!claudeResponse.success) {
        return {
          success: false,
          error: `Claude API error: ${claudeResponse.error}`
        };
      }
      
      // Step 7: Extract the classification from the response
      const responseContent = claudeResponse.result;
      console.log('\n=== FULL CLAUDE API RESPONSE ===');
      
      // Display the full response for debugging
      if (typeof responseContent === 'string') {
        console.log(responseContent);
      } else if (typeof responseContent === 'object') {
        console.log(JSON.stringify(responseContent, null, 2));
      } else {
        console.log(`Response is of type: ${typeof responseContent}`);
      }
      
      try {
        // Try to extract JSON from the response in different formats
        let jsonStr = '';
        let contentText = '';
        
        // Direct string response
        if (typeof responseContent === 'string') {
          console.log('Response content is a string');
          
          // Try to match JSON within code blocks or directly in the string
          const jsonMatch = responseContent.match(/```json\s*({[\s\S]*?})\s*```/) || 
                           responseContent.match(/{[\s\S]*?}/);
                           
          if (jsonMatch && (jsonMatch[1] || jsonMatch[0])) {
            jsonStr = jsonMatch[1] || jsonMatch[0];
            console.log('\nExtracted JSON from direct string response');
          } else {
            contentText = responseContent;
          }
        } 
        // Object response structure (new Claude API format)
        else if (typeof responseContent === 'object') {
          console.log('Response content is an object');
          
          // Claude v2 format: content array with text objects
          if (responseContent.content && Array.isArray(responseContent.content)) {
            contentText = responseContent.content[0]?.text || '';
            console.log(`Found content array with ${responseContent.content.length} items`);
            
            // Try to extract JSON from contentText 
            const contentMatch = contentText.match(/```json\s*({[\s\S]*?})\s*```/) || 
                               contentText.match(/{[\s\S]*?}/);
                               
            if (contentMatch && (contentMatch[1] || contentMatch[0])) {
              jsonStr = contentMatch[1] || contentMatch[0];
              console.log('\nExtracted JSON from content text');
            }
          }
          // Direct JSON response or other format
          else if (typeof JSON.stringify(responseContent) === 'string') {
            // Just use the full object as JSON
            jsonStr = JSON.stringify(responseContent);
            console.log('\nUsing whole response object as JSON');
          }
        }
        
        // If we couldn't extract JSON through normal means, try alternative approaches
        if (!jsonStr && contentText) {
          console.log('Attempting alternative JSON extraction methods');
          
          // Try more aggressive JSON extraction for malformed responses
          // Find anything that looks like JSON object with our expected fields
          const looseMatch = contentText.match(/\{[^{]*?"document_type_id"[^}]*?\}/);
          if (looseMatch) {
            console.log('Found loose JSON match with document_type_id field');
            jsonStr = looseMatch[0];
          }
        }
        
        // Last resort if we still don't have JSON
        if (!jsonStr) {
          console.error('Could not extract JSON from Claude response');
          console.log('Raw response content:', typeof responseContent === 'string' 
            ? responseContent.substring(0, 500) + '...' 
            : JSON.stringify(responseContent).substring(0, 500) + '...');
          return {
            success: false,
            error: 'Could not extract JSON from Claude response'
          };
        }
        
        console.log('\n=== EXTRACTED JSON ===');
        console.log(jsonStr);
        
        // Parse the extracted JSON
        const classification = JSON.parse(jsonStr);
        
        console.log('\n=== PARSED CLASSIFICATION ===');
        console.log(JSON.stringify(classification, null, 2));
        
        // Ensure we're returning expected fields by checking and extracting them
        const result: ClassificationResult = {
          success: true,
          document_type_id: classification.document_type_id,
          document_type_name: classification.document_type_name,
          confidence: classification.confidence,
          // Include additional fields if available
          summary: classification.summary,
          title: classification.title,
          ai_generated_tags: classification.ai_generated_tags,
          status_recommendation: classification.status_recommendation
        };
        
        // Also check for ai_assessment object that might contain status_recommendation
        if (classification.ai_assessment) {
          result.ai_assessment = classification.ai_assessment;
        }
        
        return result;
      } catch (parseError) {
        console.error('Error parsing Claude response:', parseError);
        return {
          success: false,
          error: `Error parsing Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }
    } catch (error) {
      console.error('Error classifying document:', error);
      return {
        success: false,
        error: `Error classifying document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update document type for a file in the database
   */
  async updateDocumentType(filePath: string, documentTypeId: string, classificationData?: any): Promise<boolean> {
    try {
      console.log(`\n=== UPDATING DOCUMENT TYPE FOR: ${filePath} ===`);
      
      // Get the file ID from the database
      const { data: file, error: fileError } = await this._supabase
        .from('documentation_files')
        .select('id, metadata')
        .eq('file_path', filePath)
        .single();
        
      if (fileError) {
        console.error(`Error fetching file: ${fileError.message}`);
        return false;
      }
      
      if (!file) {
        console.error(`File not found in database: ${filePath}`);
        return false;
      }
      
      // Build update object with document type and any additional data
      const updateData: any = {
        document_type_id: documentTypeId,
        updated_at: new Date().toISOString()
      };
      
      // Include summary, title, and tags if provided in the classification data
      if (classificationData) {
        if (classificationData.summary) {
          console.log(`Including summary in update: ${classificationData.summary.substring(0, 50)}...`);
          updateData.summary = classificationData.summary;
        }
        
        if (classificationData.title) {
          console.log(`Including title in update: ${classificationData.title}`);
          updateData.title = classificationData.title;
        }
        
        if (classificationData.ai_generated_tags && Array.isArray(classificationData.ai_generated_tags)) {
          console.log(`Including ${classificationData.ai_generated_tags.length} tags in update`);
          updateData.ai_generated_tags = classificationData.ai_generated_tags;
        }
        
        // Extract status_recommendation if available in the classification data
        // or from the AI assessment data
        if (classificationData.status_recommendation) {
          console.log(`Including status_recommendation in update: ${classificationData.status_recommendation}`);
          updateData.status_recommendation = classificationData.status_recommendation;
        } 
        else if (classificationData.ai_assessment?.status_recommendation) {
          console.log(`Including status_recommendation from ai_assessment: ${classificationData.ai_assessment.status_recommendation}`);
          updateData.status_recommendation = classificationData.ai_assessment.status_recommendation;
        }
      }
      
      // Get file stats and update size in metadata
      try {
        const fullPath = path.resolve(this.rootDir, filePath);
        const fileStats = fs.statSync(fullPath);
        console.log(`Adding file size to metadata: ${fileStats.size} bytes`);
        
        // Use existing metadata or initialize new object
        const metadata = file.metadata || {};
        
        // Check if status_recommendation exists in metadata and move it to the main field
        if (metadata.status_recommendation && !updateData.status_recommendation) {
          console.log(`Moving status_recommendation from metadata to main field: ${metadata.status_recommendation}`);
          updateData.status_recommendation = metadata.status_recommendation;
        }
        else if (metadata.ai_assessment?.status_recommendation && !updateData.status_recommendation) {
          console.log(`Moving status_recommendation from metadata.ai_assessment to main field: ${metadata.ai_assessment.status_recommendation}`);
          updateData.status_recommendation = metadata.ai_assessment.status_recommendation;
        }
        else if (metadata.processed_content?.assessment?.status_recommendation && !updateData.status_recommendation) {
          console.log(`Moving status_recommendation from metadata.processed_content.assessment to main field: ${metadata.processed_content.assessment.status_recommendation}`);
          updateData.status_recommendation = metadata.processed_content.assessment.status_recommendation;
        }
        
        // Update metadata
        updateData.metadata = {
          ...metadata,
          file_size: fileStats.size, // Changed from 'size' to 'file_size'
          lastClassified: new Date().toISOString()
        };
        
        // Remove 'size' if it exists to ensure we're using 'file_size' consistently
        if (updateData.metadata.size !== undefined) {
          console.log(`Converting 'size' (${updateData.metadata.size}) to 'file_size' for ${filePath}`);
          delete updateData.metadata.size;
        }
      } catch (statsError) {
        console.error(`Error getting file stats: ${statsError instanceof Error ? statsError.message : 'Unknown error'}`);
      }
      
      // Update the document record with all data
      const { error: updateError } = await this._supabase
        .from('documentation_files')
        .update(updateData)
        .eq('id', file.id);
        
      if (updateError) {
        console.error(`Error updating document: ${updateError.message}`);
        return false;
      }
      
      console.log(`Successfully updated document record for ${filePath}:`);
      console.log(JSON.stringify(updateData, null, 2));
      return true;
    } catch (error) {
      console.error('Error updating document type:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}

/**
 * Main function to run the document type manager
 */
async function main() {
  const manager = new DocumentTypeManager();
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
Usage: ts-node document-type-manager.ts <command> [options]

Commands:
  list-types                 List all document types
  list-files                 List all file paths and their status
  update-status              Update file status based on disk existence
  lookup-prompt <promptName> Look up a prompt and its relationships
  classify <filePath>        Classify a document using the default prompt
    `);
    return;
  }
  
  switch (command) {
    case 'list-types':
      await manager.listDocumentTypes();
      break;
      
    case 'list-files':
      await manager.listAllFilePaths();
      break;
      
    case 'update-status':
      await manager.updateFileStatus();
      break;
      
    case 'lookup-prompt':
      const lookupPromptName = args[1];
      if (!lookupPromptName) {
        console.error('Please provide a prompt name');
        return;
      }
      await manager.lookupPrompt(lookupPromptName);
      break;
      
    case 'classify':
      const filePath = args[1];
      if (!filePath) {
        console.error('Please provide a file path to classify');
        return;
      }
      
      // Use the default prompt for classification
      const classifyPromptName = args[2] || 'markdown-document-classification-prompt';
      
      // Check if a document ID is provided directly (from batch classification)
      const documentId = args[3];
      
      const result = await manager.classifyDocument(filePath, classifyPromptName);
      if (result.success) {
        console.log(`\nClassification Result:`);
        console.log(`- Document Type: ${result.document_type_name}`);
        console.log(`- Document Type ID: ${result.document_type_id}`);
        console.log(`- Confidence: ${result.confidence}`);
        
        // If document ID is provided directly, update without prompting
        if (documentId && result.document_type_id) {
          console.log(`Updating document type for ID: ${documentId}`);
          
          // Build the complete update object including summary, title, and tags if available
          const updateObj: any = {
            document_type_id: result.document_type_id,
            updated_at: new Date().toISOString()
          };
          
          // Extract additional fields from the classification result if available
          if (result.summary) {
            if (typeof result.summary === 'string') {
              console.log(`Adding summary to document record: ${result.summary.substring(0, 50)}...`);
              updateObj.summary = result.summary;
            } else {
              console.log(`Adding summary object to document record`);
              updateObj.summary = result.summary;
            }
          }
          
          if (result.title) {
            console.log(`Adding title to document record: ${result.title}`);
            updateObj.title = result.title;
          }
          
          if (result.ai_generated_tags && Array.isArray(result.ai_generated_tags)) {
            console.log(`Adding ${result.ai_generated_tags.length} tags to document record`);
            updateObj.ai_generated_tags = result.ai_generated_tags;
          }
          
          // Add status_recommendation if available
          if (result.status_recommendation) {
            console.log(`Adding status_recommendation to document record: ${result.status_recommendation}`);
            updateObj.status_recommendation = result.status_recommendation;
          }
          else if (result.ai_assessment?.status_recommendation) {
            console.log(`Adding status_recommendation from ai_assessment: ${result.ai_assessment.status_recommendation}`);
            updateObj.status_recommendation = result.ai_assessment.status_recommendation;
          }
          
          // Get file stats and update size in metadata
          try {
            const fileStats = fs.statSync(filePath);
            console.log(`Adding file size to metadata: ${fileStats.size} bytes`);
            
            // First get existing metadata
            const { data: existingData } = await manager.supabase
              .from('documentation_files')
              .select('metadata')
              .eq('id', documentId)
              .single();
            
            const metadata = existingData?.metadata || {};
            updateObj.metadata = {
              ...metadata,
              size: fileStats.size,
              lastClassified: new Date().toISOString()
            };
          } catch (statsError) {
            console.error(`Error getting file stats: ${statsError instanceof Error ? statsError.message : 'Unknown error'}`);
          }
          
          // Use the public getter to access the supabase client
          const { error } = await manager.supabase
            .from('documentation_files')
            .update(updateObj)
            .eq('id', documentId);
            
          if (error) {
            console.error(`Error updating document: ${error.message}`);
          } else {
            console.log(`Successfully updated document for ID ${documentId}:`);
            console.log(JSON.stringify(updateObj, null, 2));
          }
        }
        // Otherwise ask if user wants to update the document type by file path
        else if (result.document_type_id) {
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          readline.question('Do you want to update the document type in the database? (y/n) ', async (answer: string) => {
            if (answer.toLowerCase() === 'y') {
              // Pass along the entire classification object to include summary, title, tags, etc.
              await manager.updateDocumentType(filePath, result.document_type_id!, result);
            }
            readline.close();
          });
        }
      } else {
        console.error(`Classification failed: ${result.error}`);
      }
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { DocumentTypeManager };