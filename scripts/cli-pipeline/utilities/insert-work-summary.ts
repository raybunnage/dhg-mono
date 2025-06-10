#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { execSync } from 'child_process';

function parseArguments(): { title: string; summary: string; category?: string; tags?: string[] } {
  const args = process.argv.slice(2);
  const result: any = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && i + 1 < args.length) {
      result.title = args[i + 1];
      i++;
    } else if (args[i] === '--summary' && i + 1 < args.length) {
      result.summary = args[i + 1];
      i++;
    } else if (args[i] === '--category' && i + 1 < args.length) {
      result.category = args[i + 1];
      i++;
    } else if (args[i] === '--tags' && i + 1 < args.length) {
      result.tags = args[i + 1].split(',').map(tag => tag.trim());
      i++;
    }
  }
  
  if (!result.title || !result.summary) {
    console.error('❌ Error: Both --title and --summary are required');
    console.error('Usage: insert-work-summary --title "Title" --summary "Summary" [--category "category"] [--tags "tag1,tag2"]');
    process.exit(1);
  }
  
  return result;
}

function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getCurrentWorktree(): string {
  try {
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim();
    const worktreePath = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    const pathParts = worktreePath.split('/');
    const worktreeName = pathParts[pathParts.length - 1];
    
    // Extract worktree suffix from directory name (e.g., "dhg-mono-improve-cli-pipelines" -> "improve-cli-pipelines")
    if (worktreeName.startsWith('dhg-mono-')) {
      return worktreeName.replace('dhg-mono-', '');
    }
    return worktreeName;
  } catch {
    return getCurrentBranch(); // Fallback to branch name
  }
}

function getRecentCommits(count: number = 1): string[] {
  try {
    const commits = execSync(`git log --format=%h -${count}`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    return commits;
  } catch {
    return [];
  }
}

async function insertWorkSummary() {
  try {
    const args = parseArguments();
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const branch = getCurrentBranch();
    const worktree = getCurrentWorktree();
    const commits = getRecentCommits(1); // Get the most recent commit

    const workSummaryData = {
      title: args.title,
      summary_content: args.summary,
      category: args.category || "feature",
      tags: args.tags || [],
      worktree: worktree,
      work_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      // Note: files_modified and commands could be populated by analyzing git diff and command history
      // For now, leaving them as empty arrays
      files_modified: [],
      commands: [],
      metadata: {
        commits: commits // Store commits in metadata since there's no dedicated field
      }
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