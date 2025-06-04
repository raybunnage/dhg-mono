#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import Table from 'cli-table3';
import chalk from 'chalk';

interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMainWorktree: boolean;
}

function getGitInfo() {
  try {
    // Get current branch
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    
    // Get latest commit
    const latestCommit = execSync('git log -1 --oneline', { encoding: 'utf-8' }).trim();
    
    // Get remote URL
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    
    // Get worktree information
    const worktreeOutput = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktrees = parseWorktrees(worktreeOutput);
    
    // Get status summary
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    const statusLines = statusOutput.split('\n').filter(line => line.trim());
    
    // Display information
    console.log(chalk.blue.bold('\n📊 Git Repository Information\n'));
    
    // Basic info table
    const infoTable = new Table({
      head: [chalk.cyan('Property'), chalk.cyan('Value')],
      colWidths: [20, 60]
    });
    
    infoTable.push(
      ['Current Branch', chalk.yellow(currentBranch)],
      ['Latest Commit', latestCommit],
      ['Remote URL', remoteUrl],
      ['Working Tree', statusLines.length === 0 ? chalk.green('Clean') : chalk.red(`${statusLines.length} changes`)]
    );
    
    console.log(infoTable.toString());
    
    // Worktree table
    if (worktrees.length > 0) {
      console.log(chalk.blue.bold('\n🌳 Git Worktrees\n'));
      const worktreeTable = new Table({
        head: [chalk.cyan('Path'), chalk.cyan('Branch'), chalk.cyan('Type')],
        colWidths: [50, 30, 15]
      });
      
      worktrees.forEach(wt => {
        worktreeTable.push([
          wt.path,
          chalk.yellow(wt.branch),
          wt.isMainWorktree ? chalk.green('Main') : 'Worktree'
        ]);
      });
      
      console.log(worktreeTable.toString());
    }
    
    // Status details if there are changes
    if (statusLines.length > 0) {
      console.log(chalk.blue.bold('\n📝 Uncommitted Changes\n'));
      const statusTable = new Table({
        head: [chalk.cyan('Status'), chalk.cyan('File')],
        colWidths: [10, 70]
      });
      
      statusLines.slice(0, 10).forEach(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        let statusDisplay = status;
        
        if (status.includes('M')) statusDisplay = chalk.yellow('Modified');
        else if (status.includes('A')) statusDisplay = chalk.green('Added');
        else if (status.includes('D')) statusDisplay = chalk.red('Deleted');
        else if (status === '??') statusDisplay = chalk.gray('Untracked');
        
        statusTable.push([statusDisplay, file]);
      });
      
      if (statusLines.length > 10) {
        statusTable.push(['...', `and ${statusLines.length - 10} more files`]);
      }
      
      console.log(statusTable.toString());
    }
    
    // Recent commits
    console.log(chalk.blue.bold('\n📅 Recent Commits\n'));
    const commits = execSync('git log -5 --pretty=format:"%h|%an|%ar|%s"', { encoding: 'utf-8' })
      .split('\n')
      .filter(line => line.trim());
    
    const commitTable = new Table({
      head: [chalk.cyan('Hash'), chalk.cyan('Author'), chalk.cyan('When'), chalk.cyan('Message')],
      colWidths: [10, 20, 15, 35]
    });
    
    commits.forEach(commit => {
      const [hash, author, when, message] = commit.split('|');
      commitTable.push([
        chalk.yellow(hash),
        author,
        chalk.gray(when),
        message.substring(0, 33) + (message.length > 33 ? '...' : '')
      ]);
    });
    
    console.log(commitTable.toString());
    console.log();
    
  } catch (error) {
    console.error(chalk.red('Error getting git information:'), error.message);
    process.exit(1);
  }
}

function parseWorktrees(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const lines = output.split('\n');
  let currentWorktree: Partial<WorktreeInfo> = {};
  
  lines.forEach(line => {
    if (line.startsWith('worktree ')) {
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
      }
      currentWorktree = {
        path: line.substring(9),
        isMainWorktree: false
      };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.commit = line.substring(5);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
    } else if (line === 'bare') {
      currentWorktree.isMainWorktree = true;
    }
  });
  
  if (currentWorktree.path) {
    worktrees.push(currentWorktree as WorktreeInfo);
  }
  
  return worktrees;
}

// Run the command
getGitInfo();