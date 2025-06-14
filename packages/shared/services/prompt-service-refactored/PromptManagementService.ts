/**
 * Prompt Management Service
 * 
 * A specialized service for managing prompts and their relationships in the database.
 * Refactored to extend BusinessService with proper dependency injection.
 */

import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { Logger } from '../base-classes/BaseService';
import { PromptService, Prompt, PromptRelationship } from '../prompt-service/prompt-service';
import { Database } from '../../../../supabase/types';

/**
 * Prompt Output Template structure
 */
export interface PromptOutputTemplate {
  id: string;
  name: string;
  description: string | null;
  template: any;
  created_at: string;
  updated_at: string;
}

/**
 * Prompt Template Association structure
 */
export interface PromptTemplateAssociation {
  id: string;
  prompt_id: string;
  template_id: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Documentation file structure (simplified from AI.tsx)
 */
export interface DocumentationFile {
  id: string;
  file_path: string;
  title: string;
  metadata?: {
    file_size?: number;
    size?: number;
    created?: string;
    modified?: string;
    isPrompt?: boolean;
  };
  last_modified_at?: string;
  created_at: string;
  updated_at: string;
  document_type_id?: string | null;
  status_recommendation?: string | null;
}

/**
 * Document type structure
 */
export interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  mime_type: string | null;
  category: string;
}

/**
 * Prompt category structure
 */
export interface PromptCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for relationship settings
 */
export interface RelationshipSettings {
  relationship_type: string;
  relationship_context: string;
  description: string;
  document_type_id: string | null;
}

/**
 * Package.json file relationship in prompt metadata
 */
export interface PackageJsonRelationship {
  id: string;
  path: string;
  title: string;
  document_type_id: string | null;
  context: string;
  relationship_type: string;
  description: string;
  settings: RelationshipSettings;
}

/**
 * Expanded prompt metadata structure
 */
export interface PromptMetadata {
  hash?: string;
  source?: {
    fileName?: string;
    createdAt?: string;
    lastModified?: string;
    gitInfo?: {
      branch: string;
      commitId: string;
    };
  };
  aiEngine?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  usage?: {
    inputSchema?: any;
    outputSchema?: any;
  };
  function?: {
    purpose?: string;
    successCriteria?: string;
    dependencies?: string[];
    estimatedCost?: string;
  };
  relatedAssets?: string[];
  databaseQuery?: string;
  databaseQuery2?: string;
  packageJsonFiles?: PackageJsonRelationship[];
}

/**
 * Extended prompt structure for database prompts
 */
export interface DatabasePrompt extends Prompt {
  document_type_id: string | null;
  category_id: string | null;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  author: string | null;
  tags: string[];
  file_path: string | null;
  metadata: PromptMetadata;
}

interface ServiceMetrics {
  totalPromptsCreated: number;
  totalPromptsUpdated: number;
  totalPromptsDeleted: number;
  totalCategoriesCreated: number;
  totalRelationshipsUpdated: number;
  totalTemplatesAssociated: number;
  totalMarkdownImports: number;
  totalMarkdownExports: number;
  totalErrors: number;
  lastError?: string;
  lastOperation?: string;
  lastOperationTime?: Date;
}

/**
 * Prompt Management Service Implementation
 */
export class PromptManagementService extends BusinessService {
  private metrics: ServiceMetrics = {
    totalPromptsCreated: 0,
    totalPromptsUpdated: 0,
    totalPromptsDeleted: 0,
    totalCategoriesCreated: 0,
    totalRelationshipsUpdated: 0,
    totalTemplatesAssociated: 0,
    totalMarkdownImports: 0,
    totalMarkdownExports: 0,
    totalErrors: 0
  };

  constructor(
    private supabase: SupabaseClient,
    private promptService: PromptService,
    logger?: Logger
  ) {
    super('PromptManagementService', { supabase, promptService }, logger);
  }

