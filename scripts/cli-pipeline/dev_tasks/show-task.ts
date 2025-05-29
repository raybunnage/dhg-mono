#!/usr/bin/env ts-node
/**
 * Show detailed task information
 * 
 * Usage:
 *   ts-node show-task.ts <task-id>
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function showTask(taskId: string) {
  try {
    // Get task with related data
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .select(`
        *,
        dev_task_tags (tag),
        dev_task_files (file_path, action, created_at)
      `)
      .eq('id', taskId)
      .single();
      
    if (error) throw error;
    
    if (!task) {
      console.error('❌ Task not found');
      process.exit(1);
    }
    
    // Display task details
    const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪';
    const typeEmoji = task.task_type === 'bug' ? '🐛' : task.task_type === 'feature' ? '✨' : '🔧';
    const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '📋';
    
    console.log('═'.repeat(60));
    console.log(`${typeEmoji} ${priorityEmoji} ${task.title}`);
    console.log('═'.repeat(60));
    
    console.log(`\n📌 Task Details`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Status: ${statusEmoji} ${task.status}`);
    console.log(`   Type: ${task.task_type}`);
    console.log(`   Priority: ${task.priority}`);
    console.log(`   Created: ${new Date(task.created_at).toLocaleString()}`);
    
    if (task.started_at) {
      console.log(`   Started: ${new Date(task.started_at).toLocaleString()}`);
    }
    
    if (task.completed_at) {
      console.log(`   Completed: ${new Date(task.completed_at).toLocaleString()}`);
    }
    
    // Tags
    if (task.dev_task_tags && task.dev_task_tags.length > 0) {
      const tags = task.dev_task_tags.map((t: any) => t.tag).join(', ');
      console.log(`   Tags: ${tags}`);
    }
    
    // Description
    console.log(`\n📝 Description`);
    console.log('─'.repeat(60));
    console.log(task.description);
    
    // Claude Request
    if (task.claude_request) {
      console.log(`\n🤖 Claude Request`);
      console.log('─'.repeat(60));
      console.log(task.claude_request);
    }
    
    // Claude Response
    if (task.claude_response) {
      console.log(`\n💬 Claude Response`);
      console.log('─'.repeat(60));
      console.log(task.claude_response);
    }
    
    // Affected Files
    if (task.dev_task_files && task.dev_task_files.length > 0) {
      console.log(`\n📁 Affected Files (${task.dev_task_files.length})`);
      console.log('─'.repeat(60));
      task.dev_task_files.forEach((file: any) => {
        const actionEmoji = file.action === 'created' ? '✨' : 
                           file.action === 'modified' ? '📝' : 
                           file.action === 'deleted' ? '🗑️' : '📄';
        console.log(`${actionEmoji} ${file.file_path} (${file.action})`);
      });
    }
    
    // Next actions
    console.log(`\n🎯 Next Actions`);
    console.log('─'.repeat(60));
    if (task.status === 'pending') {
      console.log('1. Copy the request to Claude:');
      console.log(`   ./dev-tasks-cli.sh copy-request ${task.id}`);
      console.log('2. Update status to in_progress:');
      console.log(`   ./dev-tasks-cli.sh update ${task.id} --status in_progress`);
    } else if (task.status === 'in_progress') {
      console.log('1. Add affected files:');
      console.log(`   ./dev-tasks-cli.sh add-file ${task.id} --path "path/to/file" --action modified`);
      console.log('2. Complete the task:');
      console.log(`   ./dev-tasks-cli.sh complete ${task.id} --response "Claude's response..."`);
    } else {
      console.log('Task is completed! 🎉');
    }
    
  } catch (error: any) {
    console.error('❌ Error showing task:', error.message);
    process.exit(1);
  }
}

program
  .argument('<taskId>', 'Task ID to show')
  .parse(process.argv);

const [taskId] = program.args;

if (!taskId) {
  console.error('❌ Error: Task ID is required');
  process.exit(1);
}

showTask(taskId).catch(console.error);