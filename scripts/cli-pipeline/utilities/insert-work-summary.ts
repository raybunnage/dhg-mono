#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function insertWorkSummary() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();

    const workSummaryData = {
      title: "Implement comprehensive shared services testing framework (Phases 1 & 2)",
      summary: "Implemented a 4-phase testing framework for shared services with registry-driven intelligence. Phase 1 established testing infrastructure, database tracking, and unit tests for 5 critical services. Phase 2 added integration and contract tests, service-specific edge cases, and comprehensive test orchestration for all 37 active services. Features <30s execution target, priority-based test depth, and health monitoring.",
      files_modified: [
        "packages/shared/services/testing-service/*",
        "scripts/cli-pipeline/testing/*",
        "supabase/migrations/20250610_create_service_testing_tables.sql",
        "docs/continuously-updated/shared-services-testing-vision.md"
      ],
      commands_used: [
        "./scripts/cli-pipeline/testing/testing-cli.sh setup-infrastructure",
        "./scripts/cli-pipeline/testing/testing-cli.sh test-critical",
        "./scripts/cli-pipeline/testing/testing-cli.sh health-report",
        "./scripts/cli-pipeline/testing/testing-cli.sh run-suite"
      ],
      category: "feature",
      tags: ["testing", "shared-services", "phase-1", "phase-2", "registry-driven", "edge-cases", "cli-pipeline"],
      worktree: "improve-cli-pipelines",
      branch: "improve-cli-pipelines",
      commits: ["68a6a165", "e5296fcb"]
    };

    const { data, error } = await supabase
      .from('ai_work_summaries')
      .insert(workSummaryData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting work summary:', error);
      process.exit(1);
    }

    console.log('Successfully inserted work summary:');
    console.log(`ID: ${data.id}`);
    console.log(`Title: ${data.title}`);
    console.log(`Created at: ${data.created_at}`);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

insertWorkSummary();