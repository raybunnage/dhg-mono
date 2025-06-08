#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface DevTask {
  id: string;
  title: string;
  description: string;
  status: string | null;
  worktree_path: string | null;
  app: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
}

async function checkDevTasks() {
  const supabase = SupabaseClientService.getInstance().getClient();

  console.log('Checking dev_tasks table for relevant tasks...\n');

  // Query 1: Tasks for main worktree path
  console.log('1. Tasks for main worktree path (/Users/raybunnage/Documents/github/dhg-mono):');
  const { data: worktreeTasks, error: worktreeError } = await supabase
    .from('dev_tasks')
    .select('id, title, description, status, worktree_path, app, priority, created_at, updated_at')
    .eq('worktree_path', '/Users/raybunnage/Documents/github/dhg-mono')
    .order('created_at', { ascending: false });

  if (worktreeError) {
    console.error('Error fetching worktree tasks:', worktreeError);
  } else {
    console.log(`Found ${worktreeTasks?.length || 0} tasks for main worktree`);
    if (worktreeTasks && worktreeTasks.length > 0) {
      worktreeTasks.forEach((task: DevTask) => {
        console.log(`- [${task.status}] ${task.title} (ID: ${task.id})`);
        if (task.app) console.log(`  App: ${task.app}`);
        if (task.priority) console.log(`  Priority: ${task.priority}`);
      });
    }
  }

  // Query 2: Tasks related to registry, dependency, or service mapping
  console.log('\n2. Tasks related to "registry", "dependency", or "service mapping":');
  const { data: relatedTasks, error: relatedError } = await supabase
    .from('dev_tasks')
    .select('id, title, description, status, worktree_path, app, priority, created_at, updated_at')
    .or('title.ilike.%registry%,description.ilike.%registry%,title.ilike.%dependency%,description.ilike.%dependency%,title.ilike.%service mapping%,description.ilike.%service mapping%')
    .order('created_at', { ascending: false });

  if (relatedError) {
    console.error('Error fetching related tasks:', relatedError);
  } else {
    console.log(`Found ${relatedTasks?.length || 0} related tasks`);
    if (relatedTasks && relatedTasks.length > 0) {
      relatedTasks.forEach((task: DevTask) => {
        console.log(`- [${task.status}] ${task.title} (ID: ${task.id})`);
        console.log(`  Description: ${task.description.substring(0, 100)}...`);
        if (task.worktree_path) console.log(`  Worktree: ${task.worktree_path}`);
        if (task.app) console.log(`  App: ${task.app}`);
        if (task.priority) console.log(`  Priority: ${task.priority}`);
      });
    }
  }

  // Query 3: All tasks with status 'in_progress'
  console.log('\n3. All tasks with status "in_progress":');
  const { data: inProgressTasks, error: inProgressError } = await supabase
    .from('dev_tasks')
    .select('id, title, description, status, worktree_path, app, priority, created_at, updated_at')
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false });

  if (inProgressError) {
    console.error('Error fetching in-progress tasks:', inProgressError);
  } else {
    console.log(`Found ${inProgressTasks?.length || 0} in-progress tasks`);
    if (inProgressTasks && inProgressTasks.length > 0) {
      inProgressTasks.forEach((task: DevTask) => {
        console.log(`- ${task.title} (ID: ${task.id})`);
        console.log(`  Description: ${task.description.substring(0, 100)}...`);
        if (task.worktree_path) console.log(`  Worktree: ${task.worktree_path}`);
        if (task.app) console.log(`  App: ${task.app}`);
        if (task.priority) console.log(`  Priority: ${task.priority}`);
        if (task.updated_at) console.log(`  Last updated: ${new Date(task.updated_at).toLocaleString()}`);
      });
    }
  }
}

checkDevTasks().catch(console.error);