/**
 * Refactored SupabaseService using BusinessService base class
 * Provides business logic for common Supabase data operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService, ServiceDependencies } from '../base-classes/BusinessService';
import { HealthCheckResult, Logger } from '../base-classes/BaseService';
import * as path from 'path';
import * as fs from 'fs';

// Data interfaces
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
 * Enhanced Supabase service with dependency injection
 */
export class SupabaseService extends BusinessService {
  private client: SupabaseClient;

  constructor(supabaseClient: SupabaseClient, logger?: Logger) {
    super('SupabaseService', { supabaseClient }, logger);
    this.client = supabaseClient;
  }

  /**
   * Validate dependencies
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabaseClient) {
      throw new Error('SupabaseClient is required for SupabaseService');
    }
  }

  /**
   * Initialize the service (no-op for this service)
   */
  protected async initialize(): Promise<void> {
    // No initialization needed
    this.initialized = true;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test database connection
      const { error } = await this.client
        .from('document_types')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - startTime;

      if (error) {
        return {
          healthy: false,
          timestamp: new Date(),
          latencyMs,
          details: { error: error.message }
        };
      }

      return {
        healthy: true,
        timestamp: new Date(),
        latencyMs,
        details: { status: 'operational' }
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
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
      return { exists: false, variables: {} };
    }
  }

  /**
   * Get a prompt by name
   */
  async getPromptByName(name: string): Promise<Prompt | null> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('ai_prompts')
        .select('*')
        .eq('name', name)
        .single();
      
      if (error) {
        this.logger?.error(`Error getting prompt by name: ${name}`, error);
        return null;
      }
      
      return data as Prompt;
    }, {
      maxAttempts: 3,
      shouldRetry: (error) => {
        // Retry on network errors
        return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
      }
    });
  }

  /**
   * Get all document types by category
   */
  async getDocumentTypesByCategory(category: string): Promise<DocumentType[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('document_types')
        .select('*')
        .eq('category', category)
        .order('name');
      
      if (error) {
        this.logger?.error(`Error getting document types by category: ${category}`, error);
        return [];
      }
      
      return data as DocumentType[];
    });
  }

  /**
   * Get a document type by ID
   */
  async getDocumentTypeById(id: string): Promise<DocumentType | null> {
    // Validate input
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Document type ID must be a non-empty string');
      }
      return value;
    });

    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('document_types')
        .select('*')
        .eq('id', validatedId)
        .single();
      
      if (error) {
        this.logger?.error(`Error getting document type by ID: ${validatedId}`, error);
        return null;
      }
      
      return data as DocumentType;
    });
  }

  /**
   * Upsert a script with transaction support
   */
  async upsertScript(scriptData: Partial<Script>): Promise<Script | null> {
    // Validate input
    const validated = this.validateInput(scriptData, (data) => {
      if (!data.file_path) {
        throw new Error('Script file_path is required');
      }
      return data;
    });

    return this.withTransaction(async () => {
      // Ensure tags is an array
      const tags = Array.isArray(validated.tags) ? validated.tags : 
                  (validated.tags ? [validated.tags] : []);
      
      const { data, error } = await this.client
        .from('scripts')
        .upsert({
          ...validated,
          tags,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        this.logger?.error(`Error upserting script: ${validated.file_path}`, error);
        throw error; // Throw to trigger transaction rollback
      }
      
      return data as Script;
    });
  }

  /**
   * Add a relationship between documents
   */
  async addRelationship(relationshipData: Partial<Relationship>): Promise<Relationship | null> {
    return this.withTransaction(async () => {
      const { data, error } = await this.client
        .from('relationships')
        .upsert({
          ...relationshipData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        this.logger?.error(`Error adding relationship`, error);
        throw error;
      }
      
      return data as Relationship;
    });
  }

  /**
   * Get relationships by prompt ID
   */
  async getRelationshipsByPromptId(promptId: string): Promise<Relationship[]> {
    const validatedId = this.validateInput(promptId, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Prompt ID must be a non-empty string');
      }
      return value;
    });

    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('relationships')
        .select('*')
        .eq('prompt_id', validatedId);
      
      if (error) {
        this.logger?.error(`Error getting relationships by prompt ID: ${validatedId}`, error);
        return [];
      }
      
      return data as Relationship[];
    });
  }

  /**
   * Get a document file by ID
   */
  async getDocumentFileById(id: string): Promise<DocumentFile | null> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Document file ID must be a non-empty string');
      }
      return value;
    });

    return this.timeOperation('getDocumentFileById', async () => {
      const { data, error } = await this.client
        .from('doc_files')
        .select('*')
        .eq('id', validatedId)
        .single();
      
      if (error) {
        this.logger?.error(`Error getting document file by ID: ${validatedId}`, error);
        return null;
      }
      
      return data as DocumentFile;
    });
  }

  /**
   * Get recent document files
   */
  async getRecentDocumentFiles(limit: number = 20): Promise<DocumentFile[]> {
    const validatedLimit = this.validateInput(limit, (value) => {
      if (typeof value !== 'number' || value < 1 || value > 1000) {
        throw new Error('Limit must be a number between 1 and 1000');
      }
      return value;
    });

    return this.timeOperation('getRecentDocumentFiles', async () => {
      const { data, error } = await this.client
        .from('doc_files')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(validatedLimit);
      
      if (error) {
        this.logger?.error(`Error getting recent document files`, error);
        return [];
      }
      
      return data as DocumentFile[];
    });
  }

  /**
   * Get untyped document files
   */
  async getUntypedDocumentFiles(limit: number = 20): Promise<DocumentFile[]> {
    const validatedLimit = this.validateInput(limit, (value) => {
      if (typeof value !== 'number' || value < 1 || value > 1000) {
        throw new Error('Limit must be a number between 1 and 1000');
      }
      return value;
    });

    return this.timeOperation('getUntypedDocumentFiles', async () => {
      const { data, error } = await this.client
        .from('doc_files')
        .select('*')
        .is('document_type_id', null)
        .order('updated_at', { ascending: false })
        .limit(validatedLimit);
      
      if (error) {
        this.logger?.error(`Error getting untyped document files`, error);
        return [];
      }
      
      return data as DocumentFile[];
    });
  }
}