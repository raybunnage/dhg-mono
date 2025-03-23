#!/usr/bin/env ts-node
/**
 * Script to classify an untyped script by leveraging the prompt-lookup.sh functionality
 * This combines the best parts of prompt-lookup.ts and analyze-script.ts
 */

// Set debug log level to see more details
process.env.CLI_LOG_LEVEL = process.env.CLI_LOG_LEVEL || 'debug';

// Ensure both ANTHROPIC_API_KEY and CLAUDE_API_KEY are set correctly
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  console.log('Setting ANTHROPIC_API_KEY from CLAUDE_API_KEY for config compatibility');
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
} else if (process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
  console.log('Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY for API compatibility');
  process.env.CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { IncomingMessage } from 'http';
import { FileService } from '../../packages/cli/src/services/file-service';

// Add global declaration for TypeScript
declare global {
  interface ScriptMetadata {
    file_size?: number;
    has_shebang?: boolean;
    shebang?: string | null;
    is_executable?: boolean;
  }
  
  var scriptMetadata: ScriptMetadata;
}

// Initialize services
let supabase: SupabaseClient;
const fileService = new FileService();

// Initialize the global metadata object
global.scriptMetadata = {
  file_size: 0,
  has_shebang: false,
  shebang: null,
  is_executable: false
};

// Types from prompt-lookup.ts
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
  asset_id?: string;
  asset_path: string;
  document_type_id?: string;
  relationship_type: string;
  relationship_context?: string;
  created_at: string;
  updated_at: string;
}

// Types from analyze-script.ts
interface Classification {
  script_type_id?: string;
  summary?: Record<string, any>;
  tags?: string[];
  assessment?: Record<string, any>;
  metadata?: Record<string, any>;
  document_type_classification?: {
    selected_document_type_id: string;
    document_type_name: string;
    classification_confidence: number;
    classification_reasoning: string;
  };
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  messages: ClaudeMessage[];
}

interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  [key: string]: any;
}

interface Script {
  id: string;
  file_path: string;
  script_type_id?: string;
  // The content is not stored in the database - it will be read from the file_path
}

interface ScriptType {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

/**
 * Get Claude API key from one of the possible environment variables
 */
function getClaudeApiKey(): string {
  const possibleEnvVars: string[] = [
    'CLAUDE_API_KEY',
    'CLI_CLAUDE_API_KEY',
    'ANTHROPIC_API_KEY',
    'VITE_ANTHROPIC_API_KEY'
  ];
  
  console.log('🔍 Looking for Claude API key in environment variables:');
  for (const envVar of possibleEnvVars) {
    const isSet: boolean = !!process.env[envVar];
    console.log(`- ${envVar}: ${isSet ? 'set' : 'not set'}${isSet ? ' (length: ' + process.env[envVar]!.length + ')' : ''}`);
  }
  
  for (const envVar of possibleEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ Using ${envVar} for Claude API key`);
      return process.env[envVar] || '';
    }
  }
  
  console.error('❌ No Claude API key found in any environment variable');
  return '';
}

/**
 * Get a random untyped script from the database
 */
async function getUntypedScript(): Promise<Script | null> {
  try {
    console.log('🔍 Looking for untyped scripts in the database...');
    
    // First, count how many untyped scripts are available
    const { count, error: countError } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true })
      .is('script_type_id', null);
    
    if (countError) {
      console.error('❌ Error counting untyped scripts:', countError.message);
      return null;
    }
    
    if (!count || count === 0) {
      console.log('❌ No untyped scripts found in the database');
      return null;
    }
    
    console.log(`✅ Found ${count} untyped scripts in the database`);
    
    // Generate a random offset to select a random script
    // This ensures we don't always get the same script
    const randomOffset = Math.floor(Math.random() * count);
    console.log(`🎲 Randomly selecting script at offset ${randomOffset} of ${count}`);
    
    // Get a specific untyped script using the random offset
    // Note: We don't select 'content' field because it doesn't exist in the database
    // The actual script content will be read from the file_path later
    const { data, error } = await supabase
      .from('scripts')
      .select('id, file_path, script_type_id')
      .is('script_type_id', null)
      .range(randomOffset, randomOffset)
      .single();
    
    if (error) {
      console.error('❌ Error fetching random untyped script:', error.message);
      
      // Fallback to first script if random selection fails
      console.log('⚠️ Falling back to first untyped script...');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('scripts')
        .select('id, file_path, script_type_id')
        .is('script_type_id', null)
        .limit(1)
        .single();
      
      if (fallbackError || !fallbackData) {
        console.error('❌ Fallback also failed:', fallbackError?.message);
        return null;
      }
      
      console.log(`✅ Found fallback untyped script: ${fallbackData.file_path} (ID: ${fallbackData.id})`);
      console.log(`Script exists in database: true`);
      return fallbackData as Script;
    }
    
    if (!data) {
      console.log('❌ No untyped script found at random offset');
      return null;
    }
    
    console.log(`✅ Found random untyped script: ${data.file_path} (ID: ${data.id})`);
    console.log(`Script exists in database: true`);
    return data as Script;
  } catch (error) {
    console.error('❌ Error in getUntypedScript:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get script content from file path
 * Also populates metadata about the script file
 */
function getScriptContent(scriptPath: string): string | null {
  try {
    console.log(`📄 Attempting to read script file: ${scriptPath}`);
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Script file not found: ${scriptPath}`);
      return null;
    }
    
