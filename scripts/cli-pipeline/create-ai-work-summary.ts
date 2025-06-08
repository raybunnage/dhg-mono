#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function createAIWorkSummary() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const summaryData = {
    title: "Refactor CLAUDE.md to reduce size by 73% and improve documentation structure",
    summary: "Major refactoring of CLAUDE.md to improve maintainability and readability. Reduced file size from 57.8k to 15.3k characters (73% reduction) by extracting database table/view renaming mappings into a dedicated reference file. Condensed verbose sections into concise bullet points, removed duplication, and eliminated redundant warnings while maintaining all critical information. Also fixed dhg-audio proxy port configuration.",
    files_modified: [
      "CLAUDE.md (major refactoring)",
      "docs/database/table-view-renaming-reference.md (new file)",
      "apps/dhg-audio/vite.config.ts (port fix)"
    ],
    category: "refactor",
    tags: ["documentation", "claude-md", "database-tables", "refactoring", "file-size-reduction", "vite-config"],
    commands_used: [
      "git add/commit/push",
      "wc -c (to check file sizes)"
    ]
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