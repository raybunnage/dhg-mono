#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function createAIWorkSummary() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const summaryData = {
    title: "Merge development branch bringing in registry/deprecation pipelines and database improvements",
    summary_content: "Successfully merged development branch into improve-cli-pipelines worktree, incorporating major infrastructure improvements including: (1) New registry CLI pipeline for tracking scripts, services, apps, and CLI pipelines; (2) New deprecation CLI pipeline for systematic code retirement; (3) Database enhancements with view renaming for consistency, sys_table_definitions updates, and service dependency mapping; (4) Enhanced database CLI with new commands for table/view definition management; (5) CLAUDE.md v1.06 with further size reduction and improved organization. Resolved merge conflict in update-table-definitions.ts by accepting incoming enhanced version.",
    files_modified: [
      "CLAUDE.md (updated to v1.06)",
      "scripts/cli-pipeline/registry/* (new pipeline)",
      "scripts/cli-pipeline/deprecation/* (new pipeline)",
      "scripts/cli-pipeline/database/update-table-definitions.ts (merge conflict resolved)",
      "scripts/cli-pipeline/database/update-view-definitions.ts (new)",
      "scripts/cli-pipeline/database/apply-views-migration.ts (new)",
      "scripts/cli-pipeline/system/* (new pipeline)",
      "apps/dhg-admin-code/src/pages/ServiceDependencies.tsx (new)",
      "apps/dhg-admin-code/src/pages/DeprecationAnalysis.tsx (new)",
      "supabase/migrations/20250607*.sql (4 new migrations)",
      "docs/database/table-view-renaming-reference.md (new)",
      "docs/technical-specs/deprecation-process-guide.md (new)",
      "docs/technical-specs/service-dependency-mapping-system-spec.md (new)"
    ],
    category: "infrastructure",
    tags: ["merge", "registry", "deprecation", "database", "cli-pipeline", "service-dependencies", "infrastructure", "claude-md"],
    commands: [
      "git fetch origin development",
      "git merge origin/development",
      "git checkout --theirs scripts/cli-pipeline/database/update-table-definitions.ts",
      "git add scripts/cli-pipeline/database/update-table-definitions.ts",
      "git commit"
    ],
    work_date: new Date().toISOString().split('T')[0]
  };

  try {
    const { data, error } = await supabase
      .from('ai_work_summaries')
      .insert(summaryData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting ai_work_summary:', error);
      throw error;
    }

    console.log('Successfully created ai_work_summary with ID:', data.id);
    console.log('Created at:', data.created_at);
    return data;
  } catch (error) {
    console.error('Failed to create ai_work_summary:', error);
    process.exit(1);
  }
}

// Run the function
createAIWorkSummary().then(() => process.exit(0));