  /**
   * Validate required dependencies
   */
  protected validateDependencies(): void {
    if (!this.supabase) {
      throw new Error('PromptManagementService requires a Supabase client');
    }
    if (!this.promptService) {
      throw new Error('PromptManagementService requires a PromptService instance');
    }
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('PromptManagementService initialized');
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connectivity
      const { error } = await this.supabase
        .from('ai_prompts')
        .select('count')
        .limit(1);

      const healthy = !error;
      
      return {
        healthy,
        details: {
          ...this.metrics,
          error: error?.message
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          ...this.metrics,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate content hash for integrity verification
   */
  private generateContentHash(content: string): string {
    // In a real implementation, this would use crypto to create a SHA-256 hash
    // For now, using a simplified hash method for compatibility with AI.tsx
    return Buffer.from(encodeURIComponent(content)).toString('base64').slice(0, 40);
  }

  /**
   * Parse markdown frontmatter to extract metadata
   */
  public parseMarkdownFrontmatter(content: string): { metadata: Record<string, any>, content: string } {
    try {
      // Check if the content has frontmatter (starts with ---)
      if (!content.startsWith('---')) {
        return { 
          metadata: {}, 
          content 
        };
      }
      
      // Find the end of the frontmatter
      const endOfFrontmatter = content.indexOf('---', 3);
      if (endOfFrontmatter === -1) {
        return { metadata: {}, content };
      }
      
      const frontmatterText = content.substring(3, endOfFrontmatter).trim();
      const mainContent = content.substring(endOfFrontmatter + 3).trim();
      
      // Parse YAML frontmatter
      const metadata: Record<string, any> = {};
      frontmatterText.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          const value = valueParts.join(':').trim();
          
          // Handle arrays (formatted as "tags:\n  - tag1\n  - tag2")
          if (value === '') {
            const keyWithoutColon = key.trim();
            const arrayEntries: string[] = [];
            let i = frontmatterText.indexOf(`${key}:`);
            const lines = frontmatterText.substring(i).split('\n');
            
            for (let j = 1; j < lines.length; j++) {
              const line = lines[j];
              if (line.trim().startsWith('-')) {
                arrayEntries.push(line.trim().substring(1).trim());
              } else if (!line.trim().startsWith(' ')) {
                break;
              }
            }
            
            if (arrayEntries.length) {
              metadata[keyWithoutColon] = arrayEntries;
              return;
            }
          }
          
          // Handle string values
          metadata[key.trim()] = value;
        }
      });
      
      return { metadata, content: mainContent };
    } catch (error) {
      this.logger?.error(`Error parsing frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { metadata: {}, content };
    }
  }

  /**
   * Build metadata object for database storage
   */
  public buildMetadataObject(extractedMetadata: any, content: string, fileName: string): PromptMetadata {
    const contentHash = this.generateContentHash(content);
    
    return {
      hash: contentHash,
      source: {
        fileName,
        createdAt: new Date().toISOString(),
        gitInfo: {
          branch: 'main',
          commitId: 'none'
        }
      },
      aiEngine: {
        model: extractedMetadata.model || 'claude-3-sonnet-20240229',
        temperature: extractedMetadata.temperature || 0.7,
        maxTokens: extractedMetadata.maxTokens || 4000
      },
      usage: {
        inputSchema: extractedMetadata.inputSchema || {},
        outputSchema: extractedMetadata.outputSchema || 'text'
      },
      function: {
        purpose: extractedMetadata.purpose || extractedMetadata.description || '',
        successCriteria: extractedMetadata.successCriteria || '',
        dependencies: extractedMetadata.dependencies || [],
        estimatedCost: extractedMetadata.estimatedCost || ''
      }
    };
  }

  /**
   * Get all prompt categories
   */
  public async getPromptCategories(): Promise<PromptCategory[]> {
    this.metrics.lastOperation = 'getPromptCategories';
    this.metrics.lastOperationTime = new Date();

    try {
      this.logger?.debug('Fetching prompt categories');
      
      const { data, error } = await this.supabase
        .from('ai_prompt_categories')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) {
        this.handleError('Error fetching prompt categories', error);
        return [];
      }
      
      this.logger?.info(`Fetched ${data?.length || 0} prompt categories`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching prompt categories', error);
      return [];
    }
  }

  /**
   * Create a new prompt category
   */
  public async createPromptCategory(
    name: string,
    description?: string,
    parentCategoryId?: string
  ): Promise<PromptCategory | null> {
    this.metrics.lastOperation = 'createPromptCategory';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      this.validateInput({ name }, (data) => {
        if (!data.name || data.name.trim() === '') {
          throw new Error('Category name is required');
        }
        return data;
      });

      const { data, error } = await this.supabase
        .from('ai_prompt_categories')
        .insert({
          name,
          description: description || null,
          parent_category_id: parentCategoryId || null
        })
        .select()
        .single();
        
      if (error) {
        this.handleError('Error creating prompt category', error);
        return null;
      }
      
      this.metrics.totalCategoriesCreated++;
      this.logger?.info(`Created prompt category: ${name}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error creating prompt category', error);
      return null;
    }
  }

  /**
   * Get document types
   */
  public async getDocumentTypes(category?: string | string[]): Promise<DocumentType[]> {
    this.metrics.lastOperation = 'getDocumentTypes';
    this.metrics.lastOperationTime = new Date();

    try {
      let query = this.supabase
        .from('document_types')
        .select('*')
        .order('document_type', { ascending: true });
        
      if (category) {
        const categories = Array.isArray(category) ? category : [category];
        query = query.in('category', categories);
      }
      
      const { data, error } = await query;
      
      if (error) {
        this.handleError('Error fetching document types', error);
        return [];
      }
      
      this.logger?.info(`Fetched ${data?.length || 0} document types`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching document types', error);
      return [];
    }
  }

  /**
   * Get all database prompts
   */
  public async getDatabasePrompts(): Promise<DatabasePrompt[]> {
    this.metrics.lastOperation = 'getDatabasePrompts';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompts')
        .select('*')
        .order('updated_at', { ascending: false });
        
      if (error) {
        this.handleError('Error fetching database prompts', error);
        return [];
      }
      
      this.logger?.info(`Fetched ${data?.length || 0} database prompts`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching database prompts', error);
      return [];
    }
  }

  /**
   * Get prompt by ID
   */
  public async getPromptById(promptId: string): Promise<DatabasePrompt | null> {
    this.metrics.lastOperation = 'getPromptById';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompts')
        .select('*')
        .eq('id', promptId)
        .single();
        
      if (error) {
        this.handleError('Error fetching prompt by ID', error);
        return null;
      }
      
      this.logger?.info(`Fetched prompt: ${data?.name || promptId}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error fetching prompt by ID', error);
      return null;
    }
  }

  /**
   * Create a new prompt
   */
  public async createPrompt(
    name: string,
    content: string,
    description?: string,
    categoryId?: string,
    documentTypeId?: string,
    version: string = '1.0.0',
    status: 'draft' | 'active' | 'deprecated' | 'archived' = 'draft',
    author?: string,
    tags: string[] = [],
    filePath?: string,
    metadata?: PromptMetadata
  ): Promise<DatabasePrompt | null> {
    this.metrics.lastOperation = 'createPrompt';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      this.validateInput({ name, content }, (data) => {
        if (!data.name || data.name.trim() === '') {
          throw new Error('Prompt name is required');
        }
        if (!data.content || data.content.trim() === '') {
          throw new Error('Prompt content is required');
        }
        return data;
      });

      const { data, error } = await this.supabase
        .from('ai_prompts')
        .insert({
          name,
          content,
          description: description || null,
          category_id: categoryId || null,
          document_type_id: documentTypeId || null,
          version,
          status,
          author: author || null,
          tags,
          file_path: filePath || null,
          metadata: metadata || {}
        })
        .select()
        .single();
        
      if (error) {
        this.handleError('Error creating prompt', error);
        return null;
      }
      
      this.metrics.totalPromptsCreated++;
      this.logger?.info(`Created prompt: ${name}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error creating prompt', error);
      return null;
    }
  }

  /**
   * Update an existing prompt
   */
  public async updatePrompt(
    promptId: string,
    updates: Partial<{
      name: string;
      content: string;
      description: string;
      category_id: string;
      document_type_id: string;
      version: string;
      status: 'draft' | 'active' | 'deprecated' | 'archived';
      author: string;
      tags: string[];
      file_path: string;
      metadata: PromptMetadata;
    }>
  ): Promise<DatabasePrompt | null> {
    this.metrics.lastOperation = 'updatePrompt';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', promptId)
        .select()
        .single();
        
      if (error) {
        this.handleError('Error updating prompt', error);
        return null;
      }
      
      this.metrics.totalPromptsUpdated++;
      this.logger?.info(`Updated prompt: ${promptId}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error updating prompt', error);
      return null;
    }
  }

  /**
   * Import prompt from markdown file
   */
  public async importPromptFromMarkdown(
    filePath: string,
    categoryId?: string,
    documentTypeId?: string
  ): Promise<DatabasePrompt | null> {
    this.metrics.lastOperation = 'importPromptFromMarkdown';
    this.metrics.lastOperationTime = new Date();

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const { metadata, content: promptContent } = this.parseMarkdownFrontmatter(content);
      const fileName = path.basename(filePath);
      
      const builtMetadata = this.buildMetadataObject(metadata, promptContent, fileName);
      
      const prompt = await this.createPrompt(
        metadata.name || fileName.replace('.md', ''),
        promptContent,
        metadata.description,
        categoryId || metadata.category_id,
        documentTypeId || metadata.document_type_id,
        metadata.version || '1.0.0',
        metadata.status || 'draft',
        metadata.author,
        metadata.tags || [],
        filePath,
        builtMetadata
      );
      
      if (prompt) {
        this.metrics.totalMarkdownImports++;
        this.logger?.info(`Imported prompt from markdown: ${filePath}`);
      }
      
      return prompt;
    } catch (error) {
      this.handleError('Error importing prompt from markdown', error);
      return null;
    }
  }

  /**
   * Export prompt to markdown format
   */
  public async exportPromptToMarkdown(promptId: string): Promise<{ content: string; fileName: string } | null> {
    this.metrics.lastOperation = 'exportPromptToMarkdown';
    this.metrics.lastOperationTime = new Date();

    try {
      const prompt = await this.getPromptById(promptId);
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptId}`);
      }
      
      const frontmatter = [
        '---',
        `name: ${prompt.name}`,
        prompt.description ? `description: ${prompt.description}` : '',
        prompt.version ? `version: ${prompt.version}` : '',
        prompt.status ? `status: ${prompt.status}` : '',
        prompt.author ? `author: ${prompt.author}` : '',
        prompt.tags && prompt.tags.length ? `tags:\n${prompt.tags.map(t => `  - ${t}`).join('\n')}` : '',
        prompt.category_id ? `category_id: ${prompt.category_id}` : '',
        prompt.document_type_id ? `document_type_id: ${prompt.document_type_id}` : '',
        '---'
      ].filter(line => line && line !== '---' || line === '---').join('\n');
      
      const markdownContent = `${frontmatter}\n\n${prompt.content}`;
      const fileName = `${prompt.name.replace(/[^a-zA-Z0-9-]/g, '_')}.md`;
      
      this.metrics.totalMarkdownExports++;
      this.logger?.info(`Exported prompt to markdown: ${fileName}`);
      
      return { content: markdownContent, fileName };
    } catch (error) {
      this.handleError('Error exporting prompt to markdown', error);
      return null;
    }
  }

