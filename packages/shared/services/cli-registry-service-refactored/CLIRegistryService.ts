/**
 * Refactored CLIRegistryService using BusinessService base class
 * Manages CLI command registry with enhanced error handling and validation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService, ServiceDependencies } from '../base-classes/BusinessService';
import { HealthCheckResult, Logger } from '../base-classes/BaseService';
import { 
  CommandPipeline, 
  CommandDefinition, 
  CommandCategory,
  CommandPipelineTable,
  CommandDependency,
  PipelineStatistics 
} from './types';

export class CLIRegistryService extends BusinessService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient, logger?: Logger) {
    super('CLIRegistryService', { supabaseClient }, logger);
    this.supabase = supabaseClient;
  }

  /**
   * Validate dependencies
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabaseClient) {
      throw new Error('SupabaseClient is required for CLIRegistryService');
    }
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    // Service is ready to use immediately
    this.initialized = true;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test database connectivity with a simple query
      const { error } = await this.supabase
        .from('command_categories')
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

  // ========== CATEGORIES ==========

  /**
   * Get all command categories
   */
  async getCategories(): Promise<CommandCategory[]> {
    return this.timeOperation('getCategories', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_categories')
          .select('*')
          .order('display_order');

        if (error) throw error;
        return data || [];
      });
    });
  }

  /**
   * Get category by ID with validation
   */
  async getCategoryById(id: string): Promise<CommandCategory | null> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Category ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.timeOperation('getCategoryById', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_categories')
          .select('*')
          .eq('id', validatedId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }
        return data;
      });
    });
  }

  // ========== PIPELINES ==========

  /**
   * Get pipelines with optional filters
   */
  async getPipelines(filters?: {
    category?: string;
    status?: 'active' | 'deprecated' | 'maintenance';
  }): Promise<CommandPipeline[]> {
    // Validate filters if provided
    const validatedFilters = filters ? this.validateInput(filters, (f) => {
      if (f.status && !['active', 'deprecated', 'maintenance'].includes(f.status)) {
        throw new Error('Invalid status filter. Must be: active, deprecated, or maintenance');
      }
      return f;
    }) : undefined;

    return this.timeOperation('getPipelines', async () => {
      return this.withRetry(async () => {
        let query = this.supabase
          .from('command_pipelines')
          .select(`
            *,
            category:command_categories(id, name, color, icon)
          `)
          .order('display_name');

        if (validatedFilters?.category) {
          query = query.eq('category_id', validatedFilters.category);
        }
        if (validatedFilters?.status) {
          query = query.eq('status', validatedFilters.status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      });
    });
  }

  /**
   * Get pipeline by name with validation
   */
  async getPipelineByName(name: string): Promise<CommandPipeline | null> {
    const validatedName = this.validateInput(name, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Pipeline name must be a non-empty string');
      }
      return value.trim();
    });

    return this.timeOperation('getPipelineByName', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_pipelines')
          .select(`
            *,
            category:command_categories(id, name, color, icon)
          `)
          .eq('name', validatedName)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }
        return data;
      });
    });
  }

  /**
   * Create pipeline with transaction support
   */
  async createPipeline(pipeline: Omit<CommandPipeline, 'id' | 'created_at' | 'updated_at'>): Promise<CommandPipeline> {
    const validatedPipeline = this.validateInput(pipeline, (p) => {
      if (!p.name || !p.display_name || !p.script_path) {
        throw new Error('Pipeline name, display_name, and script_path are required');
      }
      if (!['active', 'deprecated', 'maintenance'].includes(p.status)) {
        throw new Error('Invalid status. Must be: active, deprecated, or maintenance');
      }
      return p;
    });

    return this.withTransaction(async () => {
      const { data, error } = await this.supabase
        .from('command_pipelines')
        .insert(validatedPipeline)
        .select(`
          *,
          category:command_categories(id, name, color, icon)
        `)
        .single();

      if (error) throw error;
      return data;
    });
  }

  /**
   * Update pipeline with validation
   */
  async updatePipeline(id: string, updates: Partial<CommandPipeline>): Promise<CommandPipeline> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      return value.trim();
    });

    const validatedUpdates = this.validateInput(updates, (u) => {
      if (u.status && !['active', 'deprecated', 'maintenance'].includes(u.status)) {
        throw new Error('Invalid status. Must be: active, deprecated, or maintenance');
      }
      return u;
    });

    return this.withTransaction(async () => {
      const { data, error } = await this.supabase
        .from('command_pipelines')
        .update(validatedUpdates)
        .eq('id', validatedId)
        .select(`
          *,
          category:command_categories(id, name, color, icon)
        `)
        .single();

      if (error) throw error;
      return data;
    });
  }

  // ========== COMMANDS ==========

  /**
   * Get commands for pipeline
   */
  async getCommandsForPipeline(pipelineId: string): Promise<CommandDefinition[]> {
    const validatedId = this.validateInput(pipelineId, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.timeOperation('getCommandsForPipeline', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_definitions')
          .select('*')
          .eq('pipeline_id', validatedId)
          .order('display_order');

        if (error) throw error;
        return data || [];
      });
    });
  }

  /**
   * Create command with validation
   */
  async createCommand(command: Omit<CommandDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<CommandDefinition> {
    const validatedCommand = this.validateInput(command, (c) => {
      if (!c.pipeline_id || !c.command_name) {
        throw new Error('Pipeline ID and command name are required');
      }
      if (typeof c.requires_auth !== 'boolean') {
        c.requires_auth = false;
      }
      if (typeof c.requires_google_api !== 'boolean') {
        c.requires_google_api = false;
      }
      if (typeof c.is_dangerous !== 'boolean') {
        c.is_dangerous = false;
      }
      return c;
    });

    return this.withTransaction(async () => {
      const { data, error } = await this.supabase
        .from('command_definitions')
        .insert(validatedCommand)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  /**
   * Update command with validation
   */
  async updateCommand(id: string, updates: Partial<CommandDefinition>): Promise<CommandDefinition> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Command ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.withTransaction(async () => {
      const { data, error } = await this.supabase
        .from('command_definitions')
        .update(updates)
        .eq('id', validatedId)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  /**
   * Delete command with validation
   */
  async deleteCommand(id: string): Promise<void> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Command ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.withTransaction(async () => {
      const { error } = await this.supabase
        .from('command_definitions')
        .delete()
        .eq('id', validatedId);

      if (error) throw error;
    });
  }

  // ========== PIPELINE TABLES ==========

  /**
   * Get tables for pipeline
   */
  async getTablesForPipeline(pipelineId: string): Promise<CommandPipelineTable[]> {
    const validatedId = this.validateInput(pipelineId, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.timeOperation('getTablesForPipeline', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_pipeline_tables')
          .select('*')
          .eq('pipeline_id', validatedId)
          .order('table_name');

        if (error) throw error;
        return data || [];
      });
    });
  }

  /**
   * Add pipeline table with validation
   */
  async addPipelineTable(table: Omit<CommandPipelineTable, 'id' | 'created_at'>): Promise<CommandPipelineTable> {
    const validatedTable = this.validateInput(table, (t) => {
      if (!t.pipeline_id || !t.table_name) {
        throw new Error('Pipeline ID and table name are required');
      }
      if (!['read', 'write', 'both'].includes(t.operation_type)) {
        throw new Error('Operation type must be: read, write, or both');
      }
      return t;
    });

    return this.withTransaction(async () => {
      const { data, error } = await this.supabase
        .from('command_pipeline_tables')
        .insert(validatedTable)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  /**
   * Remove pipeline table
   */
  async removePipelineTable(id: string): Promise<void> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Table ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.withTransaction(async () => {
      const { error } = await this.supabase
        .from('command_pipeline_tables')
        .delete()
        .eq('id', validatedId);

      if (error) throw error;
    });
  }

  // ========== DEPENDENCIES ==========

  /**
   * Get dependencies for command
   */
  async getDependenciesForCommand(commandId: string): Promise<CommandDependency[]> {
    const validatedId = this.validateInput(commandId, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Command ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.timeOperation('getDependenciesForCommand', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_dependencies')
          .select('*')
          .eq('command_id', validatedId)
          .order('dependency_type', { ascending: true })
          .order('dependency_name', { ascending: true });

        if (error) throw error;
        return data || [];
      });
    });
  }

  /**
   * Add command dependency with validation
   */
  async addCommandDependency(dependency: Omit<CommandDependency, 'id' | 'created_at'>): Promise<CommandDependency> {
    const validatedDependency = this.validateInput(dependency, (d) => {
      if (!d.command_id || !d.dependency_name) {
        throw new Error('Command ID and dependency name are required');
      }
      if (!['service', 'api', 'tool', 'env_var'].includes(d.dependency_type)) {
        throw new Error('Dependency type must be: service, api, tool, or env_var');
      }
      if (typeof d.is_required !== 'boolean') {
        d.is_required = true;
      }
      return d;
    });

    return this.withTransaction(async () => {
      const { data, error } = await this.supabase
        .from('command_dependencies')
        .insert(validatedDependency)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  /**
   * Remove command dependency
   */
  async removeCommandDependency(id: string): Promise<void> {
    const validatedId = this.validateInput(id, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Dependency ID must be a non-empty string');
      }
      return value.trim();
    });

    return this.withTransaction(async () => {
      const { error } = await this.supabase
        .from('command_dependencies')
        .delete()
        .eq('id', validatedId);

      if (error) throw error;
    });
  }

  // ========== STATISTICS ==========

  /**
   * Get pipeline statistics
   */
  async getPipelineStatistics(pipelineId?: string): Promise<PipelineStatistics[]> {
    const validatedId = pipelineId ? this.validateInput(pipelineId, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      return value.trim();
    }) : undefined;

    return this.timeOperation('getPipelineStatistics', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .rpc('get_pipeline_statistics', { p_pipeline_id: validatedId });

        if (error) throw error;
        return data || [];
      });
    });
  }

  // ========== SEARCH ==========

  /**
   * Search commands with validation
   */
  async searchCommands(searchTerm: string): Promise<{
    pipeline: CommandPipeline;
    command: CommandDefinition;
  }[]> {
    const validatedTerm = this.validateInput(searchTerm, (term) => {
      if (!term || typeof term !== 'string' || term.trim().length < 2) {
        throw new Error('Search term must be at least 2 characters long');
      }
      return term.trim();
    });

    return this.timeOperation('searchCommands', async () => {
      return this.withRetry(async () => {
        const { data, error } = await this.supabase
          .from('command_definitions')
          .select(`
            *,
            pipeline:command_pipelines!inner(
              *,
              category:command_categories(id, name, color, icon)
            )
          `)
          .or(`command_name.ilike.%${validatedTerm}%,description.ilike.%${validatedTerm}%`)
          .eq('pipeline.status', 'active')
          .order('command_name');

        if (error) throw error;
        
        return (data || []).map(item => ({
          command: {
            id: item.id,
            pipeline_id: item.pipeline_id,
            command_name: item.command_name,
            description: item.description,
            usage_pattern: item.usage_pattern,
            example_usage: item.example_usage,
            requires_auth: item.requires_auth,
            requires_google_api: item.requires_google_api,
            is_dangerous: item.is_dangerous,
            display_order: item.display_order,
            status: item.status,
            is_hidden: item.is_hidden,
            deprecated_at: item.deprecated_at,
            last_verified_at: item.last_verified_at,
            created_at: item.created_at,
            updated_at: item.updated_at
          },
          pipeline: item.pipeline
        }));
      });
    });
  }

  // ========== BULK OPERATIONS ==========

  /**
   * Import pipeline commands with validation
   */
  async importPipelineCommands(
    pipelineName: string, 
    commands: Array<{ name: string; description: string; usage?: string }>
  ): Promise<void> {
    const validatedName = this.validateInput(pipelineName, (name) => {
      if (!name || typeof name !== 'string') {
        throw new Error('Pipeline name must be a non-empty string');
      }
      return name.trim();
    });

    const validatedCommands = this.validateInput(commands, (cmds) => {
      if (!Array.isArray(cmds) || cmds.length === 0) {
        throw new Error('Commands must be a non-empty array');
      }
      return cmds.map(cmd => {
        if (!cmd.name || !cmd.description) {
          throw new Error('Each command must have name and description');
        }
        return cmd;
      });
    });

    return this.withTransaction(async () => {
      // First, get or create the pipeline
      let pipeline = await this.getPipelineByName(validatedName);
      if (!pipeline) {
        pipeline = await this.createPipeline({
          name: validatedName,
          display_name: validatedName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Commands for ${validatedName}`,
          script_path: `scripts/cli-pipeline/${validatedName}/${validatedName}-cli.sh`,
          status: 'active'
        });
      }

      // Then import the commands
      const commandInserts = validatedCommands.map((cmd, index) => ({
        pipeline_id: pipeline!.id,
        command_name: cmd.name,
        description: cmd.description,
        usage_pattern: cmd.usage,
        display_order: index,
        requires_auth: false,
        requires_google_api: false,
        is_dangerous: false
      }));

      const { error } = await this.supabase
        .from('command_definitions')
        .upsert(commandInserts, { 
          onConflict: 'pipeline_id,command_name',
          ignoreDuplicates: false 
        });

      if (error) throw error;
    });
  }

  /**
   * Mark pipeline as scanned
   */
  async markPipelineScanned(pipelineId: string): Promise<void> {
    const validatedId = this.validateInput(pipelineId, (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      return value.trim();
    });

    const { error } = await this.supabase
      .from('command_pipelines')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', validatedId);

    if (error) throw error;
  }
}