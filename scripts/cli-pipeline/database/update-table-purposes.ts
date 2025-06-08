#!/usr/bin/env ts-node

/**
 * Updates sys_table_definitions with detailed purpose information
 * explaining common use cases for tables and views.
 * 
 * This helps developers understand:
 * - What each table/view is used for
 * - Common query patterns
 * - UI/feature integrations
 * - Best practices for usage
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface TablePurposeUpdate {
  table_name: string;
  purpose: string;
}

async function updateTablePurposes() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📝 Updating table and view purposes with common use cases...\n');
  
  // Comprehensive list of all table/view purposes
  const allPurposes: TablePurposeUpdate[] = [
    // AI & Prompt Management
    {
      table_name: 'ai_prompts',
      purpose: 'Use for: Managing AI prompts, retrieving prompt templates by category, tracking prompt versions, building dynamic prompts with variables'
    },
    {
      table_name: 'ai_prompt_categories',
      purpose: 'Use for: Organizing prompts by type, filtering prompts in UI, managing prompt taxonomy, creating prompt hierarchies'
    },
    {
      table_name: 'ai_prompt_output_templates',
      purpose: 'Use for: Defining expected AI response formats, validating AI outputs, ensuring consistent response structures'
    },
    {
      table_name: 'ai_work_summaries',
      purpose: 'Use for: Work history search, daily/weekly reports, git commit enrichment, productivity analytics, knowledge base building, finding similar past work, team activity dashboards, work pattern analysis'
    },
    
    // Authentication & User Management
    {
      table_name: 'auth_allowed_emails',
      purpose: 'Use for: Login gate checks, user onboarding, access control lists, beta program management, email validation at signup, admin user management, RLS policy base, user allowlist maintenance'
    },
    {
      table_name: 'auth_user_profiles',
      purpose: 'Use for: Storing user preferences, displaying user information, managing user settings, tracking user metadata'
    },
    {
      table_name: 'auth_audit_log',
      purpose: 'Use for: Security monitoring, tracking user actions, compliance reporting, debugging authentication issues'
    },
    {
      table_name: 'auth_cli_tokens',
      purpose: 'Use for: CLI authentication, API key management, service authentication, token validation'
    },
    
    // Command & Pipeline Management
    {
      table_name: 'command_tracking',
      purpose: 'Use for: Usage analytics dashboards, feature adoption metrics, error rate monitoring, performance tracking, user behavior analysis, debugging command failures, billing/usage reports, popular command discovery'
    },
    {
      table_name: 'command_pipelines',
      purpose: 'Use for: Managing available CLI tools, checking pipeline status, organizing commands by domain, pipeline discovery'
    },
    {
      table_name: 'command_definitions',
      purpose: 'Use for: Command documentation, generating help text, validating command parameters, command auto-completion'
    },
    {
      table_name: 'command_refactor_tracking',
      purpose: 'Use for: Technical debt tracking, refactoring priorities, modernization planning, deprecation management'
    },
    
    // Development & Task Management
    {
      table_name: 'dev_tasks',
      purpose: 'Use for: Sprint planning, kanban boards, git branch management, work assignment, progress tracking, blocker identification, task dependencies, time estimation, workload balancing, commit linking'
    },
    {
      table_name: 'dev_task_commits',
      purpose: 'Use for: Git history tracking, linking code changes to tasks, analyzing development velocity, commit attribution'
    },
    {
      table_name: 'dev_merge_queue',
      purpose: 'Use for: Managing merge requests, tracking branch integration, preventing merge conflicts, deployment coordination'
    },
    {
      table_name: 'dev_merge_checklist',
      purpose: 'Use for: Merge quality control, review checklists, deployment readiness, compliance checks'
    },
    
    // Document Management
    {
      table_name: 'doc_files',
      purpose: 'Use for: Storing markdown content, managing documentation versions, searching documentation, content management'
    },
    {
      table_name: 'doc_continuous_tracking',
      purpose: 'Use for: Auto-updating documentation, tracking file changes, maintaining doc freshness, continuous monitoring'
    },
    {
      table_name: 'document_types',
      purpose: 'Use for: Content categorization, filtered searches, document organization UI, content type analytics, migration planning by type, bulk operations by category, content audit reports'
    },
    
    // Expert System
    {
      table_name: 'expert_profiles',
      purpose: 'Use for: Expert finder UI, expertise matching, content attribution, speaker selection, knowledge mapping, expert networks visualization, citation tracking, collaboration suggestions, expertise gap analysis'
    },
    {
      table_name: 'google_expert_documents',
      purpose: 'Use for: Linking experts to documents, finding expert content, analyzing expert contributions, content attribution'
    },
    {
      table_name: 'expert_profile_aliases',
      purpose: 'Use for: Name disambiguation, citation matching, expert identity resolution, merge duplicate profiles'
    },
    
    // Google Drive Integration
    {
      table_name: 'google_sources',
      purpose: 'Use for: File browsing UI, folder tree navigation, sync status checks, finding files by type/name, tracking Google Drive changes, building file explorers, parent-child hierarchy queries, metadata searches, duplicate detection'
    },
    {
      table_name: 'google_sync_history',
      purpose: 'Use for: Sync status monitoring, error diagnostics, retry failed syncs, sync performance graphs, troubleshooting sync issues, audit trails, sync scheduling, bandwidth usage tracking'
    },
    {
      table_name: 'google_sync_statistics',
      purpose: 'Use for: Performance metrics, sync analytics, identifying sync bottlenecks, capacity planning'
    },
    
    // Learning Platform
    {
      table_name: 'learn_topics',
      purpose: 'Use for: Organizing learning content, building course structures, topic recommendations, curriculum planning'
    },
    {
      table_name: 'learn_media_sessions',
      purpose: 'Use for: Tracking video/audio progress, resume playback, learning analytics, engagement metrics'
    },
    {
      table_name: 'learn_user_interests',
      purpose: 'Use for: Personalizing content, recommendation algorithms, user preference tracking, interest-based filtering'
    },
    {
      table_name: 'learn_document_concepts',
      purpose: 'Use for: Concept mapping, semantic search, related content discovery, knowledge graphs'
    },
    
    // Media & Presentations
    {
      table_name: 'media_presentations',
      purpose: 'Use for: Presentation library UI, slide deck search, speaker catalogs, conference archives, knowledge sharing, presentation analytics, content reuse, training materials, presentation templates'
    },
    {
      table_name: 'media_presentation_assets',
      purpose: 'Use for: Storing presentation media, managing slide assets, tracking resource usage, asset optimization'
    },
    
    // System & Infrastructure
    {
      table_name: 'sys_table_definitions',
      purpose: 'Use for: Database introspection, auto-generating documentation, schema validation, table discovery in UI dropdowns, database health dashboards, migration planning, finding tables by prefix/category, understanding table relationships'
    },
    {
      table_name: 'sys_table_migrations',
      purpose: 'Use for: Tracking table renames, updating old code references, migration history, backward compatibility, finding current table names from old names, deprecation tracking'
    },
    {
      table_name: 'sys_shared_services',
      purpose: 'Use for: Service discovery, dependency analysis, architecture documentation, service health monitoring'
    },
    {
      table_name: 'sys_applications',
      purpose: 'Use for: App inventory, deployment tracking, version management, app configuration'
    },
    
    // Registry System
    {
      table_name: 'registry_services',
      purpose: 'Use for: Service catalogs, API documentation, service health dashboards, dependency mapping, version tracking, deprecation notices, service discovery, integration guides'
    },
    {
      table_name: 'registry_apps',
      purpose: 'Use for: Application inventory, deployment tracking, version management, app health monitoring, resource usage, app dependencies, update scheduling, app configuration'
    },
    {
      table_name: 'registry_pipelines',
      purpose: 'Use for: Pipeline inventory, command organization, pipeline health, usage analytics'
    },
    
    // Processing & Operations
    {
      table_name: 'batch_processing',
      purpose: 'Use for: Bulk operation management, job queues, progress monitoring, error handling, retry logic, batch analytics, resource allocation, priority queuing, job dependencies'
    },
    {
      table_name: 'import_operations',
      purpose: 'Use for: Data import tracking, migration progress, error logs, rollback points, import validation, duplicate handling, import history, data quality reports'
    },
    {
      table_name: 'scripts_registry',
      purpose: 'Use for: Script inventory, finding utility scripts, tracking script usage, script documentation'
    },
    
    // Email System
    {
      table_name: 'email_messages',
      purpose: 'Use for: Email search UI, conversation threading, attachment tracking, email analytics, communication history, contact extraction, email archiving, compliance reporting'
    },
    
    // Views - Dashboard & Reporting
    {
      table_name: 'ai_work_summaries_recent_view',
      purpose: 'Use for: Dashboard widgets showing recent work, daily standup reports, activity monitoring, quick work history access'
    },
    {
      table_name: 'command_refactor_needing_attention_view',
      purpose: 'Use for: Prioritizing refactoring work, finding technical debt, sprint planning, maintenance dashboards'
    },
    {
      table_name: 'command_refactor_status_summary_view',
      purpose: 'Use for: Project status reports, refactoring progress tracking, management dashboards, health metrics'
    },
    {
      table_name: 'dev_tasks_with_git_view',
      purpose: 'Use for: Linking tasks to commits, development velocity reports, task completion tracking, git integration'
    },
    {
      table_name: 'doc_continuous_status_view',
      purpose: 'Use for: Documentation health checks, finding stale docs, monitoring doc updates, quality assurance'
    },
    {
      table_name: 'learn_user_progress_view',
      purpose: 'Use for: Learning dashboards, progress bars, completion certificates, recommendation engines, engagement reports, dropout analysis, learning paths, achievement systems'
    },
    {
      table_name: 'media_content_view',
      purpose: 'Use for: Main content browsing UI, search results display, content recommendations, media galleries, playlist creation, content discovery feeds, related content suggestions, trending content'
    },
    
    // Views - Architecture & Dependencies
    {
      table_name: 'registry_app_dependencies_view',
      purpose: 'Use for: Architecture diagrams, dependency graphs, impact analysis, upgrade planning'
    },
    {
      table_name: 'registry_pipeline_coverage_gaps_view',
      purpose: 'Use for: Finding missing integrations, service adoption tracking, gap analysis, integration planning'
    },
    {
      table_name: 'registry_service_usage_summary_view',
      purpose: 'Use for: Service popularity metrics, deprecation decisions, optimization priorities, resource allocation'
    },
    {
      table_name: 'registry_unused_services_view',
      purpose: 'Use for: Cleanup candidates, dead code detection, maintenance planning, service retirement'
    },
    {
      table_name: 'sys_app_dependencies_view',
      purpose: 'Use for: App architecture visualization, service impact analysis, deployment dependencies, troubleshooting'
    },
    {
      table_name: 'sys_database_objects_info_view',
      purpose: 'Use for: Database admin panels, schema explorers, table size monitoring, column browsers, database health checks, capacity planning, index analysis, performance tuning'
    },
    {
      table_name: 'sys_pipeline_dependencies_view',
      purpose: 'Use for: Pipeline architecture docs, service usage by pipelines, integration planning, dependency tracking'
    },
    {
      table_name: 'sys_service_dependency_summary_view',
      purpose: 'Use for: Service importance ranking, architectural decisions, refactoring impact, service lifecycle'
    }
  ];
  
  // Update in batches to avoid timeouts
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < allPurposes.length; i += batchSize) {
    const batch = allPurposes.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (update) => {
      try {
        const { error } = await supabase
          .from('sys_table_definitions')
          .update({ purpose: update.purpose })
          .eq('table_name', update.table_name);
        
        if (error) {
          console.error(`❌ Failed: ${update.table_name} - ${error.message}`);
          errorCount++;
        } else {
          console.log(`✅ Updated: ${update.table_name}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error: ${update.table_name} -`, err);
        errorCount++;
      }
    }));
  }
  
  console.log(`\n📊 Summary: ${successCount} updated, ${errorCount} errors`);
  
  // Check for any tables/views still missing purposes
  const { data: missing } = await supabase
    .from('sys_table_definitions')
    .select('table_name')
    .or('purpose.is.null,purpose.eq.')
    .order('table_name');
    
  if (missing && missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} tables/views still need purposes:`);
    missing.forEach(t => console.log(`   - ${t.table_name}`));
  }
}

// Run the update
updateTablePurposes().catch(console.error);