  /**
   * Save prompt to file
   */
  public async savePromptToFile(promptId: string, outputPath?: string): Promise<string | null> {
    this.metrics.lastOperation = 'savePromptToFile';
    this.metrics.lastOperationTime = new Date();

    try {
      const exported = await this.exportPromptToMarkdown(promptId);
      if (!exported) {
        return null;
      }
      
      const fullPath = outputPath 
        ? path.join(outputPath, exported.fileName)
        : exported.fileName;
        
      fs.writeFileSync(fullPath, exported.content, 'utf-8');
      
      this.logger?.info(`Saved prompt to file: ${fullPath}`);
      return fullPath;
    } catch (error) {
      this.handleError('Error saving prompt to file', error);
      return null;
    }
  }

  /**
   * Delete a prompt
   */
  public async deletePrompt(promptId: string): Promise<boolean> {
    this.metrics.lastOperation = 'deletePrompt';
    this.metrics.lastOperationTime = new Date();

    try {
      // Use transaction to delete relationships first
      return await this.withTransaction(async () => {
        // Delete relationships
        const { error: relError } = await this.supabase
          .from('ai_prompt_relationships')
          .delete()
          .eq('prompt_id', promptId);
          
        if (relError) {
          throw new Error(`Failed to delete prompt relationships: ${relError.message}`);
        }
        
        // Delete template associations
        const { error: templateError } = await this.supabase
          .from('ai_prompt_template_associations')
          .delete()
          .eq('prompt_id', promptId);
          
        if (templateError) {
          throw new Error(`Failed to delete template associations: ${templateError.message}`);
        }
        
        // Delete the prompt
        const { error: promptError } = await this.supabase
          .from('ai_prompts')
          .delete()
          .eq('id', promptId);
          
        if (promptError) {
          throw new Error(`Failed to delete prompt: ${promptError.message}`);
        }
        
        this.metrics.totalPromptsDeleted++;
        this.logger?.info(`Deleted prompt: ${promptId}`);
        return true;
      });
    } catch (error) {
      this.handleError('Error deleting prompt', error);
      return false;
    }
  }

