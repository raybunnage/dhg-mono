export interface CommandCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
  created_at: string;
  updated_at: string;
}

export interface CommandPipeline {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category_id?: string;
  category?: CommandCategory;
  script_path: string;
  status: 'active' | 'deprecated' | 'maintenance';
  usage_example?: string;
  guidance?: string;
  created_at: string;
  updated_at: string;
  last_scanned_at?: string;
}

export interface CommandDefinition {
  id: string;
  pipeline_id: string;
  command_name: string;
  description?: string;
  usage_pattern?: string;
  example_usage?: string;
  requires_auth: boolean;
  requires_google_api: boolean;
  is_dangerous: boolean;
  display_order?: number;
  created_at: string;
  updated_at: string;
}

export interface CommandPipelineTable {
  id: string;
  pipeline_id: string;
  table_name: string;
  operation_type: 'read' | 'write' | 'both';
  description?: string;
  created_at: string;
}

export interface CommandDependency {
  id: string;
  command_id: string;
  dependency_type: 'service' | 'api' | 'tool' | 'env_var';
  dependency_name: string;
  description?: string;
  is_required: boolean;
  created_at: string;
}

export interface PipelineStatistics {
  pipeline_id: string;
  pipeline_name: string;
  total_commands: number;
  tables_accessed: number;
  last_used?: string;
  total_executions: number;
}