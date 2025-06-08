#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

interface ViewDescription {
  table_name: string;
  description: string;
  purpose: string;
}

async function updateViewDescriptions() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📝 Updating view descriptions with detailed information...\n');

  // Define detailed descriptions for all views
  const viewDescriptions: ViewDescription[] = [
    // AI views
    {
      table_name: 'ai_work_summaries_recent_view',
      description: 'Shows recent AI work summaries from the last 30 days, joining ai_work_summaries with task and worktree information',
      purpose: 'Provide quick access to recent AI-assisted development work for tracking and review'
    },
    
    // Command views
    {
      table_name: 'command_refactor_needing_attention_view',
      description: 'Identifies commands in command_refactor_tracking that need attention based on status, priority, or missing information',
      purpose: 'Help prioritize command refactoring efforts by highlighting commands requiring immediate action'
    },
    {
      table_name: 'command_refactor_status_summary_view',
      description: 'Aggregates command_refactor_tracking data to show overall refactoring progress by status and pipeline',
      purpose: 'Provide high-level overview of command refactoring project status and progress metrics'
    },
    
    // Dev views
    {
      table_name: 'dev_tasks_with_git_view',
      description: 'Combines dev_tasks with dev_task_commits and dev_task_work_sessions to show tasks with their git activity',
      purpose: 'Track development tasks alongside their associated commits and work sessions for comprehensive task history'
    },
    
    // Doc views
    {
      table_name: 'doc_continuous_status_view',
      description: 'Joins doc_continuous_tracking with doc_continuous_updates to show current status of continuously monitored documents',
      purpose: 'Monitor which documents are being continuously tracked and when they were last updated'
    },
    
    // Learn views
    {
      table_name: 'learn_user_progress_view',
      description: 'Aggregates learning data from learn_media_sessions, learn_media_bookmarks with user profiles from auth_allowed_emails and auth_user_profiles',
      purpose: 'Track user learning progress, engagement metrics, and content consumption patterns'
    },
    
    // Media views
    {
      table_name: 'media_content_view',
      description: 'Complex view joining media_presentations with google_sources, expert_profiles, and classification tables to provide enriched media metadata',
      purpose: 'Provide comprehensive media content information including expert associations, classifications, and source details'
    },
    
    // Registry views (these seem to be misnamed - they should be sys_ views)
    {
      table_name: 'registry_app_dependencies_view',
      description: 'Shows application dependencies from registry_apps and service_dependencies tables',
      purpose: 'Map which services each application depends on for dependency analysis'
    },
    {
      table_name: 'registry_pipeline_coverage_gaps_view',
      description: 'Identifies gaps in pipeline service coverage by comparing registry_services with service_dependencies',
      purpose: 'Find services that are not used by any pipeline to identify potential dead code'
    },
    {
      table_name: 'registry_service_usage_summary_view',
      description: 'Summarizes service usage statistics from registry_services and service_dependencies',
      purpose: 'Provide usage metrics for each service to understand critical dependencies'
    },
    {
      table_name: 'registry_unused_services_view',
      description: 'Lists services from registry_services that have no entries in service_dependencies',
      purpose: 'Identify potentially unused or orphaned services for cleanup'
    },
    
    // Sys views
    {
      table_name: 'sys_app_dependencies_view',
      description: 'Joins sys_applications with sys_app_service_dependencies and sys_shared_services to show detailed app-to-service mappings',
      purpose: 'Provide easy querying of which shared services each application uses with full metadata'
    },
    {
      table_name: 'sys_database_objects_info',
      description: 'Enriches sys_table_definitions with live metadata from information_schema tables and columns',
      purpose: 'Provide comprehensive database object information including row counts, column counts, and existence checks'
    },
    {
      table_name: 'sys_pipeline_dependencies_view',
      description: 'Joins sys_cli_pipelines with sys_pipeline_service_dependencies and sys_shared_services for pipeline service usage',
      purpose: 'Track which shared services each CLI pipeline uses, enabling impact analysis for service changes'
    },
    {
      table_name: 'sys_service_dependency_summary',
      description: 'Aggregates data from all sys_*_dependencies tables to show usage counts and dependency relationships for each service',
      purpose: 'Provide bird\'s-eye view of service importance based on how many apps, pipelines, and other services depend on it'
    }
  ];

  try {
    let successCount = 0;
    let errorCount = 0;

    for (const view of viewDescriptions) {
      const { error } = await supabase
        .from('sys_table_definitions')
        .update({
          description: view.description,
          purpose: view.purpose
        })
        .eq('table_name', view.table_name)
        .eq('object_type', 'view');

      if (error) {
        console.error(`❌ Error updating ${view.table_name}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Updated: ${view.table_name}`);
        console.log(`   ${view.description}\n`);
        successCount++;
      }
    }

    console.log(`\n📊 Summary: ${successCount} views updated, ${errorCount} errors`);
    
    // Check for the view without _view suffix
    console.log('\n🔍 Checking for views without _view suffix...');
    
    const { data: viewsWithoutSuffix, error: checkError } = await supabase
      .from('sys_table_definitions')
      .select('table_name, description')
      .eq('object_type', 'view')
      .not('table_name', 'like', '%_view');

    if (!checkError && viewsWithoutSuffix && viewsWithoutSuffix.length > 0) {
      console.log('\n⚠️  Found views without _view suffix:');
      for (const view of viewsWithoutSuffix) {
        console.log(`   - ${view.table_name}`);
        console.log(`     Current description: ${view.description || 'No description'}`);
      }
      console.log('\nThese should be renamed to follow the naming convention.');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

// Run the update
updateViewDescriptions();