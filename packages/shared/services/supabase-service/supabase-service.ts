import { SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { Logger } from '../../utils/logger';
import { SupabaseClientService } from '../supabase-client';

/**
 * Common Supabase data types
 */

export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  prompt_type?: string;
  model?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Script {
  id: string;
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
  script_type?: string;
  usage_status?: string;
  last_analyzed?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Relationship {
  id?: string;
  source_id?: string;
  target_id?: string;
  asset_path?: string;
  relationship_type?: string;
  relationship_context?: string;
  prompt_id?: string;
  document_type_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentFile {
  id?: string;
  file_path: string;
  file_name?: string;
  file_extension?: string;
  document_type_id?: string;
  document_type?: string;
  summary?: string;
  tags?: string[];
  content?: string;
  content_preview?: string;
  word_count?: number;
  size_bytes?: number;
  is_archived?: boolean;
  archive_reason?: string;
  last_analyzed?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Enhanced Supabase service with common data operations
 */
export class SupabaseService {
  private client: SupabaseClient;
  
  constructor() {
    // Get client from singleton service
    this.client = SupabaseClientService.getInstance().getClient();
  }
  
  /**
   * Normalize a file path for consistent storage
   */
  static normalizePath(filePath: string): string {
    // Convert to forward slashes and remove double slashes
    let normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    
    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    
    return normalized;
  }
  
  /**
   * Environment diagnostics
   */
  static readEnvFile(filePath: string): {exists: boolean, variables: Record<string, string | null>} {
    try {
      if (fs.existsSync(filePath)) {
        Logger.debug(`Reading ${filePath} for diagnostics...`);
        const content = fs.readFileSync(filePath, 'utf8');
        const envVars: Record<string, string | null> = {};
        
        content.split('\n').forEach(line => {
          // Skip comments and empty lines
          if (line.trim() && !line.trim().startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('='); // Rejoin in case value contains =
            
            if (key) {
              // Mask sensitive values
              if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || 
                  key.includes('PASSWORD') || key.includes('PASS')) {
                envVars[key.trim()] = value ? '[REDACTED]' : null;
              } else {
                envVars[key.trim()] = value ? value.trim() : null;
              }
            }
          }
        });
        
        return { exists: true, variables: envVars };
      } else {
        return { exists: false, variables: {} };
      }
    } catch (error) {
      Logger.error(`Error reading ${filePath}:`, error);
      return { exists: false, variables: {} };
    }
  }
  
  /**
   * Get a prompt by name
   */
  async getPromptByName(name: string): Promise<Prompt | null> {
    try {
      Logger.debug(`Getting prompt by name: ${name}`);
      
      const { data, error } = await this.client
        .from('ai_prompts')
        .select('*')
        .eq('name', name)
        .single();
      
      if (error) {
        Logger.error(`Error getting prompt by name: ${name}`, error);
        return null;
      }
      
      return data as Prompt;
    } catch (error) {
      Logger.error(`Error getting prompt by name: ${name}`, error);
      return null;
    }
  }
  
  /**
   * Get all document types by category
   */
  async getDocumentTypesByCategory(category: string): Promise<DocumentType[]> {
    try {
      Logger.debug(`Getting document types by category: ${category}`);
      
      const { data, error } = await this.client
        .from('document_types')
        .select('*')
        .eq('category', category)
        .order('name');
      
      if (error) {
        Logger.error(`Error getting document types by category: ${category}`, error);
        return [];
      }
      
      return data as DocumentType[];
    } catch (error) {
      Logger.error(`Error getting document types by category: ${category}`, error);
      return [];
    }
  }
  
  /**
   * Get a document type by ID
   */
  async getDocumentTypeById(id: string): Promise<DocumentType | null> {
    try {
      Logger.debug(`Getting document type by ID: ${id}`);
      
      const { data, error } = await this.client
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        Logger.error(`Error getting document type by ID: ${id}`, error);
        return null;
      }
      
      return data as DocumentType;
    } catch (error) {
      Logger.error(`Error getting document type by ID: ${id}`, error);
      return null;
    }
  }
  
  /**
   * Upsert a script
   */
  async upsertScript(scriptData: Partial<Script>): Promise<Script | null> {
    try {
      Logger.debug(`Upserting script: ${scriptData.file_path}`);
      
      // Ensure tags is an array
      const tags = Array.isArray(scriptData.tags) ? scriptData.tags : 
                  (scriptData.tags ? [scriptData.tags] : []);
      
      const { data, error } = await this.client
        .from('scripts')
        .upsert({
          ...scriptData,
          tags,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error upserting script: ${scriptData.file_path}`, error);
        return null;
      }
      
      return data as Script;
    } catch (error) {
      Logger.error(`Error upserting script: ${scriptData.file_path}`, error);
      return null;
    }
  }
  
  /**
   * Add a relationship between documents
   */
  async addRelationship(relationshipData: Partial<Relationship>): Promise<Relationship | null> {
    try {
      Logger.debug(`Adding relationship: ${JSON.stringify(relationshipData)}`);
      
      const { data, error } = await this.client
        .from('relationships')
        .upsert({
          ...relationshipData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error adding relationship`, error);
        return null;
      }
      
      return data as Relationship;
    } catch (error) {
      Logger.error(`Error adding relationship`, error);
      return null;
    }
  }
  
  /**
   * Get relationships by prompt ID
   */
  async getRelationshipsByPromptId(promptId: string): Promise<Relationship[]> {
    try {
      Logger.debug(`Getting relationships by prompt ID: ${promptId}`);
      
      const { data, error } = await this.client
        .from('relationships')
        .select('*')
        .eq('prompt_id', promptId);
      
      if (error) {
        Logger.error(`Error getting relationships by prompt ID: ${promptId}`, error);
        return [];
      }
      
      return data as Relationship[];
    } catch (error) {
      Logger.error(`Error getting relationships by prompt ID: ${promptId}`, error);
      return [];
    }
  }
  
  /**
   * Get a document file by ID
   */
  async getDocumentFileById(id: string): Promise<DocumentFile | null> {
    try {
      Logger.debug(`Getting document file by ID: ${id}`);
      
      const { data, error } = await this.client
        .from('doc_files')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        Logger.error(`Error getting document file by ID: ${id}`, error);
        return null;
      }
      
      return data as DocumentFile;
    } catch (error) {
      Logger.error(`Error getting document file by ID: ${id}`, error);
      return null;
    }
  }
  
  /**
   * Get recent document files
   */
  async getRecentDocumentFiles(limit: number = 20): Promise<DocumentFile[]> {
    try {
      Logger.debug(`Getting ${limit} recent document files`);
      
      const { data, error } = await this.client
        .from('doc_files')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        Logger.error(`Error getting recent document files`, error);
        return [];
      }
      
      return data as DocumentFile[];
    } catch (error) {
      Logger.error(`Error getting recent document files`, error);
      return [];
    }
  }
  
  /**
   * Get untyped document files
   */
  async getUntypedDocumentFiles(limit: number = 20): Promise<DocumentFile[]> {
    try {
      Logger.debug(`Getting ${limit} untyped document files`);
      
      const { data, error } = await this.client
        .from('doc_files')
        .select('*')
        .is('document_type_id', null)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        Logger.error(`Error getting untyped document files`, error);
        return [];
      }
      
      return data as DocumentFile[];
    } catch (error) {
      Logger.error(`Error getting untyped document files`, error);
      return [];
    }
  }
}

// Export a singleton instance
export const supabaseService = new SupabaseService();