    const scriptContent: string = fs.readFileSync(scriptPath, 'utf8');
    
    // Get file stats to determine if it has a shebang, is executable, etc.
    try {
      const stats = fs.statSync(scriptPath);
      const isExecutable = !!(stats.mode & 0o111); // Check if any execute bit is set
      
      // Store metadata using file_size instead of size
      const scriptMetadata: ScriptMetadata = {
        file_size: scriptContent.length,
        has_shebang: scriptContent.startsWith('#!'),
        shebang: scriptContent.startsWith('#!') ? scriptContent.split('\n')[0] : null,
        is_executable: isExecutable
      };
      
      // Assign to global
      global.scriptMetadata = scriptMetadata;
      
      console.log(`✅ Successfully read script file (${scriptContent.length} bytes)`);
      console.log(`📊 Script metadata: ${JSON.stringify(global.scriptMetadata)}`);
    } catch (statError) {
      console.error(`⚠️ Could not get file stats: ${statError instanceof Error ? statError.message : 'Unknown error'}`);
    }
    
    return scriptContent;
  } catch (error) {
    console.error(`❌ Error reading script file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Get the script-analysis-prompt and related content directly from the database
 */
async function getScriptAnalysisPrompt(): Promise<Prompt | null> {
  try {
    console.log('🔍 Fetching "script-analysis-prompt" from database prompts table...');
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('name', 'script-analysis-prompt')
      .single();
    
    if (error) {
      console.error('❌ Error fetching script analysis prompt:', error.message);
      return null;
    }
    
    if (!data) {
      console.log('❌ No "script-analysis-prompt" found in prompts table');
      return null;
    }
    
    console.log(`✅ Retrieved script analysis prompt from database (ID: ${data.id})`);
    console.log(`Prompt description: ${data.description || 'No description'}`);
    
    // Log the metadata to see the SQL queries contained within
    if (data.metadata) {
      console.log('📊 PROMPT METADATA (contains the SQL queries):');
      console.log(JSON.stringify(data.metadata, null, 2));
      
      // Specifically log the SQL queries
      if (data.metadata.database_query) {
        console.log('📊 SQL QUERY FROM METADATA (database_query):');
        console.log(data.metadata.database_query);
      }
      
      if (data.metadata.databaseQuery) {
        console.log('📊 SQL QUERY FROM METADATA (databaseQuery):');
        console.log(data.metadata.databaseQuery);
      }
      
      if (data.metadata.databaseQuery2) {
        console.log('📊 SQL QUERY FROM METADATA (databaseQuery2):');
        console.log(data.metadata.databaseQuery2);
      }
    } else {
      console.log('⚠️ No metadata found in the prompt record');
    }
    
    return data as Prompt;
  } catch (error) {
    console.error('❌ Error in getScriptAnalysisPrompt:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get relationships for the prompt (from prompt-lookup.ts)
 */
async function getPromptRelationships(promptId: string): Promise<Relationship[]> {
  try {
    console.log(`🔍 Fetching relationships for prompt ID: ${promptId}`);
    const { data, error } = await supabase
      .from('prompt_relationships')
      .select('*')
      .eq('prompt_id', promptId);
    
    if (error) {
      console.error('❌ Error fetching prompt relationships:', error.message);
      return [];
    }
    
    console.log(`✅ Found ${data.length} relationships for the prompt`);
    return data as Relationship[];
  } catch (error) {
    console.error('❌ Error in getPromptRelationships:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Execute custom SQL query (similar to prompt-lookup.ts)
 */
async function executeCustomQuery(queryText: string): Promise<any[]> {
  try {
    console.log(`🔍 Executing custom SQL query: ${queryText}`);
    
    // Remove trailing semicolons which cause syntax errors in RPC calls
    queryText = queryText.trim().replace(/;+$/, '');
    
    // Execute custom query using RPC
    const { data, error } = await supabase.rpc('execute_sql', { sql: queryText });
    
    if (error) {
      console.error('❌ Error executing custom query:', error.message);
      return [];
    }
    
    const resultCount = Array.isArray(data) ? data.length : 0;
    console.log(`✅ SQL query returned ${resultCount} records`);
    
    // Log the first few records so we can see what data we're working with
    if (resultCount > 0) {
      console.log('📊 SAMPLE QUERY RESULTS (first 3 records):');
      console.log(JSON.stringify(data.slice(0, 3), null, 2));
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Error in executeCustomQuery:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Get document types from database using the exact SQL queries from the prompt metadata
 */
async function getScriptTypes(prompt: Prompt): Promise<ScriptType[]> {
  try {
    console.log('🔍 Fetching script types from database using prompt metadata queries...');
    
    if (!prompt.metadata) {
      console.error('❌ No metadata found in the prompt record');
      return [];
    }
    
    // If the prompt has a database query in metadata, use it - EXACTLY like prompt-lookup.ts does
    if (prompt.metadata.database_query) {
      console.log('📊 Using database_query from prompt metadata...');
      console.log('📊 EXACT SQL QUERY FROM METADATA:');
      console.log(prompt.metadata.database_query);
      
      const data = await executeCustomQuery(prompt.metadata.database_query);
      
      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} script types using custom query from prompt metadata`);
        console.log('📊 SCRIPT TYPES FROM DATABASE (all records):');
        console.log(JSON.stringify(data, null, 2));
        return data as ScriptType[];
      } else {
        console.log('⚠️ No results from database_query, falling back to next query');
      }
    }
    
    // Try the second database query if it exists - matching prompt-lookup.ts exactly
    if (prompt.metadata.databaseQuery) {
      console.log('📊 Using databaseQuery from prompt metadata...');
      console.log('📊 EXACT SQL QUERY FROM METADATA:');
      console.log(prompt.metadata.databaseQuery);
      
      const data = await executeCustomQuery(prompt.metadata.databaseQuery);
      
      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} script types using databaseQuery from prompt metadata`);
        console.log('📊 SCRIPT TYPES FROM DATABASE (all records):');
        console.log(JSON.stringify(data, null, 2));
        return data as ScriptType[];
      } else {
        console.log('⚠️ No results from databaseQuery, falling back to next query');
      }
    }
    
    // Try the third database query if it exists
    if (prompt.metadata.databaseQuery2) {
      console.log('📊 Using databaseQuery2 from prompt metadata...');
      console.log('📊 EXACT SQL QUERY FROM METADATA:');
      console.log(prompt.metadata.databaseQuery2);
      
      const data = await executeCustomQuery(prompt.metadata.databaseQuery2);
      
      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} script types using databaseQuery2 from prompt metadata`);
        console.log('📊 SCRIPT TYPES FROM DATABASE (all records):');
        console.log(JSON.stringify(data, null, 2));
        return data as ScriptType[];
      } else {
        console.log('⚠️ No results from databaseQuery2, falling back to standard query');
      }
    }
    
    // Standard query fallback - if we got here, none of the metadata queries worked
    console.log('📊 FALLING BACK to standard document_types query...');
    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .in('category', ['Script', 'Scripts', 'CLI', 'Command']);
    
    if (error) {
      console.error('❌ Error fetching script types:', error.message);
      return [];
    }
    
    if (data && data.length > 0) {
      console.log(`✅ Found ${data.length} script types using standard query`);
      console.log('📊 SCRIPT TYPES FROM DATABASE (all records):');
      console.log(JSON.stringify(data, null, 2));
      return data as ScriptType[];
    } else {
      console.error('❌ No script types found with any method');
      return [];
    }
  } catch (error) {
    console.error('❌ Error in getScriptTypes:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Call Claude API to analyze the script with ZERO temperature to avoid hallucinations
 */
async function callClaudeAPI(finalPrompt: string): Promise<Classification | null> {
  return new Promise<Classification | null>((resolve, reject) => {
    try {
      console.log('🧠 Calling Claude API for script classification...');
      const claudeApiKey: string = getClaudeApiKey();
      
      if (!claudeApiKey) {
        console.error('❌ No Claude API key available');
        return resolve(null);
      }
      
      const claudeRequest: ClaudeRequest = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0, // ZERO temperature to avoid hallucinations
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: finalPrompt
              }
            ]
          }
        ]
      };
      
      console.log(`🔧 Claude configuration: model=${claudeRequest.model}, temperature=${claudeRequest.temperature}, max_tokens=${claudeRequest.max_tokens}`);
      
      const requestData: string = JSON.stringify(claudeRequest);
      
      const options: https.RequestOptions = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };
      
      // Make the API request
      const req: http.ClientRequest = https.request(options, (res: IncomingMessage) => {
        let responseData: string = '';
        
        res.on('data', (chunk: Buffer) => {
          responseData += chunk.toString();
        });
        
        res.on('end', () => {
          try {
            const response: ClaudeResponse = JSON.parse(responseData);
            
            if (response && response.content) {
              const assistantMessage = response.content;
              if (assistantMessage && assistantMessage[0] && assistantMessage[0].text) {
                // Extract JSON from response
                const responseText: string = assistantMessage[0].text;
                const jsonMatch: RegExpMatchArray | null = responseText.match(/```json([\s\S]*?)```/);
                
                if (jsonMatch && jsonMatch[1]) {
                  const jsonStr: string = jsonMatch[1].trim();
                  console.log('✅ Successfully extracted JSON from Claude API response');
                  
                  try {
                    const parsedResult: Classification = JSON.parse(jsonStr);
                    console.log('✅ Successfully parsed JSON result from Claude API');
                    
                    // Add the metadata we collected when reading the script file
                    const scriptMetadata = global.scriptMetadata;
                    if (scriptMetadata) {
                      parsedResult.metadata = {
                        ...parsedResult.metadata,
                        ...scriptMetadata
                      };
                    }
                    
                    // Log the document type classification specifically
                    if (parsedResult.document_type_classification) {
                      console.log('📊 DOCUMENT TYPE CLASSIFICATION RESULT:');
                      console.log(JSON.stringify(parsedResult.document_type_classification, null, 2));
                    }
                    
                    if (parsedResult.script_type_id) {
                      console.log(`📊 SCRIPT TYPE ID FROM CLASSIFICATION: ${parsedResult.script_type_id}`);
                    }
                    
                    resolve(parsedResult);
                  } catch (parseError) {
                    console.error('❌ Error parsing JSON result:', parseError);
                    console.log('Raw JSON string that failed to parse:');
                    console.log(jsonStr);
                    resolve(null);
                  }
                } else {
                  // Try to find any JSON in the response
                  try {
                    const jsonStart: number = responseText.indexOf('{');
                    const jsonEnd: number = responseText.lastIndexOf('}');
                    
                    if (jsonStart >= 0 && jsonEnd > jsonStart) {
                      const jsonSubstring: string = responseText.substring(jsonStart, jsonEnd + 1);
                      
                      try {
                        const parsedResult: Classification = JSON.parse(jsonSubstring);
                        console.log('✅ Successfully parsed JSON result using fallback method');
                        
                        // Add the metadata we collected when reading the script file
                        const scriptMetadata = global.scriptMetadata;
                        if (scriptMetadata) {
                          parsedResult.metadata = {
                            ...parsedResult.metadata,
                            ...scriptMetadata
                          };
                        }
                        
                        // Log the document type classification specifically
                        if (parsedResult.document_type_classification) {
                          console.log('📊 DOCUMENT TYPE CLASSIFICATION RESULT:');
                          console.log(JSON.stringify(parsedResult.document_type_classification, null, 2));
                        }
                        
                        if (parsedResult.script_type_id) {
                          console.log(`📊 SCRIPT TYPE ID FROM CLASSIFICATION: ${parsedResult.script_type_id}`);
                        }
                        
                        resolve(parsedResult);
                      } catch (parseError) {
                        console.error('❌ Error parsing JSON with fallback method:', parseError);
                        console.log('Raw JSON substring that failed to parse:');
                        console.log(jsonSubstring);
                        resolve(null);
                      }
                    } else {
                      console.error('❌ Could not find JSON in Claude response');
                      console.log('Claude response text:');
                      console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
                      resolve(null);
                    }
                  } catch (e) {
                    console.error('❌ Failed to find JSON in response:', e);
                    resolve(null);
                  }
                }
              } else {
                console.error('❌ Invalid response format from Claude API');
                console.log('Response content structure:');
                console.log(JSON.stringify(response.content, null, 2));
                resolve(null);
              }
            } else {
              console.error('❌ Claude API call failed: Invalid response format');
              console.log('Response structure:');
              console.log(JSON.stringify(response, null, 2));
              resolve(null);
            }
          } catch (error) {
            console.error('❌ Error parsing Claude API response:', error);
            resolve(null);
          }
        });
      });
      
      req.on('error', (error: Error) => {
        console.error('❌ Error calling Claude API:', error);
        resolve(null);
      });
      
      req.write(requestData);
      req.end();
    } catch (error) {
      console.error('❌ Error in callClaudeAPI:', error instanceof Error ? error.message : 'Unknown error');
      resolve(null);
    }
  });
}

