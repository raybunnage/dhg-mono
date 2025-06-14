/**
 * Prompt Service (Refactored)
 * 
 * A central service for managing AI prompts across the application.
 * Handles prompt retrieval, relationships, metadata extraction, and database queries.
 * 
 * Refactored to extend SingletonService for proper resource management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SingletonService } from '../base-classes/SingletonService';
import { Logger } from '../../utils';
import { FileService } from '../file-service/file-service';
import { claudeService } from '@shared/services/claude-service';
import { SupabaseClientService } from '../../services/supabase-client';
import { promptOutputTemplateService, PromptOutputTemplate } from './prompt-output-templates';

// Environment abstraction for Node.js dependencies
interface EnvironmentAdapter {
  readFileSync(path: string, encoding: string): string;
  existsSync(path: string): boolean;
  joinPath(...paths: string[]): string;
  resolvePath(path: string): string;
  isAbsolute(path: string): boolean;
}

// Node.js environment adapter
class NodeEnvironmentAdapter implements EnvironmentAdapter {
  private fs = require('fs');
  private path = require('path');

  readFileSync(path: string, encoding: string): string {
    return this.fs.readFileSync(path, encoding);
  }

  existsSync(path: string): boolean {
    return this.fs.existsSync(path);
  }

  joinPath(...paths: string[]): string {
    return this.path.join(...paths);
  }

  resolvePath(path: string): string {
    return this.path.resolve(path);
  }

  isAbsolute(path: string): boolean {
    return this.path.isAbsolute(path);
  }
}

// Browser environment adapter (throws errors for file operations)
class BrowserEnvironmentAdapter implements EnvironmentAdapter {
  readFileSync(path: string, encoding: string): string {
    throw new Error('File system access not supported in browser environment');
  }

  existsSync(path: string): boolean {
    return false;
  }

  joinPath(...paths: string[]): string {
    return paths.join('/');
  }

  resolvePath(path: string): string {
    return path;
  }

  isAbsolute(path: string): boolean {
    return path.startsWith('/') || path.startsWith('http');
  }
}

/**
 * Prompt data structure
 */
export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

/**
 * Prompt relationship data structure
 */
export interface PromptRelationship {
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

/**
 * Options for loading a prompt
 */
export interface PromptLoadOptions {
  includeDatabaseQueries?: boolean;
  includeRelationships?: boolean;
  includeRelatedFiles?: boolean;
  executeQueries?: boolean;
  returnAsMarkdown?: boolean;
  returnAll?: boolean;
  includeOutputTemplates?: boolean;
}

/**
 * Results from loading a prompt with relationships and queries
 */
export interface PromptLoadResult {
  prompt: Prompt | null;
  relationships: PromptRelationship[];
  relatedFiles: {
    relationship: PromptRelationship;
    content: string;
    stats?: {
      lines: number;
      size: number;
    };
  }[];
  databaseQueries: {
    queryName: string;
    queryText: string;
    queryResults: any;
  }[];
  outputTemplates?: {
    id: string;
    name: string;
    template: any;
    priority: number;
  }[];
  combinedContent: string;
}

interface PromptServiceConfig {
  environment?: 'node' | 'browser' | 'auto';
  enableCaching?: boolean;
  cacheTimeout?: number;
  promptDirectory?: string;
}

interface ServiceMetrics {
  totalPromptsLoaded: number;
  totalRelationshipsLoaded: number;
  totalQueriesExecuted: number;
  cacheHits: number;
  cacheMisses: number;
  averageLoadTime: number;
  lastActivity: Date | null;
}

/**
 * Prompt Service Implementation
 * Refactored to extend SingletonService
 */
class PromptService extends SingletonService {
  private static instance: PromptService;
  private fileService: FileService;
  private supabaseService: SupabaseClientService;
  private supabase: SupabaseClient;
  private envAdapter: EnvironmentAdapter;
  private config: PromptServiceConfig;
  private promptCache: Map<string, { prompt: Prompt; timestamp: number }> = new Map();
  
