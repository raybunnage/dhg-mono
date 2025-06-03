#!/usr/bin/env ts-node

import { program } from 'commander';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import chalk from 'chalk';

interface MergeQueueItem {
  id: string;
  branch_name: string;
  status: string;
  priority: number;
  target_branch: string;
  task_title: string | null;
  unresolved_conflicts: number;
  pre_checks_passed: number;
  pre_checks_pending: number;
  created_at: string;
  merge_started_at: string | null;
}

async function listMergeQueue(options: any) {
  const supabase = createSupabaseAdapter();

  try {
    // Query the merge queue dashboard view
    const { data, error } = await supabase
      .from('dev_merge_queue_dashboard')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(chalk.red('Error fetching merge queue:'), error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log(chalk.yellow('No branches in merge queue'));
      return;
    }

    console.log(chalk.bold('\\nMerge Queue Status'));
    console.log(chalk.dim('─'.repeat(80)));

    // Group by status
    const grouped = data.reduce((acc: any, item: any) => {
      if (!acc[item.status]) acc[item.status] = [];
      acc[item.status].push(item);
      return acc;
    }, {});

    const statusOrder = ['ready', 'pending', 'in_progress', 'merged', 'failed', 'cancelled'];
    const statusColors: any = {
      ready: chalk.green,
      pending: chalk.yellow,
      in_progress: chalk.blue,
      merged: chalk.gray,
      failed: chalk.red,
      cancelled: chalk.dim
    };

    for (const status of statusOrder) {
      const items = grouped[status];
      if (!items || items.length === 0) continue;

      console.log(chalk.bold(`\\n${statusColors[status](status.toUpperCase())} (${items.length})`));
      
      for (const item of items) {
        const conflictIcon = item.unresolved_conflicts > 0 ? chalk.red('⚠') : chalk.green('✓');
        const checksIcon = item.pre_checks_pending === 0 && item.pre_checks_passed > 0 ? chalk.green('✓') : chalk.yellow('○');
        
        console.log(`  ${chalk.cyan(item.branch_name)}`);
        console.log(`    Priority: ${item.priority} | Target: ${item.target_branch}`);
        console.log(`    Conflicts: ${conflictIcon} | Checks: ${checksIcon} (${item.pre_checks_passed}/${item.pre_checks_passed + item.pre_checks_pending})`);
        
        if (item.task_title) {
          console.log(chalk.dim(`    Task: ${item.task_title}`));
        }
        
        if (item.merge_started_at) {
          const duration = Date.now() - new Date(item.merge_started_at).getTime();
          const minutes = Math.floor(duration / 60000);
          console.log(chalk.dim(`    Merging for ${minutes} minutes`));
        }
        
        console.log();
      }
    }

    // Summary
    const ready = data.filter((item: any) => item.status === 'ready').length;
    const pending = data.filter((item: any) => item.status === 'pending').length;
    const inProgress = data.filter((item: any) => item.status === 'in_progress').length;

    console.log(chalk.dim('─'.repeat(80)));
    console.log(chalk.bold('Summary:'), 
      chalk.green(`${ready} ready`), '|',
      chalk.yellow(`${pending} pending`), '|', 
      chalk.blue(`${inProgress} in progress`));

  } catch (error: any) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
}

// Parse command line arguments
program
  .name('queue-list')
  .description('List all branches in the merge queue')
  .option('--status <status>', 'Filter by status')
  .option('--json', 'Output as JSON')
  .action(listMergeQueue);

program.parse(process.argv);