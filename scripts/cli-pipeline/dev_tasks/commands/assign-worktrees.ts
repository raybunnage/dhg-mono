#!/usr/bin/env ts-node

/**
 * Analyze git commits to assign worktrees to dev_tasks
 * This command mines git history to find task references and determine which worktree they were worked on
 */

import { execSync } from 'child_process';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as path from 'path';
import * as fs from 'fs';

interface TaskCommit {
  taskId: string;
  commitHash: string;
  worktreePath: string;
  commitDate: string;
  message: string;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

async function getWorktreeList(): Promise<WorktreeInfo[]> {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};
    
    output.split('\n').forEach(line => {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as WorktreeInfo);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      }
    });
    
    if (current.path) {
      worktrees.push(current as WorktreeInfo);
    }
    
    return worktrees;
  } catch (error) {
    console.error('Error getting worktree list:', error);
    return [];
  }
}

async function getCommitsWithTaskIds(worktreePath: string): Promise<TaskCommit[]> {
  const commits: TaskCommit[] = [];
  
  try {
    // Change to worktree directory
    process.chdir(worktreePath);
    
    // Get commits with task IDs in the message
    const gitLog = execSync(
      'git log --all --grep="Task: #" --pretty=format:"%H|%ai|%s" --since="6 months ago"',
      { encoding: 'utf-8' }
    );
    
    if (!gitLog) return commits;
    
    gitLog.split('\n').forEach(line => {
      if (!line) return;
      
      const [hash, date, message] = line.split('|');
      
      // Extract task IDs from commit message
      const taskMatches = message.matchAll(/Task:\s*#([a-f0-9-]{36})/g);
      
      for (const match of taskMatches) {
        commits.push({
          taskId: match[1],
          commitHash: hash,
          worktreePath: worktreePath,
          commitDate: date,
          message: message
        });
      }
    });
  } catch (error) {
    console.error(`Error getting commits for ${worktreePath}:`, error);
  }
  
  return commits;
}

async function analyzeUnassignedTasks(worktrees: WorktreeInfo[]): Promise<Map<string, string>> {
  const taskWorktreeMap = new Map<string, string>();
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all tasks without worktree assignments
  const { data: unassignedTasks, error } = await supabase
    .from('dev_tasks')
    .select('id, title, git_branch, created_at')
    .is('worktree_path', null);
  
  if (error) {
    console.error('Error fetching unassigned tasks:', error);
    return taskWorktreeMap;
  }
  
  console.log(`Found ${unassignedTasks?.length || 0} tasks without worktree assignments`);
  
  // For each unassigned task, try to determine worktree based on:
  // 1. Git branch name matching
  // 2. Timing of creation vs worktree activity
  // 3. Related commits in worktree history
  
  for (const task of unassignedTasks || []) {
    let bestMatch: { worktree: string; confidence: number } | null = null;
    
    for (const worktree of worktrees) {
      let confidence = 0;
      
      // Check if branch names are related
      if (task.git_branch && worktree.branch) {
        if (worktree.branch.includes(task.git_branch) || 
            task.git_branch.includes(worktree.branch)) {
          confidence += 50;
        }
      }
      
      // Check for commits mentioning the task (without Task ID format)
      try {
        process.chdir(worktree.path);
        const searchResult = execSync(
          `git log --all --grep="${task.title.substring(0, 30)}" --pretty=format:"%H" --since="6 months ago" | head -1`,
          { encoding: 'utf-8' }
        ).trim();
        
        if (searchResult) {
          confidence += 30;
        }
      } catch {
        // Ignore errors
      }
      
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { worktree: worktree.path, confidence };
      }
    }
    
    // Only assign if we have reasonable confidence
    if (bestMatch && bestMatch.confidence >= 30) {
      taskWorktreeMap.set(task.id, bestMatch.worktree);
      console.log(`Task "${task.title}" -> ${bestMatch.worktree} (confidence: ${bestMatch.confidence})`);
    }
  }
  
  return taskWorktreeMap;
}