  /**
   * Get documentation files
   */
  public async getDocumentationFiles(limit: number = 500): Promise<DocumentationFile[]> {
    this.metrics.lastOperation = 'getDocumentationFiles';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('doc_files')
        .select('*')
        .order('file_path', { ascending: true })
        .limit(limit);
        
      if (error) {
        this.handleError('Error fetching documentation files', error);
        return [];
      }
      
      this.logger?.info(`Fetched ${data?.length || 0} documentation files`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching documentation files', error);
      return [];
    }
  }

  /**
   * Get prompt relationships with files
   */
  public async getPromptRelationshipsWithFiles(promptId: string): Promise<{
    relationships: PromptRelationship[];
    files: DocumentationFile[];
  }> {
    this.metrics.lastOperation = 'getPromptRelationshipsWithFiles';
    this.metrics.lastOperationTime = new Date();

    try {
      // Get relationships
      const { data: relationships, error: relError } = await this.supabase
        .from('ai_prompt_relationships')
        .select('*')
        .eq('prompt_id', promptId)
        .order('created_at', { ascending: false });
        
      if (relError) {
        this.handleError('Error fetching prompt relationships', relError);
        return { relationships: [], files: [] };
      }
      
      // Get unique asset IDs
      const assetIds = [...new Set((relationships || [])
        .map(r => r.asset_id)
        .filter(id => id !== null && id !== undefined))];
        
      if (assetIds.length === 0) {
        return { relationships: relationships || [], files: [] };
      }
      
      // Get files for those assets
      const { data: files, error: fileError } = await this.supabase
        .from('doc_files')
        .select('*')
        .in('id', assetIds);
        
      if (fileError) {
        this.handleError('Error fetching related files', fileError);
        return { relationships: relationships || [], files: [] };
      }
      
      this.logger?.info(`Fetched ${relationships?.length || 0} relationships and ${files?.length || 0} files for prompt ${promptId}`);
      
      return {
        relationships: relationships || [],
        files: files || []
      };
    } catch (error) {
      this.handleError('Unexpected error fetching prompt relationships with files', error);
      return { relationships: [], files: [] };
    }
  }

