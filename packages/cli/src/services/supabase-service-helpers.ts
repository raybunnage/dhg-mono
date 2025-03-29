/**
 * Helper functions for the supabase-service
 * These are temporary wrappers until the full migration to the shared package is complete
 */

import { SupabaseClientService } from '@dhg/shared/services/supabase-client';
import { LoggerUtils } from '../utils/logger-utils';

export interface ScriptData {
  file_path: string;
  title?: string;
  language?: string;
  document_type?: string;
  summary?: string;
  tags?: string[];
  code_quality?: number;
  maintainability?: number;
  utility?: number;
  documentation?: number;
  relevance_score?: number;
  relevance_reasoning?: string;
  referenced?: boolean;
  status?: string;
  status_confidence?: number;
  status_reasoning?: string;
  last_analyzed?: string;
}

export interface ScriptRelationship {
  source_path: string;
  target_path: string;
  relationship_type: string;
  confidence: number;
  notes?: string;
}

/**
 * Gets a prompt by name from the database
 * @param name The name of the prompt
 * @returns The prompt content
 */
export interface Prompt {
  id: string;
  name: string;
  content: string;
}

// Get a singleton instance of the Supabase client
const supabaseClientService = SupabaseClientService.getInstance();

/**
 * Gets a prompt by name from the database
 * @param name The name of the prompt
 * @returns The prompt content
 */
export async function getPromptByName(name: string): Promise<Prompt> {
  LoggerUtils.debug(`Getting prompt by name: ${name}`);
  
  try {
    const supabase = supabaseClientService.getClient();
    
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('name', name)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      // Return a fallback prompt if not found in the database
      LoggerUtils.warn(`Prompt not found in database: ${name}, using fallback`);
      return {
        id: 'fallback-id',
        name: name,
        content: `Analyze the script file and provide the following information:

1. Script Purpose: Identify the primary purpose and functionality of the script.
2. Dependencies: List external tools, libraries, and commands used.
3. Input/Output: Describe what inputs the script expects and what outputs it produces.
4. Implementation Details: Highlight key implementation aspects and techniques.
5. Potential Issues: Identify any potential bugs, edge cases, or security concerns.
6. Improvement Suggestions: Suggest ways to enhance the script's functionality or readability.

Format your response as JSON with the following structure:
{
  "purpose": "Brief description of what the script does",
  "dependencies": ["list", "of", "dependencies"],
  "input_output": {
    "inputs": ["list", "of", "inputs"],
    "outputs": ["list", "of", "outputs"]
  },
  "implementation_details": "Description of key implementation aspects",
  "potential_issues": ["list", "of", "potential", "issues"],
  "improvement_suggestions": ["list", "of", "suggestions"]
}`
      };
    }
    
    return data as Prompt;
  } catch (error) {
    LoggerUtils.error(`Error getting prompt by name: ${name}`, error);
    throw new Error(`Failed to get prompt by name: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Upserts a script into the database
 * @param scriptData The script data to upsert
 * @returns The upserted script
 */
export async function upsertScript(scriptData: ScriptData): Promise<any> {
  LoggerUtils.debug(`Upserting script: ${scriptData.file_path}`);
  
  try {
    const supabase = supabaseClientService.getClient();
    
    // Ensure tags are an array
    const tagsArray = Array.isArray(scriptData.tags) ? scriptData.tags : 
                     (scriptData.tags ? [scriptData.tags] : []);
    
    const { data, error } = await supabase
      .from('scripts')
      .upsert({
        ...scriptData,
        tags: tagsArray,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    LoggerUtils.error(`Error upserting script: ${scriptData.file_path}`, error);
    throw new Error(`Failed to upsert script: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Adds a script relationship to the database
 * @param relationship The relationship to add
 * @returns The added relationship
 */
export async function addScriptRelationship(relationship: ScriptRelationship): Promise<any> {
  LoggerUtils.debug(`Adding script relationship: ${relationship.source_path} -> ${relationship.target_path}`);
  
  try {
    const supabase = supabaseClientService.getClient();
    
    const { data, error } = await supabase
      .from('script_relationships')
      .upsert({
        ...relationship,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    LoggerUtils.error(`Error adding script relationship: ${relationship.source_path} -> ${relationship.target_path}`, error);
    throw new Error(`Failed to add script relationship: ${error instanceof Error ? error.message : String(error)}`);
  }
}