#!/usr/bin/env ts-node

import { program } from 'commander';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import simpleGit from 'simple-git';
import chalk from 'chalk';

async function startMerge(branchName: string, options: any) {
  const supabase = createSupabaseAdapter();
  const git = simpleGit();

  try {
    // Get merge queue entry
    const { data: queueData, error: queueError } = await supabase
      .from('dev_merge_queue')
      .select('*')
      .eq('branch_name', branchName)
      .eq('target_branch', options.target || 'development')
      .single();

    if (queueError || !queueData) {
      console.error(chalk.red(`Branch '${branchName}' not found in merge queue`));
      process.exit(1);
    }

    // Check if ready to merge
    if (queueData.status !== 'ready' && !options.force) {
      console.error(chalk.yellow(`Branch is not ready to merge (status: ${queueData.status})`));
      console.log(chalk.dim('Run pre-merge checks first or use --force to override'));
      process.exit(1);
    }

    if (queueData.conflicts_detected && !options.force) {
      console.error(chalk.red('Conflicts detected. Resolve conflicts before merging'));
      console.log(chalk.dim('Use --force to override (not recommended)'));
      process.exit(1);
    }

    console.log(chalk.cyan(`Starting merge: '${branchName}' → '${queueData.target_branch}'`));

    // Update status to in_progress
    await supabase
      .from('dev_merge_queue')
      .update({ 
        status: 'in_progress',
        merge_started_at: new Date().toISOString()
      })
      .eq('id', queueData.id);

    try {
      // Ensure we're on the target branch
      await git.checkout(queueData.target_branch);
      console.log(chalk.dim(`Switched to '${queueData.target_branch}'`));

      // Pull latest changes
      await git.pull('origin', queueData.target_branch);
      console.log(chalk.dim('Pulled latest changes'));

      // Merge the feature branch
      const mergeOptions = options.squash ? ['--squash'] : [];
      const mergeResult = await git.merge([branchName, ...mergeOptions]);
      
      console.log(chalk.green('✓ Merge completed successfully'));

      // Get the merge commit SHA
      const log = await git.log(['-1']);
      const mergeCommitSha = log.latest?.hash;

      // Update merge queue
      await supabase
        .from('dev_merge_queue')
        .update({ 
          status: 'merged',
          merge_commit_sha: mergeCommitSha,
          merge_completed_at: new Date().toISOString()
        })
        .eq('id', queueData.id);

      // Update associated task if any
      if (queueData.task_id) {
        await supabase
          .from('dev_tasks')
          .update({
            status: 'completed',
            completion_date: new Date().toISOString()
          })
          .eq('id', queueData.task_id);
      }

      console.log(chalk.green(`\\n✓ Successfully merged '${branchName}' into '${queueData.target_branch}'`));
      console.log(chalk.dim(`  Merge commit: ${mergeCommitSha}`));
      
      console.log(chalk.cyan('\\nNext steps:'));
      console.log('  1. Run integration tests');
      console.log('  2. Push to remote: git push origin', queueData.target_branch);
      console.log('  3. Complete merge: ./merge-cli.sh complete-merge', branchName);

    } catch (mergeError: any) {
      console.error(chalk.red('Merge failed:'), mergeError.message);
      
      // Update status to failed
      await supabase
        .from('dev_merge_queue')
        .update({ 
          status: 'failed',
          integration_notes: `Merge failed: ${mergeError.message}`
        })
        .eq('id', queueData.id);

      // Try to abort the merge
      try {
        await git.merge(['--abort']);
        console.log(chalk.yellow('Merge aborted'));
      } catch (abortError) {
        // Already aborted or not in merge state
      }

      process.exit(1);
    }

  } catch (error: any) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
}

// Parse command line arguments
program
  .name('start-merge')
  .description('Start merging a branch from the queue')
  .argument('<branch>', 'Branch name to merge')
  .option('--target <branch>', 'Target branch for merge', 'development')
  .option('--force', 'Force merge even if not ready')
  .option('--squash', 'Squash commits during merge')
  .action(startMerge);

program.parse(process.argv);