  // Metrics
  private metrics: ServiceMetrics = {
    totalPromptsLoaded: 0,
    totalRelationshipsLoaded: 0,
    totalQueriesExecuted: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLoadTime: 0,
    lastActivity: null
  };

  /**
   * Create a new Prompt service
   * Private constructor to enforce singleton pattern
   */
  protected constructor(config: PromptServiceConfig = {}) {
    super('PromptService');
    
    this.config = {
      environment: 'auto',
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      promptDirectory: 'prompts',
      ...config
    };

    // Initialize services
    this.fileService = new FileService();
    this.supabaseService = SupabaseClientService.getInstance();
    this.supabase = this.supabaseService.getClient();
    
    // Set up environment adapter
    const environment = this.config.environment === 'auto' ? this.detectEnvironment() : this.config.environment!;
    this.envAdapter = environment === 'node' ? new NodeEnvironmentAdapter() : new BrowserEnvironmentAdapter();
    
    this.logger?.debug('PromptService initialized with SupabaseClientService');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: PromptServiceConfig): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService(config);
    }
    return PromptService.instance;
  }

  /**
   * Initialize the service (BaseService requirement)
   */
  protected async initialize(): Promise<void> {
    try {
      // Test database connection
      const { error } = await this.supabase.from('ai_prompts').select('count').limit(1);
      if (error) {
        this.logger?.warn('PromptService: Database connection test failed', { error: error.message });
      }

      this.logger?.info('PromptService: Service initialized successfully');
    } catch (error) {
      this.logger?.error('PromptService: Failed to initialize service', { error });
      throw error;
    }
  }

  /**
   * Release resources (SingletonService requirement)
   */
  protected async releaseResources(): Promise<void> {
    try {
      // Clear cache
      this.promptCache.clear();
      
      // Clear any pending operations
      this.metrics.lastActivity = new Date();
      
      this.logger?.info('PromptService: Resources released successfully');
    } catch (error) {
      this.logger?.error('PromptService: Error during resource release', { error });
      throw error;
    }
  }

  /**
   * Cleanup method (BaseService requirement)
   */
  protected async cleanup(): Promise<void> {
    await this.releaseResources();
  }

  /**
   * Check service health (BaseService requirement)
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connection
      const { error } = await this.supabase.from('ai_prompts').select('count').limit(1);
      
      const details = {
        databaseConnection: !error,
        cacheSize: this.promptCache.size,
        environment: this.config.environment,
        metrics: this.metrics,
        config: {
          caching: this.config.enableCaching,
          cacheTimeout: this.config.cacheTimeout
        }
      };

      const healthy = !error;
      
      return { healthy, details, timestamp: new Date() };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          databaseConnection: false,
          cacheSize: this.promptCache.size
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
   * Detect if running in Node.js or browser environment
   */
  private detectEnvironment(): 'node' | 'browser' {
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      return 'node';
    }
    return 'browser';
  }

  /**
   * Clear the prompt cache
   */
  public clearCache(): void {
    this.promptCache.clear();
    this.logger?.debug('Prompt cache cleared');
  }

  /**
   * Get a prompt by name
   * Tries database first, then falls back to filesystem
   */
  public async getPromptByName(promptName: string): Promise<Prompt | null> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // Check cache first if enabled
      if (this.config.enableCaching) {
        const cached = this.promptCache.get(promptName);
        if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout!) {
          this.metrics.cacheHits++;
          this.logger?.debug(`Cache hit for prompt '${promptName}'`);
          return cached.prompt;
        }
      }
      
      this.metrics.cacheMisses++;
      
      // First try to get the prompt from the database
      try {
        this.logger?.debug(`Looking for prompt '${promptName}' in database`);
        
        const { data, error } = await this.supabase
          .from('ai_prompts')
          .select('*')
          .eq('name', promptName)
          .limit(1)
          .single();
        
        if (error) {
          this.logger?.debug(`Error fetching prompt from database: ${error.message}`);
        } else if (data) {
          this.logger?.debug(`Found prompt '${promptName}' in database`);
          const prompt = data as Prompt;
          
          // Cache the prompt
          if (this.config.enableCaching) {
            this.promptCache.set(promptName, { prompt, timestamp: Date.now() });
          }
          
          this.updateMetrics(startTime);
          return prompt;
        } else {
          this.logger?.debug(`Prompt '${promptName}' not found in database`);
        }
      } catch (dbError) {
        this.logger?.debug(`Database error when fetching prompt: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      
      // If database fetch fails and we're in Node.js environment, try the file system
      if (this.detectEnvironment() === 'node') {
        this.logger?.debug(`Trying to find prompt '${promptName}' in file system`);
        
        // Try multiple possible file locations
        const possiblePaths = [
          this.envAdapter.joinPath(this.config.promptDirectory!, `${promptName}.md`),
          this.envAdapter.joinPath(this.config.promptDirectory!, promptName),
          this.envAdapter.joinPath('.', 'prompts', `${promptName}.md`),
          this.envAdapter.joinPath('.', 'prompts', promptName)
        ];
        
        for (const promptPath of possiblePaths) {
          if (this.envAdapter.existsSync(promptPath)) {
            try {
              const content = this.envAdapter.readFileSync(promptPath, 'utf8');
              this.logger?.debug(`Found prompt '${promptName}' at ${promptPath}`);
              
              const prompt: Prompt = {
                id: `file_${promptName}`,
                name: promptName,
                content: content,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              // Cache the prompt
              if (this.config.enableCaching) {
                this.promptCache.set(promptName, { prompt, timestamp: Date.now() });
              }
              
              this.updateMetrics(startTime);
              return prompt;
            } catch (fileError) {
              this.logger?.error(`Error reading prompt file at ${promptPath}`, { error: fileError });
            }
          }
        }
      }
      
      this.logger?.warn(`Prompt '${promptName}' not found in database or file system`);
      this.updateMetrics(startTime);
      return null;
    } catch (error) {
      this.logger?.error(`Error getting prompt '${promptName}'`, { error });
      this.updateMetrics(startTime);
      return null;
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(startTime: number): void {
    const duration = Date.now() - startTime;
    const totalTime = this.metrics.averageLoadTime * this.metrics.totalPromptsLoaded;
    this.metrics.totalPromptsLoaded++;
    this.metrics.averageLoadTime = (totalTime + duration) / this.metrics.totalPromptsLoaded;
    this.metrics.lastActivity = new Date();
  }

  /**
   * Get all prompts from the database
   */
  public async getAllPrompts(): Promise<Prompt[]> {
    this.ensureInitialized();
    
    try {
      this.logger?.debug('Fetching all prompts from database');
      
      const { data, error } = await this.supabase
        .from('ai_prompts')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        this.logger?.error('Error fetching all prompts', { error });
        throw error;
      }
      
      this.logger?.info(`Found ${data?.length || 0} prompts in database`);
      return data as Prompt[];
    } catch (error) {
      this.logger?.error('Failed to get all prompts', { error });
      throw error;
    }
  }

  /**
   * Get prompt relationships
   */
  public async getPromptRelationships(promptId: string): Promise<PromptRelationship[]> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('prompt_template_associations')
        .select('*')
        .eq('prompt_id', promptId)
        .order('created_at', { ascending: true });
      
      if (error) {
        this.logger?.error('Error fetching prompt relationships', { error });
        throw error;
      }
      
      this.metrics.totalRelationshipsLoaded += data?.length || 0;
      return data as PromptRelationship[];
    } catch (error) {
      this.logger?.error('Failed to get prompt relationships', { error });
      throw error;
    }
  }

  /**
   * Execute database queries from prompt content
   */
  public async executeDatabaseQueries(content: string): Promise<{ queryName: string; queryText: string; queryResults: any }[]> {
    this.ensureInitialized();
    
    const results: { queryName: string; queryText: string; queryResults: any }[] = [];
    
    // Pattern to match database query blocks in markdown
    const queryPattern = /```sql:(\w+)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = queryPattern.exec(content)) !== null) {
      const queryName = match[1];
      const queryText = match[2].trim();
      
      try {
        this.logger?.debug(`Executing query '${queryName}'`);
        
        // Execute the query
        const { data, error } = await this.supabase.rpc('execute_prompt_query', {
          query_text: queryText
        });
        
        if (error) {
          this.logger?.error(`Error executing query '${queryName}'`, { error });
          results.push({
            queryName,
            queryText,
            queryResults: { error: error.message }
          });
        } else {
          results.push({
            queryName,
            queryText,
            queryResults: data
          });
        }
        
        this.metrics.totalQueriesExecuted++;
      } catch (error) {
        this.logger?.error(`Failed to execute query '${queryName}'`, { error });
        results.push({
          queryName,
          queryText,
          queryResults: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }
    
    return results;
  }

  /**
   * Load a prompt with all its relationships and execute queries
   */
  public async loadPrompt(promptName: string, options: PromptLoadOptions = {}): Promise<PromptLoadResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const result: PromptLoadResult = {
        prompt: null,
        relationships: [],
        relatedFiles: [],
        databaseQueries: [],
        outputTemplates: [],
        combinedContent: ''
      };
      
      // Get the prompt
      result.prompt = await this.getPromptByName(promptName);
      if (!result.prompt) {
        return result;
      }
      
      // Get relationships if requested
      if (options.includeRelationships) {
        result.relationships = await this.getPromptRelationships(result.prompt.id);
      }
      
      // Load related files if requested
      if (options.includeRelatedFiles && result.relationships.length > 0) {
        for (const relationship of result.relationships) {
          if (relationship.asset_path) {
            try {
              const content = await this.fileService.readFile(relationship.asset_path);
              const stats = await this.fileService.getFileStats(relationship.asset_path);
              
              result.relatedFiles.push({
                relationship,
                content,
                stats: {
                  lines: content.split('\n').length,
                  size: stats?.size || 0
                }
              });
            } catch (error) {
              this.logger?.warn(`Failed to load related file: ${relationship.asset_path}`, { error });
            }
          }
        }
      }
      
      // Execute database queries if requested
      if (options.executeQueries && result.prompt.content) {
        result.databaseQueries = await this.executeDatabaseQueries(result.prompt.content);
      }
      
      // Get output templates if requested
      if (options.includeOutputTemplates && result.prompt.id) {
        try {
          const templates = await promptOutputTemplateService.getTemplatesForPrompt(result.prompt.id);
          result.outputTemplates = templates.map(t => ({
            id: t.id,
            name: t.name,
            template: t.template,
            priority: t.priority || 0
          }));
        } catch (error) {
          this.logger?.warn('Failed to load output templates', { error });
        }
      }
      
      // Build combined content
      if (options.returnAsMarkdown || options.returnAll) {
        result.combinedContent = this.buildCombinedContent(result, options);
      }
      
      this.updateMetrics(startTime);
      return result;
    } catch (error) {
      this.logger?.error('Failed to load prompt', { error });
      this.updateMetrics(startTime);
      throw error;
    }
  }

  /**
   * Build combined content from prompt load result
   */
  private buildCombinedContent(result: PromptLoadResult, options: PromptLoadOptions): string {
    const sections: string[] = [];
    
    // Add main prompt content
    if (result.prompt) {
      sections.push(`# ${result.prompt.name}`);
      sections.push('');
      sections.push(result.prompt.content);
      sections.push('');
    }
    
    // Add related files
    if (result.relatedFiles.length > 0) {
      sections.push('## Related Files');
      sections.push('');
      
      for (const file of result.relatedFiles) {
        sections.push(`### ${file.relationship.asset_path}`);
        sections.push('');
        sections.push('```');
        sections.push(file.content);
        sections.push('```');
        sections.push('');
      }
    }
    
    // Add database query results
    if (result.databaseQueries.length > 0) {
      sections.push('## Database Query Results');
      sections.push('');
      
      for (const query of result.databaseQueries) {
        sections.push(`### ${query.queryName}`);
        sections.push('');
        sections.push('```sql');
        sections.push(query.queryText);
        sections.push('```');
        sections.push('');
        sections.push('Results:');
        sections.push('```json');
        sections.push(JSON.stringify(query.queryResults, null, 2));
        sections.push('```');
        sections.push('');
      }
    }
    
    // Add output templates
    if (result.outputTemplates && result.outputTemplates.length > 0) {
      sections.push('## Output Templates');
      sections.push('');
      
      for (const template of result.outputTemplates) {
        sections.push(`### ${template.name} (Priority: ${template.priority})`);
        sections.push('');
        sections.push('```json');
        sections.push(JSON.stringify(template.template, null, 2));
        sections.push('```');
        sections.push('');
      }
    }
    
    return sections.join('\n');
  }

  /**
   * Create a new prompt
   */
  public async createPrompt(prompt: Omit<Prompt, 'id' | 'created_at' | 'updated_at'>): Promise<Prompt> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('ai_prompts')
        .insert({
          ...prompt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        this.logger?.error('Error creating prompt', { error });
        throw error;
      }
      
      // Clear cache for this prompt
      if (this.config.enableCaching) {
        this.promptCache.delete(prompt.name);
      }
      
      return data as Prompt;
    } catch (error) {
      this.logger?.error('Failed to create prompt', { error });
      throw error;
    }
  }

  /**
   * Update an existing prompt
   */
  public async updatePrompt(promptId: string, updates: Partial<Prompt>): Promise<Prompt> {
    this.ensureInitialized();
    
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
        this.logger?.error('Error updating prompt', { error });
        throw error;
      }
      
      // Clear cache for this prompt
      if (this.config.enableCaching && data) {
        this.promptCache.delete((data as Prompt).name);
      }
      
      return data as Prompt;
    } catch (error) {
      this.logger?.error('Failed to update prompt', { error });
      throw error;
    }
  }

  /**
   * Delete a prompt
   */
  public async deletePrompt(promptId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Get prompt name for cache clearing
      const { data: prompt } = await this.supabase
        .from('ai_prompts')
        .select('name')
        .eq('id', promptId)
        .single();
      
      const { error } = await this.supabase
        .from('ai_prompts')
        .delete()
        .eq('id', promptId);
      
      if (error) {
        this.logger?.error('Error deleting prompt', { error });
        throw error;
      }
      
      // Clear cache for this prompt
      if (this.config.enableCaching && prompt) {
        this.promptCache.delete(prompt.name);
      }
    } catch (error) {
      this.logger?.error('Failed to delete prompt', { error });
      throw error;
    }
  }

  /**
   * Extract metadata from prompt content using AI
   */
  public async extractPromptMetadata(content: string): Promise<any> {
    this.ensureInitialized();
    
    try {
      const extractionPrompt = `
        Analyze the following prompt content and extract structured metadata.
        Return a JSON object with the following fields:
        - purpose: Brief description of what this prompt does
        - input_requirements: List of required inputs
        - output_format: Expected output format
        - tags: Array of relevant tags
        - complexity: low, medium, or high
        
        Prompt content:
        ${content}
      `;
      
      const response = await claudeService.getJsonResponse(extractionPrompt);
      return response;
    } catch (error) {
      this.logger?.error('Failed to extract prompt metadata', { error });
      throw error;
    }
  }
}

// Export the class (not an instance)
export { PromptService };