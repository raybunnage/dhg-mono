#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function createWorkSummary(): Promise<void> {
  console.log('📝 Creating work summary record...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Create ai_work_summaries record
  const workSummary = {
    title: 'Script Cleanup Phase 3 Step 2: Archive Empty Pipelines',
    summary_content: `Successfully completed Step 2 of script cleanup process focused on pipeline directory consolidation and archival.

**Key Achievements:**
- Archived 4 empty pipeline directories (documentation, examples, merge, worktree) to .archived_pipelines/
- Created intelligent pipeline analysis tools for safe validation
- Cleaned 9 orphaned database commands from documentation pipeline
- Reduced broken command count from 119 to 107 (10.1% improvement) 
- Reduced total pipeline count from 43 to 39 (9.3% improvement)
- Marked archived pipelines as deprecated in command_pipelines table

**Technical Implementation:**
- Built conservative validation approach to prevent breaking functional code
- Created 6 new scripts for pipeline analysis and archival process
- Updated CLI command validation report with current state
- Maintained database-filesystem synchronization

**Impact:**
- 9.3% reduction in total pipelines (43 → 39)
- 10.1% reduction in broken commands (119 → 107)
- Improved codebase organization and maintainability
- Established safe archival process for future cleanup work

Next steps: Continue with Step 3 (Root Scripts Review) and Step 4 (Pipeline Consolidation).`,
    
    work_date: new Date().toISOString().split('T')[0],
    category: 'refactor',
    tags: ['script-cleanup', 'pipeline-archival', 'database-cleanup', 'validation', 'deprecation', 'phase3-step2'],
    files_modified: [
      'docs/script-reports/cli-command-validation-2025-06-08.json',
      'docs/script-reports/script-cleanup-step2-completion-2025-06-08.md',
      'scripts/cli-pipeline/.archived_pipelines/documentation.2025-06-08/',
      'scripts/cli-pipeline/.archived_pipelines/examples.2025-06-08/',
      'scripts/cli-pipeline/.archived_pipelines/merge.2025-06-08/',
      'scripts/cli-pipeline/.archived_pipelines/worktree.2025-06-08/',
      'scripts/cli-pipeline/deprecation/commands/analyze-dead-pipelines.ts',
      'scripts/cli-pipeline/deprecation/commands/archive-empty-pipelines.ts',
      'scripts/cli-pipeline/deprecation/commands/check-pipeline-statuses.ts',
      'scripts/cli-pipeline/deprecation/commands/cleanup-archived-pipeline-commands.ts',
      'scripts/cli-pipeline/deprecation/commands/conservative-cleanup.ts',
      'scripts/cli-pipeline/deprecation/commands/validate-safe-archive.ts'
    ],
    commands: [
      './scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-cli-commands',
      'ts-node scripts/cli-pipeline/deprecation/commands/analyze-dead-pipelines.ts',
      'ts-node scripts/cli-pipeline/deprecation/commands/validate-safe-archive.ts',
      'ts-node scripts/cli-pipeline/deprecation/commands/archive-empty-pipelines.ts',
      'ts-node scripts/cli-pipeline/deprecation/commands/cleanup-archived-pipeline-commands.ts'
    ]
  };
  
  const { data: summaryData, error: summaryError } = await supabase
    .from('ai_work_summaries')
    .insert(workSummary)
    .select()
    .single();
  
  if (summaryError) {
    console.error('❌ Error creating work summary:', summaryError);
    return;
  }
  
  console.log('✅ Created work summary record:', summaryData.id);
  
  // Update dev_task for script cleanup
  const taskId = '94a738ae-54a8-4b6a-b42b-e5c53973e98a';
  const commitSha = '280a98ce';
  
  // Link commit to dev_task
  const { error: commitError } = await supabase
    .from('dev_task_commits')
    .insert({
      task_id: taskId,
      commit_sha: commitSha,
      commit_message: 'feat: complete script cleanup Phase 3 Step 2 - archive empty pipelines',
      files_changed: 16,
      lines_added: 746,
      lines_removed: 570,
      created_at: new Date().toISOString()
    });
  
  if (commitError) {
    console.error('❌ Error linking commit to task:', commitError);
  } else {
    console.log('✅ Linked commit to dev_task');
  }
  
  // Update task git tracking
  const { error: taskUpdateError } = await supabase
    .from('dev_tasks')
    .update({
      git_commit_current: commitSha,
      git_commits_count: 1, // This would be incremented in real implementation
      notes: 'Completed Step 2 of script cleanup: archived 4 empty pipelines, reduced broken commands from 119 to 107',
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);
  
  if (taskUpdateError) {
    console.error('❌ Error updating task:', taskUpdateError);
  } else {
    console.log('✅ Updated dev_task tracking');
  }
  
  console.log('\n📊 Summary Complete:');
  console.log('- Work summary created in ai_work_summaries');
  console.log('- Commit linked to dev_task via dev_task_commits');
  console.log('- Task git tracking updated');
  console.log('- Ready for next phase of script cleanup');
}

// Main execution
createWorkSummary().catch(console.error);