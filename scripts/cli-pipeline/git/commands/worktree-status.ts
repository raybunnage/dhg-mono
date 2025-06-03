#!/usr/bin/env node

import { execSync } from 'child_process';
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';
import path from 'path';
import fs from 'fs';

interface WorktreeStatus {
  path: string;
  branch: string;
  isClean: boolean;
  ahead: number;
  behind: number;
  uncommittedChanges: number;
  untrackedFiles: number;
  lastCommit?: {
    hash: string;
    message: string;
    date: string;
  };
}

async function getWorktreeStatus(): Promise<WorktreeStatus[]> {
  const worktrees: WorktreeStatus[] = [];
  
  try {
    // Get list of worktrees
    const worktreeOutput = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktreeBlocks = worktreeOutput.trim().split('\n\n');

    for (const block of worktreeBlocks) {
      const lines = block.split('\n');
      const worktreePath = lines[0].replace('worktree ', '');
      const branch = lines[2]?.replace('branch refs/heads/', '') || 'detached';

      // Skip if directory doesn't exist
      if (!fs.existsSync(worktreePath)) {
        continue;
      }

      const status: WorktreeStatus = {
        path: worktreePath,
        branch: branch,
        isClean: true,
        ahead: 0,
        behind: 0,
        uncommittedChanges: 0,
        untrackedFiles: 0
      };

      try {
        // Get status for this worktree
        const gitStatus = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf-8' });
        const statusLines = gitStatus.trim().split('\n').filter(line => line);
        
        status.uncommittedChanges = statusLines.filter(line => !line.startsWith('??')).length;
        status.untrackedFiles = statusLines.filter(line => line.startsWith('??')).length;
        status.isClean = statusLines.length === 0;

        // Get ahead/behind info if on a branch
        if (branch !== 'detached') {
          try {
            const upstreamInfo = execSync(
              `git -C "${worktreePath}" rev-list --left-right --count HEAD...origin/${branch}`, 
              { encoding: 'utf-8' }
            ).trim();
            const [ahead, behind] = upstreamInfo.split('\t').map(n => parseInt(n) || 0);
            status.ahead = ahead;
            status.behind = behind;
          } catch (e) {
            // No upstream branch
          }
        }

        // Get last commit info
        try {
          const lastCommitHash = execSync(
            `git -C "${worktreePath}" rev-parse HEAD`, 
            { encoding: 'utf-8' }
          ).trim();
          
          const lastCommitMessage = execSync(
            `git -C "${worktreePath}" log -1 --pretty=%s`, 
            { encoding: 'utf-8' }
          ).trim();
          
          const lastCommitDate = execSync(
            `git -C "${worktreePath}" log -1 --pretty=%ai`, 
            { encoding: 'utf-8' }
          ).trim();

          status.lastCommit = {
            hash: lastCommitHash.substring(0, 8),
            message: lastCommitMessage,
            date: lastCommitDate
          };
        } catch (e) {
          // Ignore commit info errors
        }

      } catch (error) {
        console.warn(`Warning: Could not get status for ${worktreePath}`);
      }

      worktrees.push(status);
    }
  } catch (error) {
    console.error('Failed to get worktree list:', error);
  }

  return worktrees;
}

async function displayWorktreeStatus() {
  console.log('📊 Worktree Status\n');

  const worktrees = await getWorktreeStatus();

  if (worktrees.length === 0) {
    console.log('No worktrees found.');
    return;
  }

  // Get active tasks from database
  const supabase = createSupabaseAdapter();
  const { data: activeTasks } = await supabase
    .from('dev_tasks')
    .select('*')
    .not('worktree_path', 'is', null)
    .eq('status', 'in_progress');

  for (const worktree of worktrees) {
    const worktreeName = path.basename(worktree.path);
    const tasksInWorktree = activeTasks?.filter(task => 
      task.worktree_path?.includes(worktreeName)
    ) || [];

    console.log(`📁 ${worktree.path}`);
    console.log(`   Branch: ${worktree.branch}`);
    
    // Status line
    const statusParts = [];
    if (worktree.isClean) {
      statusParts.push('✅ Clean');
    } else {
      if (worktree.uncommittedChanges > 0) {
        statusParts.push(`📝 ${worktree.uncommittedChanges} modified`);
      }
      if (worktree.untrackedFiles > 0) {
        statusParts.push(`🆕 ${worktree.untrackedFiles} untracked`);
      }
    }
    
    if (worktree.ahead > 0) {
      statusParts.push(`⬆️ ${worktree.ahead} ahead`);
    }
    if (worktree.behind > 0) {
      statusParts.push(`⬇️ ${worktree.behind} behind`);
    }
    
    if (statusParts.length > 0) {
      console.log(`   Status: ${statusParts.join(', ')}`);
    }

    // Last commit
    if (worktree.lastCommit) {
      console.log(`   Last commit: ${worktree.lastCommit.hash} - ${worktree.lastCommit.message}`);
      console.log(`   Date: ${new Date(worktree.lastCommit.date).toLocaleString()}`);
    }

    // Active tasks
    if (tasksInWorktree.length > 0) {
      console.log(`   Active tasks: ${tasksInWorktree.length}`);
      for (const task of tasksInWorktree) {
        console.log(`     - ${task.title}`);
      }
    }

    console.log('');
  }

  // Summary
  const dirtyWorktrees = worktrees.filter(w => !w.isClean);
  const needsPush = worktrees.filter(w => w.ahead > 0);
  const needsPull = worktrees.filter(w => w.behind > 0);

  console.log('📊 Summary:');
  console.log(`  Total worktrees: ${worktrees.length}`);
  console.log(`  Clean: ${worktrees.length - dirtyWorktrees.length}`);
  console.log(`  With changes: ${dirtyWorktrees.length}`);
  
  if (needsPush.length > 0) {
    console.log(`  Need push: ${needsPush.length}`);
  }
  if (needsPull.length > 0) {
    console.log(`  Need pull: ${needsPull.length}`);
  }
}

// Run the command
displayWorktreeStatus();