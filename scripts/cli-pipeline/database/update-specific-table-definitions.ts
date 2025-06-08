#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

interface TableUpdate {
  table_name: string;
  description: string;
  purpose: string;
  notes?: string;
}

async function updateSpecificTables() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📝 Updating specific table definitions with better descriptions...\n');

  // Define specific updates for tables we know about
  const tableUpdates: TableUpdate[] = [
    // Worktree tables
    {
      table_name: 'worktree_definitions',
      description: 'Git worktree definitions including path, branch, and alias information',
      purpose: 'Store and manage git worktree configurations for development workflow',
      notes: 'Used by worktree management UI and dev task assignment'
    },
    {
      table_name: 'worktree_app_mappings',
      description: 'Mapping of applications to their assigned worktrees',
      purpose: 'Track which applications are developed in which worktrees',
      notes: 'Enables filtering apps by worktree in task creation'
    },
    {
      table_name: 'worktree_pipeline_mappings',
      description: 'Mapping of CLI pipelines to their assigned worktrees',
      purpose: 'Track which CLI pipelines are developed in which worktrees',
      notes: 'Enables filtering pipelines by worktree in task creation'
    },
    
    // System service registry tables
    {
      table_name: 'sys_shared_services',
      description: 'Registry of all shared services in packages/shared/services with metadata',
      purpose: 'Track service definitions, categories, singleton status, and browser support',
      notes: 'Central registry for understanding service architecture'
    },
    {
      table_name: 'sys_applications',
      description: 'Registry of all applications in the monorepo with configuration details',
      purpose: 'Track applications, their types (vite/node), ports, and status',
      notes: 'Used for service dependency mapping and app management'
    },
    {
      table_name: 'sys_cli_pipelines',
      description: 'Registry of all CLI pipeline scripts with their commands',
      purpose: 'Track CLI pipelines, their shell scripts, and available commands',
      notes: 'Used for service dependency mapping and command discovery'
    },
    {
      table_name: 'sys_app_service_dependencies',
      description: 'Mapping of which services each application uses',
      purpose: 'Track service dependencies for impact analysis and refactoring',
      notes: 'Shows direct/indirect usage and specific features used'
    },
    {
      table_name: 'sys_pipeline_service_dependencies',
      description: 'Mapping of which services each CLI pipeline uses',
      purpose: 'Track service dependencies at command level for pipelines',
      notes: 'Enables understanding service usage patterns in CLI tools'
    },
    {
      table_name: 'sys_service_dependencies',
      description: 'Service-to-service dependency relationships',
      purpose: 'Track internal dependencies between shared services',
      notes: 'Critical for understanding cascading impacts of service changes'
    },
    
    // Email tables
    {
      table_name: 'email_sources',
      description: 'Defines possible email sources and their configurations',
      purpose: 'Configure different email sources like Gmail, Outlook, etc.',
      notes: 'Part of email integration system'
    },
    {
      table_name: 'email_source_associations',
      description: 'Associates email messages with their sources',
      purpose: 'Track which email source each message came from',
      notes: 'Enables filtering and organizing emails by source'
    }
  ];

  try {
    for (const update of tableUpdates) {
      const { error } = await supabase
        .from('sys_table_definitions')
        .update({
          description: update.description,
          purpose: update.purpose,
          notes: update.notes
        })
        .eq('table_name', update.table_name);

      if (error) {
        console.error(`❌ Error updating ${update.table_name}:`, error);
      } else {
        console.log(`✅ Updated: ${update.table_name}`);
        console.log(`   Description: ${update.description}`);
        console.log(`   Purpose: ${update.purpose}\n`);
      }
    }

    console.log('🎉 Table definition updates complete!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the update
updateSpecificTables();