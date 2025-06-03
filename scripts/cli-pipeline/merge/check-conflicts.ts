#!/usr/bin/env ts-node

import { program } from 'commander';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import simpleGit from 'simple-git';
import chalk from 'chalk';
import { Database } from '../../../supabase/types';

type MergeConflictInsert = Database['public']['Tables']['dev_merge_conflicts']['Insert'];

async function checkConflicts(branchName: string, options: any) {
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
      console.log(chalk.dim('Add it first with: ./merge-cli.sh queue-add', branchName));
      process.exit(1);
    }

    console.log(chalk.cyan(`Checking conflicts for '${branchName}' → '${queueData.target_branch}'...`));

    // Fetch latest changes
    await git.fetch(['origin', queueData.target_branch]);
    
    // Check if we can merge without conflicts
    try {
      // Try a dry-run merge
      const mergeResult = await git.merge([`origin/${queueData.target_branch}`, '--no-commit', '--no-ff']);
      
      // If we get here, no conflicts
      console.log(chalk.green('✓ No conflicts detected'));
      
      // Update merge queue
      await supabase
        .from('dev_merge_queue')
        .update({ 
          conflicts_detected: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', queueData.id);

      // Clear any existing conflicts
      await supabase
        .from('dev_merge_conflicts')
        .delete()
        .eq('merge_queue_id', queueData.id);

      // Abort the merge
      await git.merge(['--abort']);

    } catch (mergeError: any) {
      // Conflicts detected
      console.log(chalk.yellow('⚠ Conflicts detected'));
      
      // Get conflict details
      const status = await git.status();
      const conflicts: MergeConflictInsert[] = [];

      for (const file of status.conflicted) {
        console.log(chalk.red(`  • ${file}`));
        
        conflicts.push({
          merge_queue_id: queueData.id,
          file_path: file,
          conflict_type: 'content',
          resolved: false
        });
      }

      // Update merge queue
      await supabase
        .from('dev_merge_queue')
        .update({ 
          conflicts_detected: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', queueData.id);

      // Store conflicts
      if (conflicts.length > 0) {
        // Clear existing conflicts first
        await supabase
          .from('dev_merge_conflicts')
          .delete()
          .eq('merge_queue_id', queueData.id);

        // Insert new conflicts
        const { error: conflictError } = await supabase
          .from('dev_merge_conflicts')
          .insert(conflicts);

        if (conflictError) {
          console.warn(chalk.yellow('Warning: Could not store conflict details:'), conflictError.message);
        }
      }

      // Abort the merge
      try {
        await git.merge(['--abort']);
      } catch (abortError) {
        // Already aborted or not in merge state
      }

      console.log(chalk.cyan(`\\nFound ${conflicts.length} conflicting files`));
      console.log(chalk.dim('Resolve conflicts before merging'));
    }

    // Update checklist
    await supabase
      .from('dev_merge_checklist')
      .update({
        status: queueData.conflicts_detected ? 'failed' : 'passed',
        completed_at: new Date().toISOString()
      })
      .eq('merge_queue_id', queueData.id)
      .eq('check_name', 'no_conflicts');

  } catch (error: any) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
}

// Parse command line arguments
program
  .name('check-conflicts')
  .description('Check for merge conflicts with target branch')
  .argument('<branch>', 'Branch name to check')
  .option('--target <branch>', 'Target branch for merge', 'development')
  .action(checkConflicts);

program.parse(process.argv);