  /**
   * Update prompt relationships
   */
  public async updatePromptRelationships(
    promptId: string,
    relationships: Array<{
      asset_id?: string;
      asset_path: string;
      document_type_id?: string;
      relationship_type: string;
      relationship_context?: string;
    }>
  ): Promise<boolean> {
    this.metrics.lastOperation = 'updatePromptRelationships';
    this.metrics.lastOperationTime = new Date();

    try {
      return await this.withTransaction(async () => {
        // Delete existing relationships
        const { error: deleteError } = await this.supabase
          .from('ai_prompt_relationships')
          .delete()
          .eq('prompt_id', promptId);
          
        if (deleteError) {
          throw new Error(`Failed to delete existing relationships: ${deleteError.message}`);
        }
        
        // Insert new relationships
        if (relationships.length > 0) {
          const relationshipsToInsert = relationships.map(rel => ({
            prompt_id: promptId,
            ...rel
          }));
          
          const { error: insertError } = await this.supabase
            .from('ai_prompt_relationships')
            .insert(relationshipsToInsert);
            
          if (insertError) {
            throw new Error(`Failed to insert new relationships: ${insertError.message}`);
          }
        }
        
        this.metrics.totalRelationshipsUpdated++;
        this.logger?.info(`Updated relationships for prompt ${promptId}: ${relationships.length} relationships`);
        return true;
      });
    } catch (error) {
      this.handleError('Error updating prompt relationships', error);
      return false;
    }
  }

