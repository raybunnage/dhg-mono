import { SupabaseClient } from '@supabase/supabase-js';
import { 
  CommandPipeline, 
  CommandDefinition, 
  CommandCategory,
  CommandPipelineTable,
  CommandDependency 
} from './types';

export class CLIRegistryService {
  constructor(private supabase: SupabaseClient<any>) {}

  // Categories
  async getCategories(): Promise<CommandCategory[]> {
    const { data, error } = await this.supabase
      .from('command_categories')
      .select('*')
      .order('display_order');

    if (error) throw error;
    return data || [];
  }

  async getCategoryById(id: string): Promise<CommandCategory | null> {
    const { data, error } = await this.supabase
      .from('command_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Pipelines
  async getPipelines(filters?: {
    category?: string;
    status?: 'active' | 'deprecated' | 'maintenance';
  }): Promise<CommandPipeline[]> {
    let query = this.supabase
      .from('command_pipelines')
      .select(`
        *,
        category:command_categories(id, name, color, icon)
      `)
      .order('display_name');

    if (filters?.category) {
      query = query.eq('category_id', filters.category);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getPipelineByName(name: string): Promise<CommandPipeline | null> {
    const { data, error } = await this.supabase
      .from('command_pipelines')
      .select(`
        *,
        category:command_categories(id, name, color, icon)
      `)
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async createPipeline(pipeline: Omit<CommandPipeline, 'id' | 'created_at' | 'updated_at'>): Promise<CommandPipeline> {
    const { data, error } = await this.supabase
      .from('command_pipelines')
      .insert(pipeline)
      .select(`
        *,
        category:command_categories(id, name, color, icon)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async updatePipeline(id: string, updates: Partial<CommandPipeline>): Promise<CommandPipeline> {
    const { data, error } = await this.supabase
      .from('command_pipelines')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        category:command_categories(id, name, color, icon)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  // Commands
  async getCommandsForPipeline(pipelineId: string): Promise<CommandDefinition[]> {
    const { data, error } = await this.supabase
      .from('command_definitions')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('display_order');

    if (error) throw error;
    return data || [];
  }

  async createCommand(command: Omit<CommandDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<CommandDefinition> {
    const { data, error } = await this.supabase
      .from('command_definitions')
      .insert(command)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCommand(id: string, updates: Partial<CommandDefinition>): Promise<CommandDefinition> {
    const { data, error } = await this.supabase
      .from('command_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCommand(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('command_definitions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Pipeline Tables
  async getTablesForPipeline(pipelineId: string): Promise<CommandPipelineTable[]> {
    const { data, error } = await this.supabase
      .from('command_pipeline_tables')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('table_name');

    if (error) throw error;
    return data || [];
  }

  async addPipelineTable(table: Omit<CommandPipelineTable, 'id' | 'created_at'>): Promise<CommandPipelineTable> {
    const { data, error } = await this.supabase
      .from('command_pipeline_tables')
      .insert(table)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removePipelineTable(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('command_pipeline_tables')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Dependencies
  async getDependenciesForCommand(commandId: string): Promise<CommandDependency[]> {
    const { data, error } = await this.supabase
      .from('command_dependencies')
      .select('*')
      .eq('command_id', commandId)
      .order('dependency_type', { ascending: true })
      .order('dependency_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async addCommandDependency(dependency: Omit<CommandDependency, 'id' | 'created_at'>): Promise<CommandDependency> {
    const { data, error } = await this.supabase
      .from('command_dependencies')
      .insert(dependency)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeCommandDependency(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('command_dependencies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Statistics
  async getPipelineStatistics(pipelineId?: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('get_pipeline_statistics', { p_pipeline_id: pipelineId });

    if (error) throw error;
    return data || [];
  }

  // Search
  async searchCommands(searchTerm: string): Promise<{
    pipeline: CommandPipeline;
    command: CommandDefinition;
  }[]> {
    const { data, error } = await this.supabase
      .from('command_definitions')
      .select(`
        *,
        pipeline:command_pipelines!inner(
          *,
          category:command_categories(id, name, color, icon)
        )
      `)
      .or(`command_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
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
        created_at: item.created_at,
        updated_at: item.updated_at
      },
      pipeline: item.pipeline
    }));
  }

  // Bulk operations
  async importPipelineCommands(
    pipelineName: string, 
    commands: Array<{ name: string; description: string; usage?: string }>
  ): Promise<void> {
    // First, get or create the pipeline
    let pipeline = await this.getPipelineByName(pipelineName);
    if (!pipeline) {
      pipeline = await this.createPipeline({
        name: pipelineName,
        display_name: pipelineName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Commands for ${pipelineName}`,
        script_path: `scripts/cli-pipeline/${pipelineName}/${pipelineName}-cli.sh`,
        status: 'active'
      });
    }

    // Then import the commands
    const commandInserts = commands.map((cmd, index) => ({
      pipeline_id: pipeline!.id,
      command_name: cmd.name,
      description: cmd.description,
      usage_pattern: cmd.usage,
      display_order: index
    }));

    const { error } = await this.supabase
      .from('command_definitions')
      .upsert(commandInserts, { 
        onConflict: 'pipeline_id,command_name',
        ignoreDuplicates: false 
      });

    if (error) throw error;
  }

  // Mark pipeline as scanned
  async markPipelineScanned(pipelineId: string): Promise<void> {
    const { error } = await this.supabase
      .from('command_pipelines')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', pipelineId);

    if (error) throw error;
  }
}