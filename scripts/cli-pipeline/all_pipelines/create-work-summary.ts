#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';

async function createWorkSummary() {
  const supabase = createSupabaseAdapter();

  const workSummary = {
    title: "Add comprehensive debugging tools for dhg-hub flashing issue",
    summary: "Created three debugging pages to isolate and diagnose the 2-second background flash issue in dhg-hub. IsolationTest tests different scenarios (Supabase, React Query, static content). FlashDetector monitors all DOM mutations and style changes with stack traces. StrictModeTest checks if React's double-mounting causes the flash.",
    files_modified: [
      "apps/dhg-hub/src/App.tsx",
      "apps/dhg-hub/src/pages/IsolationTest.tsx", 
      "apps/dhg-hub/src/pages/FlashDetector.tsx",
      "apps/dhg-hub/src/pages/StrictModeTest.tsx"
    ],
    commands_used: [],
    category: "bugfix",
    tags: ["dhg-hub", "debugging", "flashing-issue", "react", "supabase", "strictmode"],
    worktree_path: "/Users/raybunnage/Documents/github/dhg-mono-dhg-hub",
    git_branch: "feature/improve-dhg-hub",
    commit_hash: "a5dbd2b2"
  };

  const { data, error } = await supabase
    .from('ai_work_summaries')
    .insert(workSummary)
    .select()
    .single();

  if (error) {
    console.error('Error creating work summary:', error);
    process.exit(1);
  }

  console.log('Work summary created successfully:', data);
}

createWorkSummary().catch(console.error);