/**
 * Save the classification result to the database
 */
async function saveClassificationToDatabase(
  scriptId: string,
  classification: Classification
): Promise<boolean> {
  try {
    console.log(`💾 Saving classification for script ID: ${scriptId}`);
    console.log(`Classification data to save:`);
    console.log(`- script_type_id: ${classification.script_type_id || 'null'}`);
    
    if (classification.document_type_classification) {
      console.log(`- document_type_id (from classification.document_type_classification.selected_document_type_id): ${classification.document_type_classification.selected_document_type_id}`);
      console.log(`- document_type_name: ${classification.document_type_classification.document_type_name}`);
      console.log(`- document_type confidence: ${classification.document_type_classification.classification_confidence}`);
    } else {
      console.log(`- NO document_type_classification found in the AI response`);
    }
    
    console.log(`- summary fields: ${Object.keys(classification.summary || {}).join(', ') || 'none'}`);
    console.log(`- tags count: ${(classification.tags || []).length}`);
    console.log(`- assessment fields: ${Object.keys(classification.assessment || {}).join(', ') || 'none'}`);
    
    // First verify the script exists
    const { data: scriptCheck, error: checkError } = await supabase
      .from('scripts')
      .select('id, file_path')
      .eq('id', scriptId)
      .single();
    
    if (checkError || !scriptCheck) {
      console.error(`❌ Error verifying script exists: ${checkError?.message || 'Script not found'}`);
      return false;
    }
    
    console.log(`✅ Verified script exists in database (ID: ${scriptId}, Path: ${scriptCheck.file_path})`);
    
    // Now update the script with classification data
    // Note: We convert the 'size' property to 'file_size' for compatibility with the UI
    let metadata = classification.metadata || {};
    if (metadata.size && !metadata.file_size) {
      metadata.file_size = metadata.size;
      delete metadata.size;
    }
    
    const updateData = {
      script_type_id: classification.script_type_id || null,
      document_type_id: classification.document_type_classification?.selected_document_type_id || null,
      summary: classification.summary || null,
      ai_generated_tags: classification.tags || [],
      ai_assessment: classification.assessment || null,
      metadata: {
        ...metadata,
        document_type_classification: classification.document_type_classification || null
      },
      updated_at: new Date().toISOString()
    };
    
    console.log('📊 DATABASE UPDATE DATA:');
    console.log(JSON.stringify(updateData, null, 2));
    
    const { data: updateResult, error: updateError } = await supabase
      .from('scripts')
      .update(updateData)
      .eq('id', scriptId)
      .select('id, script_type_id, document_type_id, updated_at');
    
    if (updateError) {
      console.error('❌ Error updating script classification:', updateError.message);
      return false;
    }
    
    console.log('✅ Successfully updated script classification in database');
    console.log(`Database update result: ${JSON.stringify(updateResult)}`);
    
    // Verify if document_type_id was actually saved
    if (updateResult && updateResult.length > 0) {
      const updatedScript = updateResult[0];
      console.log(`📊 VERIFICATION - Updated script record:`);
      console.log(`- ID: ${updatedScript.id}`);
      console.log(`- script_type_id: ${updatedScript.script_type_id || 'null'}`);
      console.log(`- document_type_id: ${updatedScript.document_type_id || 'null'}`);
      console.log(`- updated_at: ${updatedScript.updated_at}`);
      
      if (updatedScript.document_type_id !== classification.document_type_classification?.selected_document_type_id) {
        console.warn(`⚠️ WARNING: document_type_id in database (${updatedScript.document_type_id}) doesn't match the one we tried to save (${classification.document_type_classification?.selected_document_type_id})`);
      } else {
        console.log(`✅ VERIFICATION SUCCESS: document_type_id properly saved in database`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error in saveClassificationToDatabase:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Main function to classify an untyped script
 */
async function classifyUntypedScript(): Promise<boolean> {
  try {
    // Step 1: Get a random untyped script from the database
    const script: Script | null = await getUntypedScript();
    if (!script) {
      console.log('❌ No untyped script available');
      return false;
    }
    
    // Step 2: Get the script content from disk
    const scriptContent: string | null = getScriptContent(script.file_path);
    if (!scriptContent) {
      console.log(`❌ Could not read script content from: ${script.file_path}`);
      return false;
    }
    
    // Step 3: Get the script analysis prompt from database
    const prompt: Prompt | null = await getScriptAnalysisPrompt();
    if (!prompt) {
      console.log('❌ Could not retrieve script analysis prompt');
      return false;
    }
    
    // Step 4: Get prompt relationships (for context)
    const relationships: Relationship[] = await getPromptRelationships(prompt.id);
    
    // Step 5: Get script types from the database USING THE SQL QUERIES FROM PROMPT METADATA
    const scriptTypes: ScriptType[] = await getScriptTypes(prompt);
    
    if (scriptTypes.length === 0) {
      console.log('❌ No script types available for classification');
      return false;
    }
    
    // Log the types we'll be using for classification to verify we're using the correct ones
    console.log('📋 Available script types for classification (ALL TYPES):');
    scriptTypes.forEach((type, index) => {
      console.log(`- ${type.id}: ${type.name} (${type.description || 'No description'})`);
    });
    
    // Step 6: Build the combined prompt with script content and script types
    let finalPrompt: string = prompt.content;
    
    // Add script types section
    finalPrompt += '\n\n## Available Script Types\n\n';
    finalPrompt += 'Please classify the script into one of these types:\n\n';
    
    // Format script types as a table
    finalPrompt += '| ID | Name | Description |\n';
    finalPrompt += '| --- | --- | --- |\n';
    
    for (const type of scriptTypes) {
      const id: string = type.id || '';
      const name: string = type.name || '';
      const description: string = type.description || '';
      finalPrompt += `| ${id} | ${name} | ${description} |\n`;
    }
    
    // Add the script content
    finalPrompt += `\n\n## Script to Analyze\n\nFile Path: ${script.file_path}\n\n`;
    finalPrompt += "```\n" + scriptContent + "\n```\n";
    
    // Create debug directory if it doesn't exist
    const debugDir: string = path.join(process.cwd(), 'docs', 'script-reports', 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Write the prompt to a file for debugging
    const debugFile: string = path.join(debugDir, 'last-classification-prompt.txt');
    fs.writeFileSync(debugFile, finalPrompt, 'utf8');
    console.log(`📝 Wrote prompt to ${debugFile} for debugging`);
    
    // Step 7: Call Claude API with the combined prompt
    const classification: Classification | null = await callClaudeAPI(finalPrompt);
    if (!classification) {
      console.log('❌ Failed to get classification from Claude API');
      return false;
    }
    
    // Log the classification result
    console.log('✅ Classification result:');
    console.log(JSON.stringify(classification, null, 2));
    
    // Log specifically the document_type_classification
    if (classification.document_type_classification) {
      console.log('📊 DOCUMENT TYPE CLASSIFICATION DETAILS:');
      console.log(`Selected ID: ${classification.document_type_classification.selected_document_type_id}`);
      console.log(`Document Type Name: ${classification.document_type_classification.document_type_name}`);
      console.log(`Confidence: ${classification.document_type_classification.classification_confidence}`);
      console.log(`Reasoning: ${classification.document_type_classification.classification_reasoning}`);
    }
    
    // Step 8: Save the classification to the database
    const saveResult: boolean = await saveClassificationToDatabase(script.id, classification);
    
    if (saveResult) {
      console.log(`✅ Successfully classified script: ${script.file_path}`);
    } else {
      console.log(`❌ Failed to save classification for script: ${script.file_path}`);
    }
    
    return saveResult;
    
  } catch (error) {
    console.error('❌ Error in classifyUntypedScript:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Initialize Supabase client
    const supabaseUrl: string = process.env.SUPABASE_URL || '';
    const supabaseKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    // Log whether we have the necessary credentials
    console.log('🔑 Checking credentials:');
    console.log(`- Supabase URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`);
    console.log(`- Supabase Key: ${supabaseKey ? '✅ Found' : '❌ Missing'}`);
    console.log(`- Claude API Key: ${getClaudeApiKey() ? '✅ Found' : '❌ Missing'}`);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      process.exit(1);
    }
    
    if (!getClaudeApiKey()) {
      console.error('❌ Missing Claude API key - please set one of the following environment variables: CLAUDE_API_KEY, CLI_CLAUDE_API_KEY, ANTHROPIC_API_KEY');
      process.exit(1);
    }
    
    // Initialize the Supabase client
    supabase = createClient(supabaseUrl, supabaseKey);
    
    // Run the classification
    console.log('🚀 Starting script classification process...');
    const success: boolean = await classifyUntypedScript();
    
    if (success) {
      console.log('✅ Script classification completed successfully');
      process.exit(0);
    } else {
      console.log('⚠️ Script classification failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the main function
main();