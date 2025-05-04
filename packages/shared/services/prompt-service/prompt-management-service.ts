/**
 * Prompt Management Service
 * 
 * A specialized service for managing prompts and their relationships in the database.
 * Extends the core PromptService with CRUD operations and relationship management.
 */
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../services/supabase-client';
import { Logger } from '../../utils';
import { PromptService, Prompt, PromptRelationship } from './prompt-service';
import { Database } from '../../../../supabase/types';

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

/**
 * Prompt Management Service Implementation
 */
export class PromptManagementService {
  private static instance: PromptManagementService;
  private promptService: PromptService;
  private supabaseService: SupabaseClientService;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.promptService = PromptService.getInstance();
    this.supabaseService = SupabaseClientService.getInstance();
    Logger.debug('PromptManagementService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PromptManagementService {
    if (!PromptManagementService.instance) {
      PromptManagementService.instance = new PromptManagementService();
    }
    return PromptManagementService.instance;
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
      Logger.error(`Error parsing frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    try {
      Logger.debug('Fetching prompt categories');
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('prompt_categories')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        Logger.error(`Error fetching prompt categories: ${error.message}`);
        return [];
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception fetching prompt categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    try {
      Logger.debug(`Creating new prompt category: ${name}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('prompt_categories')
        .insert([{
          name,
          description: description || null,
          parent_category_id: parentCategoryId || null
        }])
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error creating prompt category: ${error.message}`);
        return null;
      }
      
      Logger.debug(`Created new prompt category: ${data.name}`);
      return data;
    } catch (error) {
      Logger.error(`Exception creating prompt category: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Get all document types
   */
  public async getDocumentTypes(category?: string | string[]): Promise<DocumentType[]> {
    try {
      Logger.debug('Fetching document types');
      const supabase = this.supabaseService.getClient();
      
      let query = supabase
        .from('document_types')
        .select('*')
        .order('document_type', { ascending: true });
      
      // Apply category filter if provided
      if (category) {
        if (Array.isArray(category)) {
          // Filter by multiple categories
          query = query.in('category', category);
        } else {
          // Filter by a single category
          query = query.eq('category', category);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        Logger.error(`Error fetching document types: ${error.message}`);
        return [];
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception fetching document types: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
  
  /**
   * Get all prompts from the database
   */
  public async getDatabasePrompts(): Promise<DatabasePrompt[]> {
    try {
      Logger.debug('Fetching prompts from database');
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) {
        Logger.error(`Error fetching prompts: ${error.message}`);
        return [];
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception fetching prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
  
  /**
   * Get a prompt by ID
   */
  public async getPromptById(promptId: string): Promise<DatabasePrompt | null> {
    try {
      Logger.debug(`Fetching prompt with ID: ${promptId}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .single();
      
      if (error) {
        Logger.error(`Error fetching prompt by ID: ${error.message}`);
        return null;
      }
      
      // Parse content from JSON string if needed
      if (data && typeof data.content === 'string') {
        try {
          data.content = JSON.parse(data.content);
        } catch (parseError) {
          // If it fails to parse, it's probably already a string
          Logger.debug(`Content is already a string or failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
      
      return data;
    } catch (error) {
      Logger.error(`Exception fetching prompt by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Create a new prompt in the database
   */
  public async createPrompt(
    name: string,
    content: string,
    options: {
      description?: string;
      documentTypeId?: string;
      categoryId?: string;
      version?: string;
      status?: 'draft' | 'active' | 'deprecated' | 'archived';
      author?: string;
      tags?: string[];
      filePath?: string;
    } = {}
  ): Promise<DatabasePrompt | null> {
    try {
      Logger.debug(`Creating new prompt: ${name}`);
      
      // Parse frontmatter for additional metadata
      const { metadata: extractedMetadata } = this.parseMarkdownFrontmatter(content);
      
      // Build structured metadata
      const fileName = options.filePath || `${name.toLowerCase().replace(/\s+/g, '-')}.md`;
      const metadata = this.buildMetadataObject(extractedMetadata, content, fileName);
      
      const supabase = this.supabaseService.getClient();
      
      // Prepare data with handling for UUID fields
      const insertData: any = {
        name,
        description: options.description || extractedMetadata.description || null,
        content: JSON.stringify(content),
        metadata,
        version: options.version || extractedMetadata.version || '1.0',
        status: options.status || extractedMetadata.status || 'active',
        author: options.author || extractedMetadata.author || null,
        tags: options.tags || extractedMetadata.tags || [],
        file_path: options.filePath || fileName
      };
      
      // Add document_type_id if provided and valid
      if (options.documentTypeId && options.documentTypeId !== 'none') {
        insertData.document_type_id = options.documentTypeId;
      }
      
      // Add category_id if provided and valid
      if (options.categoryId && options.categoryId !== 'none') {
        insertData.category_id = options.categoryId;
      }
      
      // Create the prompt
      const { data, error } = await supabase
        .from('prompts')
        .insert([insertData])
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error creating prompt: ${error.message}`);
        return null;
      }
      
      Logger.debug(`Created new prompt: ${data.name}`);
      return data;
    } catch (error) {
      Logger.error(`Exception creating prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Update an existing prompt
   */
  public async updatePrompt(
    promptId: string,
    updates: {
      content?: string;
      description?: string;
      documentTypeId?: string | null;
      categoryId?: string | null;
      version?: string;
      status?: 'draft' | 'active' | 'deprecated' | 'archived';
      author?: string;
      tags?: string[];
      filePath?: string;
      metadata?: PromptMetadata;
    }
  ): Promise<DatabasePrompt | null> {
    try {
      Logger.debug(`Updating prompt with ID: ${promptId}`);
      
      // First, get the current prompt data
      const currentPrompt = await this.getPromptById(promptId);
      if (!currentPrompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Update content and generate new hash if content is provided
      if (updates.content) {
        updateData.content = JSON.stringify(updates.content);
        
        // Update metadata with new content hash if no custom metadata is provided
        if (!updates.metadata) {
          const newContentHash = this.generateContentHash(updates.content);
          updateData.metadata = {
            ...currentPrompt.metadata,
            hash: newContentHash,
            source: {
              ...currentPrompt.metadata.source,
              lastModified: new Date().toISOString()
            }
          };
        }
      }
      
      // Add description if provided
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      
      // Handle document_type_id (convert 'none' to null)
      if (updates.documentTypeId !== undefined) {
        updateData.document_type_id = updates.documentTypeId === 'none' ? null : updates.documentTypeId;
      }
      
      // Handle category_id (convert 'none' to null)
      if (updates.categoryId !== undefined) {
        updateData.category_id = updates.categoryId === 'none' ? null : updates.categoryId;
      }
      
      // Add other fields if provided
      if (updates.version) updateData.version = updates.version;
      if (updates.status) updateData.status = updates.status;
      if (updates.author !== undefined) updateData.author = updates.author;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.filePath) updateData.file_path = updates.filePath;
      
      // Use provided metadata if available
      if (updates.metadata) {
        updateData.metadata = updates.metadata;
      }
      
      // Update the prompt
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompts')
        .update(updateData)
        .eq('id', promptId)
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error updating prompt: ${error.message}`);
        return null;
      }
      
      Logger.debug(`Updated prompt: ${data.name}`);
      return data;
    } catch (error) {
      Logger.error(`Exception updating prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Import a prompt from a markdown file
   */
  public async importPromptFromMarkdown(
    fileContent: string,
    fileName: string,
    options: {
      documentTypeId?: string;
      categoryId?: string;
    } = {}
  ): Promise<DatabasePrompt | null> {
    try {
      Logger.debug(`Importing prompt from markdown: ${fileName}`);
      
      // Parse the markdown frontmatter
      const { metadata, content } = this.parseMarkdownFrontmatter(fileContent);
      
      // Create the prompt
      return await this.createPrompt(
        metadata.name || fileName.replace(/\.md$/, ''),
        content,
        {
          description: metadata.description,
          documentTypeId: options.documentTypeId,
          categoryId: options.categoryId,
          version: metadata.version,
          status: metadata.status,
          author: metadata.author,
          tags: metadata.tags,
          filePath: fileName
        }
      );
    } catch (error) {
      Logger.error(`Exception importing prompt from markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Export a prompt to markdown format
   */
  public async exportPromptToMarkdown(promptId: string): Promise<{ content: string; fileName: string } | null> {
    try {
      Logger.debug(`Exporting prompt with ID: ${promptId}`);
      
      // Get the prompt
      const prompt = await this.getPromptById(promptId);
      if (!prompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }
      
      // Build frontmatter
      const frontmatter: Record<string, any> = {
        name: prompt.name,
        description: prompt.description || '',
        version: prompt.version,
        status: prompt.status
      };
      
      // Add author if available
      if (prompt.author) {
        frontmatter.author = prompt.author;
      }
      
      // Add tags if available
      if (prompt.tags && prompt.tags.length > 0) {
        frontmatter.tags = prompt.tags;
      }
      
      // Add model and temperature from metadata if available
      if (prompt.metadata.aiEngine) {
        if (prompt.metadata.aiEngine.model) {
          frontmatter.model = prompt.metadata.aiEngine.model;
        }
        if (prompt.metadata.aiEngine.temperature) {
          frontmatter.temperature = prompt.metadata.aiEngine.temperature;
        }
        if (prompt.metadata.aiEngine.maxTokens) {
          frontmatter.maxTokens = prompt.metadata.aiEngine.maxTokens;
        }
      }
      
      // Add input/output schema if available
      if (prompt.metadata.usage) {
        if (prompt.metadata.usage.inputSchema) {
          frontmatter.inputSchema = prompt.metadata.usage.inputSchema;
        }
        if (prompt.metadata.usage.outputSchema) {
          frontmatter.outputSchema = prompt.metadata.usage.outputSchema;
        }
      }
      
      // Format frontmatter as YAML
      let markdownContent = '---\n';
      Object.entries(frontmatter).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          markdownContent += `${key}:\n`;
          value.forEach(item => {
            markdownContent += `  - ${item}\n`;
          });
        } else if (typeof value === 'object') {
          // For nested objects, add them as stringified JSON for simplicity
          markdownContent += `${key}: ${JSON.stringify(value)}\n`;
        } else {
          markdownContent += `${key}: ${value}\n`;
        }
      });
      markdownContent += '---\n\n';
      
      // Add the content
      markdownContent += prompt.content;
      
      // Generate filename
      const fileName = prompt.file_path || `${prompt.name.toLowerCase().replace(/\s+/g, '-')}.md`;
      
      return {
        content: markdownContent,
        fileName
      };
    } catch (error) {
      Logger.error(`Exception exporting prompt to markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Save a prompt to a file
   */
  public async savePromptToFile(promptId: string, outputPath?: string): Promise<string | null> {
    try {
      Logger.debug(`Saving prompt with ID: ${promptId} to file`);
      
      // Export the prompt to markdown
      const exportedPrompt = await this.exportPromptToMarkdown(promptId);
      if (!exportedPrompt) {
        throw new Error(`Failed to export prompt with ID ${promptId}`);
      }
      
      // Determine the output path
      const defaultPath = path.join(process.cwd(), 'prompts');
      const outputDir = outputPath || defaultPath;
      
      // Create the output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write the file
      const filePath = path.join(outputDir, exportedPrompt.fileName);
      fs.writeFileSync(filePath, exportedPrompt.content, 'utf8');
      
      Logger.debug(`Saved prompt to file: ${filePath}`);
      return filePath;
    } catch (error) {
      Logger.error(`Exception saving prompt to file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Delete a prompt from the database
   */
  public async deletePrompt(promptId: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting prompt with ID: ${promptId}`);
      
      const supabase = this.supabaseService.getClient();
      
      // First delete all relationships
      const { error: relationshipError } = await supabase
        .from('prompt_relationships')
        .delete()
        .eq('prompt_id', promptId);
      
      if (relationshipError) {
        Logger.error(`Error deleting prompt relationships: ${relationshipError.message}`);
        return false;
      }
      
      // Then delete the prompt
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', promptId);
      
      if (error) {
        Logger.error(`Error deleting prompt: ${error.message}`);
        return false;
      }
      
      Logger.debug(`Deleted prompt with ID: ${promptId}`);
      return true;
    } catch (error) {
      Logger.error(`Exception deleting prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Get documentation files from the database (for relationships)
   */
  public async getDocumentationFiles(limit: number = 500): Promise<DocumentationFile[]> {
    try {
      Logger.debug(`Fetching documentation files (limit: ${limit})`);
      const supabase = this.supabaseService.getClient();
      
      // Fetch files without additional filters
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .order('last_modified_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        Logger.error(`Error fetching documentation files: ${error.message}`);
        return [];
      }
      
      // Filter out files from file_types folder, archive folders, and .txt files
      const validFiles = (data || []).filter(file => 
        file && file.file_path && 
        !file.file_path.includes('/file_types/') && 
        !file.file_path.startsWith('file_types/') &&
        !file.file_path.includes('/.archive_docs/') &&
        !file.file_path.startsWith('.archive_docs/') &&
        !file.file_path.endsWith('.txt')
      );
      
      Logger.debug(`Fetched ${validFiles.length} documentation files`);
      return validFiles;
    } catch (error) {
      Logger.error(`Exception fetching documentation files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
  
  /**
   * Get relationships for a prompt
   */
  public async getPromptRelationshipsWithFiles(promptId: string): Promise<{
    relationships: PromptRelationship[];
    relatedFiles: DocumentationFile[];
    relatedPackageJsonFiles: PackageJsonRelationship[];
  }> {
    try {
      Logger.debug(`Fetching relationships for prompt with ID: ${promptId}`);
      
      // Get the prompt to access its metadata
      const prompt = await this.getPromptById(promptId);
      if (!prompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }
      
      // Get related asset IDs from metadata
      const relatedAssetIds = prompt.metadata.relatedAssets || [];
      
      // Get relationship data from prompt_relationships table
      const supabase = this.supabaseService.getClient();
      const { data: relationshipData, error } = await supabase
        .from('prompt_relationships')
        .select('*')
        .eq('prompt_id', promptId);
      
      if (error) {
        Logger.error(`Error fetching prompt relationships: ${error.message}`);
        throw error;
      }
      
      // Get all documentation files
      const allDocumentationFiles = await this.getDocumentationFiles();
      
      // Find related files in documentation_files table
      const relatedFiles = allDocumentationFiles.filter(file => 
        relatedAssetIds.includes(file.id)
      );
      
      // Extract package.json files from metadata
      const packageJsonFiles = prompt.metadata.packageJsonFiles || [];
      
      Logger.debug(`Found ${relationshipData?.length || 0} relationships, ${relatedFiles.length} related files, and ${packageJsonFiles.length} package.json files`);
      
      return {
        relationships: relationshipData || [],
        relatedFiles,
        relatedPackageJsonFiles: packageJsonFiles
      };
    } catch (error) {
      Logger.error(`Exception fetching prompt relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        relationships: [],
        relatedFiles: [],
        relatedPackageJsonFiles: []
      };
    }
  }
  
  /**
   * Update relationships for a prompt
   */
  public async updatePromptRelationships(
    promptId: string,
    selectedAssetIds: string[],
    relationshipSettings: Record<string, RelationshipSettings>,
    databaseQuery?: string,
    databaseQuery2?: string
  ): Promise<boolean> {
    try {
      Logger.debug(`Updating relationships for prompt with ID: ${promptId}`);
      
      // First, get the current prompt data
      const currentPrompt = await this.getPromptById(promptId);
      if (!currentPrompt) {
        throw new Error(`Prompt with ID ${promptId} not found`);
      }
      
      // Get all documentation files to filter package.json files
      const allDocumentationFiles = await this.getDocumentationFiles();
      
      // Separate "real" database assets and package.json files
      const databaseAssets = selectedAssetIds.filter(assetId => {
        const file = allDocumentationFiles.find(file => file.id === assetId);
        // Skip files with special isPackageJson flag in metadata
        return file && !(file.metadata && 'isPackageJson' in file.metadata && file.metadata.isPackageJson);
      });
      
      // Extract package.json files
      const packageJsonFiles = selectedAssetIds
        .filter(assetId => {
          const file = allDocumentationFiles.find(file => file.id === assetId);
          return file && file.metadata && 'isPackageJson' in file.metadata && file.metadata.isPackageJson;
        })
        .map(assetId => {
          const file = allDocumentationFiles.find(file => file.id === assetId);
          if (!file) return null;
          
          // Get settings for this file
          const settings = relationshipSettings[assetId] || {
            relationship_type: 'reference',
            relationship_context: '',
            description: 'Package.json file relationship',
            document_type_id: null
          };
          
          // Fix document_type_id: convert 'none' to null
          const docTypeId = settings.document_type_id === 'none' ? null : settings.document_type_id;
          
          // Create the package.json relationship
          return {
            id: file.id,
            path: file.file_path,
            title: file.title,
            document_type_id: docTypeId,
            context: settings.relationship_context,
            relationship_type: settings.relationship_type,
            description: settings.description,
            settings: {
              relationship_type: settings.relationship_type,
              relationship_context: settings.relationship_context,
              description: settings.description,
              document_type_id: docTypeId
            }
          };
        })
        .filter(Boolean) as PackageJsonRelationship[];
      
      // Update the prompt metadata
      const updatedMetadata = {
        ...currentPrompt.metadata,
        relatedAssets: selectedAssetIds,
        databaseQuery,
        databaseQuery2,
        packageJsonFiles
      };
      
      // Update the prompt
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompts')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', promptId)
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error updating prompt metadata: ${error.message}`);
        throw error;
      }
      
      // Get existing relationships
      const { data: existingRelationships, error: fetchError } = await supabase
        .from('prompt_relationships')
        .select('id, asset_id')
        .eq('prompt_id', promptId);
      
      if (fetchError) {
        Logger.error(`Error fetching existing relationships: ${fetchError.message}`);
        throw fetchError;
      }
      
      // Identify relationships to remove
      const existingAssetIds = existingRelationships?.map(rel => rel.asset_id) || [];
      const assetsToRemove = existingAssetIds.filter(id => !databaseAssets.includes(id));
      
      // Delete removed relationships
      if (assetsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('prompt_relationships')
          .delete()
          .eq('prompt_id', promptId)
          .in('asset_id', assetsToRemove);
        
        if (deleteError) {
          Logger.error(`Error deleting relationships: ${deleteError.message}`);
          throw deleteError;
        }
      }
      
      // Update or create relationships for database assets
      for (const assetId of databaseAssets) {
        // Get the file information
        const file = allDocumentationFiles.find(file => file.id === assetId);
        if (!file) continue;
        
        // Get the settings for this asset
        const settings = relationshipSettings[assetId] || {
          relationship_type: 'reference',
          relationship_context: '',
          description: `Generated relationship between prompt "${currentPrompt.name}" and asset "${file.title}"`,
          document_type_id: file.document_type_id || null
        };
        
        // Fix document_type_id: convert 'none' to null
        const docTypeId = settings.document_type_id === 'none' ? null : settings.document_type_id;
        
        // Check if this asset already exists in the relationships
        const isExistingAsset = existingAssetIds.includes(assetId);
        
        if (isExistingAsset) {
          // Update existing relationship
          const { error: updateError } = await supabase
            .from('prompt_relationships')
            .update({
              relationship_type: settings.relationship_type,
              relationship_context: settings.relationship_context,
              description: settings.description,
              document_type_id: docTypeId
            })
            .eq('prompt_id', promptId)
            .eq('asset_id', assetId);
          
          if (updateError) {
            Logger.error(`Error updating relationship: ${updateError.message}`);
            throw updateError;
          }
        } else {
          // Create new relationship
          const { error: insertError } = await supabase
            .from('prompt_relationships')
            .insert({
              prompt_id: promptId,
              asset_id: assetId,
              asset_path: file.file_path,
              relationship_type: settings.relationship_type,
              relationship_context: settings.relationship_context,
              document_type_id: docTypeId,
              description: settings.description
            });
          
          if (insertError) {
            Logger.error(`Error creating relationship: ${insertError.message}`);
            throw insertError;
          }
        }
      }
      
      Logger.debug(`Updated relationships for prompt with ID: ${promptId}`);
      return true;
    } catch (error) {
      Logger.error(`Exception updating prompt relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}

// Export singleton instance
export const promptManagementService = PromptManagementService.getInstance();