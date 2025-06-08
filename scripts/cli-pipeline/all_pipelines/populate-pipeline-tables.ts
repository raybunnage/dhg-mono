#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface PipelineTableUsage {
  pipeline: string;
  tables: {
    name: string;
    operation: 'read' | 'write' | 'both';
    description: string;
  }[];
}

// Define which tables each pipeline uses
const pipelineTableUsage: PipelineTableUsage[] = [
  {
    pipeline: 'ai',
    tables: [
      { name: 'ai_prompts', operation: 'both', description: 'AI prompt storage and management' },
      { name: 'ai_prompt_categories', operation: 'read', description: 'Prompt categorization' },
      { name: 'ai_prompt_output_templates', operation: 'both', description: 'Output format templates' },
      { name: 'ai_prompt_relationships', operation: 'read', description: 'Prompt relationships to assets' }
    ]
  },
  {
    pipeline: 'auth',
    tables: [
      { name: 'auth_allowed_emails', operation: 'both', description: 'Email allowlist management' },
      { name: 'auth_user_profiles', operation: 'both', description: 'User profile information' },
      { name: 'auth_audit_log', operation: 'write', description: 'Authentication audit logging' },
      { name: 'auth_cli_tokens', operation: 'both', description: 'CLI authentication tokens' }
    ]
  },
  {
    pipeline: 'classify',
    tables: [
      { name: 'google_sources', operation: 'both', description: 'Source files for classification' },
      { name: 'document_types', operation: 'read', description: 'Document type definitions' },
      { name: 'learn_subject_classifications', operation: 'both', description: 'Subject classification data' },
      { name: 'expert_profiles', operation: 'read', description: 'Expert profiles for classification' }
    ]
  },
  {
    pipeline: 'database',
    tables: [
      { name: 'sys_table_migrations', operation: 'both', description: 'Table migration tracking' },
      { name: 'command_tracking', operation: 'write', description: 'Command usage tracking' },
      { name: 'function_registry', operation: 'read', description: 'Database function registry' }
    ]
  },
  {
    pipeline: 'dev_tasks',
    tables: [
      { name: 'dev_tasks', operation: 'both', description: 'Development task management' },
      { name: 'dev_task_copies', operation: 'both', description: 'Task copy tracking' }
    ]
  },
  {
    pipeline: 'document',
    tables: [
      { name: 'doc_files', operation: 'both', description: 'Documentation file storage' },
      { name: 'google_expert_documents', operation: 'both', description: 'Expert document management' },
      { name: 'document_types', operation: 'read', description: 'Document type definitions' },
      { name: 'google_sources', operation: 'read', description: 'Source files for documents' }
    ]
  },
  {
    pipeline: 'document_types',
    tables: [
      { name: 'document_types', operation: 'both', description: 'Document type management' },
      { name: 'learn_document_classifications', operation: 'read', description: 'Document classifications' }
    ]
  },
  {
    pipeline: 'drive_filter',
    tables: [
      { name: 'filter_user_profiles', operation: 'both', description: 'Filter profile management' },
      { name: 'filter_user_profile_drives', operation: 'both', description: 'Drive associations for profiles' }
    ]
  },
  {
    pipeline: 'experts',
    tables: [
      { name: 'expert_profiles', operation: 'both', description: 'Expert profile management' },
      { name: 'google_expert_documents', operation: 'both', description: 'Expert document associations' },
      { name: 'google_sources_experts', operation: 'both', description: 'Expert-source mappings' }
    ]
  },
  {
    pipeline: 'google_sync',
    tables: [
      { name: 'google_sources', operation: 'both', description: 'Google Drive file metadata' },
      { name: 'google_sync_history', operation: 'write', description: 'Sync operation history' },
      { name: 'google_sync_statistics', operation: 'both', description: 'Sync statistics and metrics' },
      { name: 'google_expert_documents', operation: 'both', description: 'Expert document synchronization' }
    ]
  },
  {
    pipeline: 'media-processing',
    tables: [
      { name: 'media_presentations', operation: 'both', description: 'Media presentation management' },
      { name: 'media_presentation_assets', operation: 'both', description: 'Presentation asset tracking' },
      { name: 'batch_processing', operation: 'both', description: 'Batch processing operations' },
      { name: 'google_sources', operation: 'read', description: 'Media source files' }
    ]
  },
  {
    pipeline: 'mime_types',
    tables: [
      { name: 'sys_mime_types', operation: 'both', description: 'MIME type configuration' }
    ]
  },
  {
    pipeline: 'monitoring',
    tables: [
      { name: 'monitoring_sessions', operation: 'both', description: 'Monitoring session tracking' },
      { name: 'monitoring_events', operation: 'write', description: 'Monitoring event logging' },
      { name: 'google_sources', operation: 'read', description: 'Monitor file changes' }
    ]
  },
  {
    pipeline: 'presentations',
    tables: [
      { name: 'media_presentations', operation: 'both', description: 'Presentation management' },
      { name: 'media_presentation_assets', operation: 'both', description: 'Presentation assets' },
      { name: 'google_sources', operation: 'read', description: 'Presentation source files' },
      { name: 'google_expert_documents', operation: 'both', description: 'Expert presentations' }
    ]
  },
  {
    pipeline: 'prompt_service',
    tables: [
      { name: 'ai_prompts', operation: 'both', description: 'Prompt management' },
      { name: 'ai_prompt_output_templates', operation: 'both', description: 'Output template management' },
      { name: 'ai_prompt_template_associations', operation: 'both', description: 'Template associations' },
      { name: 'ai_prompt_categories', operation: 'both', description: 'Prompt categorization' }
    ]
  },
  {
    pipeline: 'refactor_tracking',
    tables: [
      { name: 'command_refactor_tracking', operation: 'both', description: 'Command refactoring status' }
    ]
  },
  {
    pipeline: 'scripts',
    tables: [
      { name: 'registry_scripts', operation: 'both', description: 'Script registry management' }
    ]
  },
  {
    pipeline: 'tracking',
    tables: [
      { name: 'command_tracking', operation: 'both', description: 'Command usage tracking' },
      { name: 'command_history', operation: 'write', description: 'Command execution history' }
    ]
  },
  {
    pipeline: 'work_summaries',
    tables: [
      { name: 'ai_work_summaries', operation: 'both', description: 'AI work summary management' }
    ]
  }
];

