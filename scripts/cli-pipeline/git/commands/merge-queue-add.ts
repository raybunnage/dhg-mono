#!/usr/bin/env node

import { Command } from 'commander';
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';
import { execSync } from 'child_process';

const program = new Command();

program
  .option('-b, --branch <branch>', 'Branch name to add to merge queue')
  .option('-s, --source <source>', 'Source branch to merge into (default: development)', 'development')
  .option('-p, --priority <priority>', 'Priority level (0-10)', '0')
  .option('-w, --worktree <path>', 'Worktree path for this branch')
  .option('-n, --notes <notes>', 'Notes about this merge')
  .option('-t, --task-ids <ids>', 'Comma-separated task IDs')
  .parse(process.argv);

const options = program.opts();

async function addToMergeQueue() {
  console.log('➕ Adding branch to merge queue\n');

  try {
    // Get current branch if not specified
    let branchName = options.branch;
    if (!branchName) {
      try {
        branchName = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        if (!branchName) {
          console.error('Error: Could not determine current branch. Please specify with --branch');
          process.exit(1);
        }
        console.log(`Using current branch: ${branchName}`);
      } catch (error) {
        console.error('Error: Could not determine current branch. Please specify with --branch');
        process.exit(1);
      }
    }

    // Get current worktree path if not specified
    let worktreePath = options.worktree;
    if (!worktreePath) {
      try {
        const worktreeList = execSync('git worktree list', { encoding: 'utf-8' });
        const currentPath = process.cwd();
        const worktreeLines = worktreeList.trim().split('\n');
        
        for (const line of worktreeLines) {
          if (line.startsWith(currentPath)) {
            worktreePath = currentPath;
            break;
          }
        }
      } catch (error) {
        // Ignore - worktree path is optional
      }
    }

    // Validate priority
    const priority = parseInt(options.priority);
    if (isNaN(priority) || priority < 0 || priority > 10) {
      console.error('Error: Priority must be a number between 0 and 10');
      process.exit(1);
    }

    // Parse task IDs
    const taskIds = options.taskIds ? options.taskIds.split(',').map((id: string) => id.trim()) : null;

    // Check if branch exists
    try {
      execSync(`git rev-parse --verify ${branchName}`, { stdio: 'ignore' });
    } catch (error) {
      console.error(`Error: Branch '${branchName}' does not exist`);
      process.exit(1);
    }

    const supabase = createSupabaseAdapter();

    // Check if branch is already in queue
    const { data: existing, error: checkError } = await supabase
      .from('dev_merge_queue')
      .select('id, merge_status')
      .eq('branch_name', branchName)
      .in('merge_status', ['pending', 'ready', 'in_progress', 'conflicts'])
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw checkError;
    }

    if (existing) {
      console.error(`Error: Branch '${branchName}' is already in the merge queue with status: ${existing.merge_status}`);
      process.exit(1);
    }

    // Add to merge queue
    const { data, error } = await supabase
      .from('dev_merge_queue')
      .insert({
        branch_name: branchName,
        source_branch: options.source,
        worktree_path: worktreePath,
        priority: priority,
        task_ids: taskIds,
        notes: options.notes,
        merge_status: 'pending',
        conflicts_detected: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Successfully added to merge queue!\n');
    console.log(`Branch: ${data.branch_name}`);
    console.log(`Source: ${data.source_branch}`);
    console.log(`Priority: ${data.priority}`);
    console.log(`Status: ${data.merge_status}`);
    
    if (data.worktree_path) {
      console.log(`Worktree: ${data.worktree_path}`);
    }
    
    if (data.task_ids && data.task_ids.length > 0) {
      console.log(`Tasks: ${data.task_ids.join(', ')}`);
    }
    
    if (data.notes) {
      console.log(`Notes: ${data.notes}`);
    }

    console.log('\nNext steps:');
    console.log('1. Run merge checks: git-cli.sh run-merge-checks --branch ' + branchName);
    console.log('2. View queue status: git-cli.sh merge-queue-list');

  } catch (error) {
    console.error('Failed to add branch to merge queue:', error);
    process.exit(1);
  }
}

// Run the command
addToMergeQueue();