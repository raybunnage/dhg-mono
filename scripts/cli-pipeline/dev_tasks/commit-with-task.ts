#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../../.env.development') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function getCurrentWorktree(): Promise<string> {
  try {
    const worktreePath = execSync('pwd', { encoding: 'utf-8' }).trim();
    return worktreePath;
  } catch (error) {
    console.error('Error getting current worktree:', error);
    return '';
  }
}

async function getTasksForWorktree(worktreePath: string) {
  const { data, error } = await supabase
    .from('dev_tasks')
    .select('*')
    .eq('worktree_path', worktreePath)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return data || [];
}

async function selectTask(tasks: any[]): Promise<any | null> {
  if (tasks.length === 0) {
    return null;
  }

  if (tasks.length === 1) {
    console.log(`\n📋 Found 1 active task in this worktree:`);
    console.log(`   ${tasks[0].title} (${tasks[0].task_type})`);
    const useTask = await question('\nUse this task for the commit? (Y/n): ');
    if (useTask.toLowerCase() !== 'n') {
      return tasks[0];
    }
    return null;
  }

  console.log(`\n📋 Found ${tasks.length} active tasks in this worktree:`);
  tasks.forEach((task, index) => {
    console.log(`   ${index + 1}. ${task.title} (${task.task_type}, ${task.status})`);
  });
  console.log(`   0. Don't use any task`);

  const choice = await question('\nSelect task number (or 0 for none): ');
  const index = parseInt(choice) - 1;

  if (index === -1) {
    return null;
  }

  if (index >= 0 && index < tasks.length) {
    return tasks[index];
  }

  console.log('Invalid selection');
  return null;
}

async function updateTaskWithCommit(taskId: string, commitSha: string) {
  // Get current task data
  const { data: task, error: fetchError } = await supabase
    .from('dev_tasks')
    .select('notes')
    .eq('id', taskId)
    .single();

  if (fetchError) {
    console.error('Error fetching task:', fetchError);
    return;
  }

  // Update task notes with commit reference
  const currentNotes = task.notes || '';
  const timestamp = new Date().toISOString();
  const updatedNotes = currentNotes + 
    `\n\n## Commit Reference\n- SHA: ${commitSha}\n- Time: ${timestamp}`;

  const { error: updateError } = await supabase
    .from('dev_tasks')
    .update({ 
      notes: updatedNotes,
      updated_at: timestamp
    })
    .eq('id', taskId);

  if (updateError) {
    console.error('Error updating task:', updateError);
  } else {
    console.log('✅ Task updated with commit reference');
  }
}

async function main() {
  try {
    // Get current worktree
    const worktreePath = await getCurrentWorktree();
    console.log('🌳 Current worktree:', worktreePath);

    // Get tasks for this worktree
    const tasks = await getTasksForWorktree(worktreePath);
    
    // Let user select a task
    const selectedTask = await selectTask(tasks);

    if (selectedTask) {
      console.log(`\n✅ Selected task: ${selectedTask.title}`);
      console.log(`   ID: ${selectedTask.id}`);
      
      // Output the task info for use in commit message
      console.log('\n📝 Add this to your commit message:');
      console.log(`Task: #${selectedTask.id}`);
      
      // Get the last commit SHA after the commit is made
      const answer = await question('\nHave you made the commit? (y/N): ');
      if (answer.toLowerCase() === 'y') {
        const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        await updateTaskWithCommit(selectedTask.id, commitSha);
      }
    } else {
      console.log('\n❌ No task selected for this commit');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

main();