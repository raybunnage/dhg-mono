#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface Worktree {
  path: string;
  branch: string;
  commit: string;
  status: string;
}

async function listWorktrees(): Promise<void> {
  try {
    // Run git worktree list with porcelain output for easier parsing
    const { stdout } = await execAsync('git worktree list --porcelain');
    
    const worktrees: Worktree[] = [];
    const lines = stdout.split('\n');
    
    let currentWorktree: Partial<Worktree> = {};
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as Worktree);
        }
        currentWorktree = {
          path: line.substring(9),
          status: 'active'
        };
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.commit = line.substring(5).substring(0, 8); // Short commit hash
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line.startsWith('detached')) {
        currentWorktree.branch = '(detached HEAD)';
      } else if (line.startsWith('bare')) {
        currentWorktree.status = 'bare';
      }
    }
    
    // Don't forget the last worktree
    if (currentWorktree.path) {
      worktrees.push(currentWorktree as Worktree);
    }
    
    // Display the worktrees in a nice format
    console.log('\nGit Worktrees:\n');
    console.log('Path'.padEnd(50), 'Branch'.padEnd(40), 'Commit'.padEnd(10), 'Status');
    console.log('-'.repeat(110));
    
    for (const wt of worktrees) {
      const shortPath = wt.path.length > 48 ? '...' + wt.path.slice(-45) : wt.path;
      const shortBranch = wt.branch.length > 38 ? wt.branch.slice(0, 35) + '...' : wt.branch;
      console.log(
        shortPath.padEnd(50),
        shortBranch.padEnd(40),
        (wt.commit || '-').padEnd(10),
        wt.status
      );
    }
    
    console.log(`\nTotal worktrees: ${worktrees.length}`);
    
    // Check if we're in a worktree
    const currentDir = process.cwd();
    const currentWorktreeInfo = worktrees.find(wt => currentDir.startsWith(wt.path));
    if (currentWorktreeInfo) {
      console.log(`\nCurrent worktree: ${currentWorktreeInfo.branch} (${currentWorktreeInfo.path})`);
    }
    
  } catch (error) {
    console.error('Error listing worktrees:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Usage: list-worktrees [options]

Options:
  --help    Show this help message

Lists all git worktrees in the repository, showing their paths, branches, and status.
`);
  process.exit(0);
}

listWorktrees();