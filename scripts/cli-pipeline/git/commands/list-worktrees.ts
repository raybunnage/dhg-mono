#!/usr/bin/env node

import { execSync } from 'child_process';
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';
import { Database } from '../../../../supabase/types';

type DevTask = Database['public']['Tables']['dev_tasks']['Row'];

interface GitWorktree {
  worktree: string;
  branch: string;
  commit: string;
  isDetached: boolean;
  isLocked: boolean;
  activeTasks?: number;
  tasks?: DevTask[];
}

async function getActiveTasks(): Promise<DevTask[]> {
  const supabase = createSupabaseAdapter();
  
  const { data, error } = await supabase
    .from('dev_tasks')
    .select('*')
    .not('worktree_path', 'is', null)
    .eq('status', 'in_progress');

  if (error) {
    console.error('Failed to fetch active tasks:', error);
    return [];
  }

  return data || [];
}

function parseWorktreeOutput(output: string): GitWorktree[] {
  const lines = output.trim().split('\n').filter(line => line);
  const worktrees: GitWorktree[] = [];

  for (const line of lines) {
    // Parse git worktree list output
    // Format: /path/to/worktree commithash [branch-name]
    const match = line.match(/^(.+?)\s+([a-f0-9]+)\s+\[(.+?)\](\s+\(locked\))?$/);
    if (match) {
      worktrees.push({
        worktree: match[1],
        branch: match[3],
        commit: match[2],
        isDetached: match[3].includes('detached'),
        isLocked: !!match[4]
      });
    }
  }

  return worktrees;
}

async function listWorktrees() {
  console.log('🌳 Git Worktrees\n');

  try {
    // Get git worktrees
    const output = execSync('git worktree list', { encoding: 'utf-8' });
    const worktrees = parseWorktreeOutput(output);

    // Get active tasks
    const activeTasks = await getActiveTasks();

    // Enhance worktrees with task information
    for (const worktree of worktrees) {
      const worktreeName = worktree.worktree.split('/').pop() || '';
      const tasksInWorktree = activeTasks.filter(task => 
        task.worktree_path?.includes(worktreeName)
      );
      
      worktree.activeTasks = tasksInWorktree.length;
      worktree.tasks = tasksInWorktree;
    }

    // Display worktrees
    if (worktrees.length === 0) {
      console.log('No worktrees found.');
      return;
    }

    for (const worktree of worktrees) {
      console.log(`📁 ${worktree.worktree}`);
      console.log(`   Branch: ${worktree.branch}`);
      console.log(`   Commit: ${worktree.commit.substring(0, 8)}`);
      
      if (worktree.isLocked) {
        console.log(`   Status: 🔒 Locked`);
      }
      
      if (worktree.activeTasks && worktree.activeTasks > 0) {
        console.log(`   Active Tasks: ${worktree.activeTasks}`);
        
        if (worktree.tasks) {
          for (const task of worktree.tasks) {
            console.log(`     - ${task.title} (${task.branch_name || 'no branch'})`);
          }
        }
      }
      
      console.log('');
    }

    // Summary
    console.log(`Total worktrees: ${worktrees.length}`);
    const totalTasks = worktrees.reduce((sum, wt) => sum + (wt.activeTasks || 0), 0);
    if (totalTasks > 0) {
      console.log(`Total active tasks: ${totalTasks}`);
    }

  } catch (error) {
    console.error('Failed to list worktrees:', error);
    process.exit(1);
  }
}

// Run the command
listWorktrees();