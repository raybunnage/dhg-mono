#!/usr/bin/env ts-node
/**
 * List development tasks with filtering options
 * 
 * Usage:
 *   ts-node list-tasks.ts [--status pending] [--type bug] [--priority high] [--tag auth]
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface ListTasksOptions {
  status?: string;
  type?: string;
  priority?: string;
  tag?: string;
  limit?: string;
}

async function listTasks(options: ListTasksOptions) {
  try {
    let query = supabase
      .from('dev_tasks')
      .select(`
        *,
        dev_task_tags (tag)
      `)
      .order('created_at', { ascending: false });
      
    // Apply filters
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.type) {
      query = query.eq('task_type', options.type);
    }
    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    
    // Apply limit
    const limit = parseInt(options.limit || '20');
    query = query.limit(limit);
    
    const { data: tasks, error } = await query;
    
    if (error) throw error;
    
    // Filter by tag if specified
    let filteredTasks = tasks || [];
    if (options.tag && tasks) {
      filteredTasks = tasks.filter(task => 
        task.dev_task_tags?.some((t: any) => t.tag === options.tag)
      );
    }
    
    if (filteredTasks.length === 0) {
      console.log('No tasks found matching the criteria.');
      return;
    }
    
    // Group by status for better display
    const tasksByStatus = filteredTasks.reduce((acc: any, task: any) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    }, {});
    
    // Display tasks
    Object.entries(tasksByStatus).forEach(([status, statusTasks]: [string, any]) => {
      console.log(`\n📋 ${status.toUpperCase()} (${statusTasks.length})`);
      console.log('─'.repeat(50));
      
      statusTasks.forEach((task: any) => {
        const tags = task.dev_task_tags?.map((t: any) => t.tag).join(', ') || '';
        const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪';
        const typeEmoji = task.task_type === 'bug' ? '🐛' : task.task_type === 'feature' ? '✨' : '🔧';
        
        console.log(`${typeEmoji} ${priorityEmoji} ${task.title}`);
        console.log(`   ID: ${task.id}`);
        console.log(`   Created: ${new Date(task.created_at).toLocaleDateString()}`);
        if (tags) {
          console.log(`   Tags: ${tags}`);
        }
        if (task.completed_at) {
          console.log(`   Completed: ${new Date(task.completed_at).toLocaleDateString()}`);
        }
        console.log('');
      });
    });
    
    // Summary
    console.log('─'.repeat(50));
    console.log(`Total: ${filteredTasks.length} tasks`);
    
  } catch (error: any) {
    console.error('❌ Error listing tasks:', error.message);
    process.exit(1);
  }
}

program
  .option('--status <status>', 'Filter by status: pending, in_progress, completed')
  .option('--type <type>', 'Filter by type: bug, feature, refactor, question')
  .option('--priority <priority>', 'Filter by priority: low, medium, high')
  .option('--tag <tag>', 'Filter by tag')
  .option('--limit <limit>', 'Maximum number of tasks to show (default: 20)')
  .parse(process.argv);

const options = program.opts() as ListTasksOptions;

listTasks(options).catch(console.error);