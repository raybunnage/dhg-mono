#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';

const supabase = createSupabaseAdapter();

async function commitWithTask(message: string) {
  try {
    // Get current worktree path
    const worktreePath = process.cwd();
    
    // Find active task in this worktree
    const { data: activeTasks, error } = await supabase
      .from('dev_tasks')
      .select('id, title, task_number')
      .eq('worktree_path', worktreePath)
      .eq('status', 'in_progress')
      .limit(1);

    if (error) {
      console.error('Error finding active task:', error);
      return;
    }

    let finalMessage = message;
    let taskId = null;

    if (activeTasks && activeTasks.length > 0) {
      const task = activeTasks[0];
      taskId = task.id;
      // Add task reference to commit message
      finalMessage = `[TASK-${task.task_number}] ${message}\n\nRelated to: ${task.title}\nTask ID: ${task.id}`;
      console.log(`📋 Found active task: ${task.title}`);
    } else {
      console.log('⚠️  No active task found in this worktree');
    }

    // Get current branch
    const currentBranch = execSync('git branch --show-current').toString().trim();
    
    // Get commit info before committing
    const beforeCommit = execSync('git rev-parse HEAD').toString().trim();
    
    // Make the commit
    execSync(`git add .`);
    execSync(`git commit -m "${finalMessage}"`);
    
    // Get new commit hash
    const afterCommit = execSync('git rev-parse HEAD').toString().trim();
    
    console.log(`✅ Committed with hash: ${afterCommit}`);

    // If we have a task, update the database
    if (taskId && beforeCommit !== afterCommit) {
      // Get commit details
      const commitInfo = execSync(`git show --stat --format="%H|%an|%ae|%ai|%s" ${afterCommit}`).toString();
      const [hash, author, email, date, subject] = commitInfo.split('|');
      
      // Get files changed
      const filesChanged = execSync(`git diff-tree --no-commit-id --name-only -r ${afterCommit}`).toString().trim().split('\n');
      
      // Get insertions/deletions
      const stats = execSync(`git show --shortstat --format="" ${afterCommit}`).toString().trim();
      const insertionsMatch = stats.match(/(\d+) insertions?/);
      const deletionsMatch = stats.match(/(\d+) deletions?/);
      
      const insertions = insertionsMatch ? parseInt(insertionsMatch[1]) : 0;
      const deletions = deletionsMatch ? parseInt(deletionsMatch[1]) : 0;

      // Insert into dev_task_commits
      const { error: commitError } = await supabase
        .from('dev_task_commits')
        .insert({
          task_id: taskId,
          commit_hash: hash,
          commit_message: subject,
          commit_date: date,
          author_name: author,
          author_email: email,
          files_changed: filesChanged,
          insertions,
          deletions,
          branch_name: currentBranch
        });

      if (commitError) {
        console.error('Error logging commit to task:', commitError);
      } else {
        console.log('📝 Commit linked to task in database');
      }

      // Update task's current commit and count
      const { data: taskCommits } = await supabase
        .from('dev_task_commits')
        .select('id')
        .eq('task_id', taskId);

      await supabase
        .from('dev_tasks')
        .update({
          git_commit_current: hash,
          git_commits_count: taskCommits?.length || 1
        })
        .eq('id', taskId);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const message = args.join(' ');

if (!message) {
  console.error('Usage: commit-with-task <commit message>');
  process.exit(1);
}

commitWithTask(message);