async function populatePipelineTables() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Populating command_pipeline_tables...\n');
  
  let totalEntries = 0;
  
  for (const pipelineUsage of pipelineTableUsage) {
    // Get pipeline_id
    const { data: pipelineData, error: pipelineError } = await supabase
      .from('command_pipelines')
      .select('id')
      .eq('name', pipelineUsage.pipeline)
      .single();
      
    if (pipelineError || !pipelineData) {
      console.error(`Error finding pipeline ${pipelineUsage.pipeline}:`, pipelineError);
      continue;
    }
    
    console.log(`\n${pipelineUsage.pipeline}:`);
    
    for (const table of pipelineUsage.tables) {
      const { error } = await supabase
        .from('command_pipeline_tables')
        .upsert({
          pipeline_id: pipelineData.id,
          table_name: table.name,
          operation_type: table.operation,
          description: table.description
        }, {
          onConflict: 'pipeline_id,table_name'
        });
        
      if (error) {
        console.error(`  ✗ ${table.name}: ${error.message}`);
      } else {
        console.log(`  ✓ ${table.name} (${table.operation})`);
        totalEntries++;
      }
    }
  }
  
  console.log(`\n\nTotal table mappings created: ${totalEntries}`);
  
  // Show summary
  const { data: summary } = await supabase
    .from('command_pipelines')
    .select(`
      name,
      command_pipeline_tables (
        table_name,
        operation_type
      )
    `)
    .order('name');
    
  console.log('\nTable usage by pipeline:');
  summary?.forEach((pipeline: any) => {
    const tableCount = pipeline.command_pipeline_tables?.length || 0;
    if (tableCount > 0) {
      console.log(`  ${pipeline.name}: ${tableCount} tables`);
    }
  });
}

// Run the script
populatePipelineTables().catch(console.error);