  /**
   * Get prompt output templates
   */
  public async getPromptOutputTemplates(): Promise<PromptOutputTemplate[]> {
    this.metrics.lastOperation = 'getPromptOutputTemplates';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_output_templates')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) {
        this.handleError('Error fetching prompt output templates', error);
        return [];
      }
      
      this.logger?.info(`Fetched ${data?.length || 0} prompt output templates`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching prompt output templates', error);
      return [];
    }
  }

  /**
   * Get prompt output template by ID
   */
  public async getPromptOutputTemplateById(templateId: string): Promise<PromptOutputTemplate | null> {
    this.metrics.lastOperation = 'getPromptOutputTemplateById';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_output_templates')
        .select('*')
        .eq('id', templateId)
        .single();
        
      if (error) {
        this.handleError('Error fetching prompt output template by ID', error);
        return null;
      }
      
      this.logger?.info(`Fetched template: ${data?.name || templateId}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error fetching prompt output template by ID', error);
      return null;
    }
  }

  /**
   * Create prompt output template
   */
  public async createPromptOutputTemplate(
    name: string,
    description: string | null,
    template: any
  ): Promise<PromptOutputTemplate | null> {
    this.metrics.lastOperation = 'createPromptOutputTemplate';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      this.validateInput({ name, template }, (data) => {
        if (!data.name || data.name.trim() === '') {
          throw new Error('Template name is required');
        }
        if (!data.template) {
          throw new Error('Template content is required');
        }
        return data;
      });

      const { data, error } = await this.supabase
        .from('ai_prompt_output_templates')
        .insert({
          name,
          description,
          template
        })
        .select()
        .single();
        
      if (error) {
        this.handleError('Error creating prompt output template', error);
        return null;
      }
      
      this.logger?.info(`Created prompt output template: ${name}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error creating prompt output template', error);
      return null;
    }
  }

  /**
   * Update prompt output template
   */
  public async updatePromptOutputTemplate(
    templateId: string,
    updates: Partial<{
      name: string;
      description: string | null;
      template: any;
    }>
  ): Promise<PromptOutputTemplate | null> {
    this.metrics.lastOperation = 'updatePromptOutputTemplate';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_output_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .select()
        .single();
        
      if (error) {
        this.handleError('Error updating prompt output template', error);
        return null;
      }
      
      this.logger?.info(`Updated prompt output template: ${templateId}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error updating prompt output template', error);
      return null;
    }
  }

  /**
   * Delete prompt output template
   */
  public async deletePromptOutputTemplate(templateId: string): Promise<boolean> {
    this.metrics.lastOperation = 'deletePromptOutputTemplate';
    this.metrics.lastOperationTime = new Date();

    try {
      // Delete associations first
      const { error: assocError } = await this.supabase
        .from('ai_prompt_template_associations')
        .delete()
        .eq('template_id', templateId);
        
      if (assocError) {
        this.handleError('Error deleting template associations', assocError);
        return false;
      }
      
      // Delete the template
      const { error: templateError } = await this.supabase
        .from('ai_prompt_output_templates')
        .delete()
        .eq('id', templateId);
        
      if (templateError) {
        this.handleError('Error deleting prompt output template', templateError);
        return false;
      }
      
      this.logger?.info(`Deleted prompt output template: ${templateId}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error deleting prompt output template', error);
      return false;
    }
  }

  /**
   * Get prompt template associations
   */
  public async getPromptTemplateAssociations(promptId: string): Promise<{
    associations: PromptTemplateAssociation[];
    templates: PromptOutputTemplate[];
  }> {
    this.metrics.lastOperation = 'getPromptTemplateAssociations';
    this.metrics.lastOperationTime = new Date();

    try {
      // Get associations
      const { data: associations, error: assocError } = await this.supabase
        .from('ai_prompt_template_associations')
        .select('*')
        .eq('prompt_id', promptId)
        .order('priority', { ascending: true });
        
      if (assocError) {
        this.handleError('Error fetching prompt template associations', assocError);
        return { associations: [], templates: [] };
      }
      
      // Get template IDs
      const templateIds = [...new Set((associations || []).map(a => a.template_id))];
      
      if (templateIds.length === 0) {
        return { associations: associations || [], templates: [] };
      }
      
      // Get templates
      const { data: templates, error: templateError } = await this.supabase
        .from('ai_prompt_output_templates')
        .select('*')
        .in('id', templateIds);
        
      if (templateError) {
        this.handleError('Error fetching associated templates', templateError);
        return { associations: associations || [], templates: [] };
      }
      
      this.logger?.info(`Fetched ${associations?.length || 0} associations and ${templates?.length || 0} templates for prompt ${promptId}`);
      
      return {
        associations: associations || [],
        templates: templates || []
      };
    } catch (error) {
      this.handleError('Unexpected error fetching prompt template associations', error);
      return { associations: [], templates: [] };
    }
  }

  /**
   * Associate template with prompt
   */
  public async associateTemplateWithPrompt(
    promptId: string,
    templateId: string,
    priority: number = 0
  ): Promise<PromptTemplateAssociation | null> {
    this.metrics.lastOperation = 'associateTemplateWithPrompt';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('ai_prompt_template_associations')
        .insert({
          prompt_id: promptId,
          template_id: templateId,
          priority
        })
        .select()
        .single();
        
      if (error) {
        this.handleError('Error associating template with prompt', error);
        return null;
      }
      
      this.metrics.totalTemplatesAssociated++;
      this.logger?.info(`Associated template ${templateId} with prompt ${promptId}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error associating template with prompt', error);
      return null;
    }
  }

  /**
   * Unassociate template from prompt
   */
  public async unassociateTemplateFromPrompt(
    promptId: string,
    templateId: string
  ): Promise<boolean> {
    this.metrics.lastOperation = 'unassociateTemplateFromPrompt';
    this.metrics.lastOperationTime = new Date();

    try {
      const { error } = await this.supabase
        .from('ai_prompt_template_associations')
        .delete()
        .eq('prompt_id', promptId)
        .eq('template_id', templateId);
        
      if (error) {
        this.handleError('Error unassociating template from prompt', error);
        return false;
      }
      
      this.logger?.info(`Unassociated template ${templateId} from prompt ${promptId}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error unassociating template from prompt', error);
      return false;
    }
  }

  /**
   * Update template association priority
   */
  public async updateTemplateAssociationPriority(
    promptId: string,
    templateId: string,
    priority: number
  ): Promise<boolean> {
    this.metrics.lastOperation = 'updateTemplateAssociationPriority';
    this.metrics.lastOperationTime = new Date();

    try {
      const { error } = await this.supabase
        .from('ai_prompt_template_associations')
        .update({
          priority,
          updated_at: new Date().toISOString()
        })
        .eq('prompt_id', promptId)
        .eq('template_id', templateId);
        
      if (error) {
        this.handleError('Error updating template association priority', error);
        return false;
      }
      
      this.logger?.info(`Updated priority for template ${templateId} on prompt ${promptId} to ${priority}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error updating template association priority', error);
      return false;
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(message: string, error: any): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = error?.message || String(error);
    this.logger?.error(message, error);
  }
}