async function assignWorktreets() {
  console.log('🔍 Analyzing git commits to assign worktrees to tasks...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const originalCwd = process.cwd();
  
  try {
    // Get all worktrees
    const worktrees = await getWorktreeList();
    console.log(`Found ${worktrees.length} worktrees:`);
    worktrees.forEach(wt => console.log(`  - ${wt.path} (${wt.branch})`));
    console.log('');
    
    // Collect all commits with task IDs from all worktrees
    const allTaskCommits: TaskCommit[] = [];
    
    for (const worktree of worktrees) {
      console.log(`Scanning ${worktree.path}...`);
      const commits = await getCommitsWithTaskIds(worktree.path);
      allTaskCommits.push(...commits);
      console.log(`  Found ${commits.length} commits with task IDs`);
    }
    
    // Group commits by task ID and find the most common worktree
    const taskWorktreeMap = new Map<string, { path: string; count: number }>();
    
    allTaskCommits.forEach(commit => {
      const current = taskWorktreeMap.get(commit.taskId);
      if (!current) {
        taskWorktreeMap.set(commit.taskId, { path: commit.worktreePath, count: 1 });
      } else if (current.path === commit.worktreePath) {
        current.count++;
      } else {
        // Different worktree - keep the one with more commits
        const otherCount = allTaskCommits.filter(c => 
          c.taskId === commit.taskId && c.worktreePath === commit.worktreePath
        ).length;
        if (otherCount > current.count) {
          taskWorktreeMap.set(commit.taskId, { path: commit.worktreePath, count: otherCount });
        }
      }
    });
    
    console.log(`\n📊 Found ${taskWorktreeMap.size} tasks with commits`);
    
    // Update tasks in database
    let updateCount = 0;
    for (const [taskId, worktreeInfo] of taskWorktreeMap) {
      const { error } = await supabase
        .from('dev_tasks')
        .update({ 
          worktree_path: worktreeInfo.path,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
      
      if (!error) {
        updateCount++;
      } else {
        console.error(`Failed to update task ${taskId}:`, error);
      }
    }
    
    console.log(`✅ Updated ${updateCount} tasks with worktree assignments\n`);
    
    // Analyze unassigned tasks
    console.log('🔎 Analyzing unassigned tasks...');
    const inferredAssignments = await analyzeUnassignedTasks(worktrees);
    
    // Update inferred assignments
    let inferredCount = 0;
    for (const [taskId, worktreePath] of inferredAssignments) {
      const { error } = await supabase
        .from('dev_tasks')
        .update({ 
          worktree_path: worktreePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
      
      if (!error) {
        inferredCount++;
      }
    }
    
    console.log(`✅ Assigned ${inferredCount} additional tasks based on analysis\n`);
    
    // Get final statistics
    const { data: stats } = await supabase
      .from('dev_tasks')
      .select('worktree_path')
      .not('worktree_path', 'is', null);
    
    const { data: totalTasks } = await supabase
      .from('dev_tasks')
      .select('count');
    
    console.log('📈 Final Statistics:');
    console.log(`  Total tasks: ${totalTasks?.[0]?.count || 0}`);
    console.log(`  Tasks with worktrees: ${stats?.length || 0}`);
    console.log(`  Coverage: ${Math.round((stats?.length || 0) / (totalTasks?.[0]?.count || 1) * 100)}%`);
    
    // Show worktree distribution
    const distribution = new Map<string, number>();
    stats?.forEach(task => {
      const count = distribution.get(task.worktree_path) || 0;
      distribution.set(task.worktree_path, count + 1);
    });
    
    console.log('\n📊 Worktree Distribution:');
    Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([worktree, count]) => {
        console.log(`  ${path.basename(worktree)}: ${count} tasks`);
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Return to original directory
    process.chdir(originalCwd);
  }
}

// Run the command
if (require.main === module) {
  assignWorktreets();
}

export { assignWorktreets };