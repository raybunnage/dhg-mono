#!/usr/bin/env ts-node
/**
 * Update task status or details
 * 
 * Usage:
 *   ts-node update-task.ts <task-id> [--status in_progress] [--priority high] [--add-tag new-tag]
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface UpdateTaskOptions {
  status?: string;
  priority?: string;
  addTag?: string;
}

async function updateTask(taskId: string, options: UpdateTaskOptions) {
  try {
    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    };
    
    if (options.status) {
      updates.status = options.status;
      if (options.status === 'in_progress' && !updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
    }
    
    if (options.priority) {
      updates.priority = options.priority;
    }
    
    // Update the task
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
      
    if (error) throw error;
    
    if (!task) {
      console.error('❌ Task not found');
      process.exit(1);
    }
    
    // Add tag if specified
    if (options.addTag) {
      const { error: tagError } = await supabase
        .from('dev_task_tags')
        .insert({
          task_id: taskId,
          tag: options.addTag
        });
        
      if (tagError && !tagError.message.includes('duplicate')) {
        console.warn('⚠️  Warning: Failed to add tag:', tagError.message);
      }
    }
    
    console.log(`✅ Task updated: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Priority: ${task.priority}`);
    
    if (options.addTag) {
      console.log(`   Added tag: ${options.addTag}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error updating task:', error.message);
    process.exit(1);
  }
}

program
  .argument('<taskId>', 'Task ID to update')
  .option('--status <status>', 'Update status: pending, in_progress, completed')
  .option('--priority <priority>', 'Update priority: low, medium, high')
  .option('--add-tag <tag>', 'Add a new tag to the task')
  .parse(process.argv);

const [taskId] = program.args;
const options = program.opts() as UpdateTaskOptions;

if (!taskId) {
  console.error('❌ Error: Task ID is required');
  process.exit(1);
}

updateTask(taskId, options).catch(console.error);