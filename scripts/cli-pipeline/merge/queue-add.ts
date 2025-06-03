#!/usr/bin/env ts-node

import { program } from 'commander';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import simpleGit from 'simple-git';
import chalk from 'chalk';
import { Database } from '../../../supabase/types';

type MergeQueueInsert = Database['public']['Tables']['dev_merge_queue']['Insert'];

async function addToMergeQueue(branchName: string, options: any) {
  const supabase = createSupabaseAdapter();
  const git = simpleGit();

  try {
    // Check if branch exists
    const branches = await git.branch();
    if (!branches.all.includes(branchName) && !branches.all.includes(`remotes/origin/${branchName}`)) {
      console.error(chalk.red(`Branch '${branchName}' not found`));
      process.exit(1);
    }

    // Get current worktree path if in a worktree
    const worktreePath = process.cwd();
    
    // Prepare merge queue entry
    const mergeQueueEntry: MergeQueueInsert = {
      branch_name: branchName,
      worktree_path: worktreePath,
      status: 'pending',
      priority: options.priority || 0,
      target_branch: options.target || 'development',
      task_id: options.taskId || null,
      conflicts_detected: false,
      tests_passed: null,
      lint_passed: null,
      type_check_passed: null
    };

    // Insert into merge queue
    const { data, error } = await supabase
      .from('dev_merge_queue')
      .insert(mergeQueueEntry)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        console.error(chalk.yellow(`Branch '${branchName}' is already in the merge queue for target '${options.target || 'development'}'`));
      } else {
        console.error(chalk.red('Error adding to merge queue:'), error.message);
      }
      process.exit(1);
    }

    console.log(chalk.green(`✓ Added '${branchName}' to merge queue`));
    console.log(chalk.dim(`  Queue ID: ${data.id}`));
    console.log(chalk.dim(`  Priority: ${data.priority}`));
    console.log(chalk.dim(`  Target: ${data.target_branch}`));
    
    // Create initial checklist items
    const checklistItems = [
      { check_type: 'pre_merge', check_name: 'branch_up_to_date', check_description: 'Branch is up to date with target' },
      { check_type: 'pre_merge', check_name: 'tests_pass', check_description: 'All tests pass' },
      { check_type: 'pre_merge', check_name: 'lint_clean', check_description: 'No linting errors' },
      { check_type: 'pre_merge', check_name: 'types_valid', check_description: 'TypeScript compilation succeeds' },
      { check_type: 'pre_merge', check_name: 'no_conflicts', check_description: 'No merge conflicts detected' },
      { check_type: 'post_merge', check_name: 'integration_tests', check_description: 'Integration tests pass' },
      { check_type: 'post_merge', check_name: 'deployment_ready', check_description: 'Ready for deployment' }
    ];

    const { error: checklistError } = await supabase
      .from('dev_merge_checklist')
      .insert(
        checklistItems.map(item => ({
          ...item,
          merge_queue_id: data.id,
          status: 'pending'
        }))
      );

    if (checklistError) {
      console.warn(chalk.yellow('Warning: Could not create checklist items:'), checklistError.message);
    } else {
      console.log(chalk.dim(`  Created ${checklistItems.length} checklist items`));
    }

    console.log(chalk.cyan('\\nNext steps:'));
    console.log('  1. Run pre-merge checks: ./merge-cli.sh run-checks', branchName);
    console.log('  2. Check conflicts: ./merge-cli.sh check-conflicts', branchName);
    console.log('  3. View queue: ./merge-cli.sh queue-list');

  } catch (error: any) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
}

// Parse command line arguments
program
  .name('queue-add')
  .description('Add a branch to the merge queue')
  .argument('<branch>', 'Branch name to add to queue')
  .option('--priority <number>', 'Priority level (0-10)', parseInt)
  .option('--task-id <uuid>', 'Associated dev task ID')
  .option('--target <branch>', 'Target branch for merge', 'development')
  .action(addToMergeQueue);

program.parse(process.argv);