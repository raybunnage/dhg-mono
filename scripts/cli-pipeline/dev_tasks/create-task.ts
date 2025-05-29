#!/usr/bin/env ts-node
/**
 * Create a new development task
 * 
 * Usage:
 *   ts-node create-task.ts --title "Fix auth" --description "Details..." --type bug --priority high --tags "auth,urgent"
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface CreateTaskOptions {
  title: string;
  description: string;
  type?: string;
  priority?: string;
  tags?: string;
}

async function createTask(options: CreateTaskOptions) {
  try {
    // Parse tags if provided
    const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
    
    // Format the Claude request
    const claudeRequest = formatClaudeRequest({
      title: options.title,
      description: options.description,
      type: options.type || 'feature',
      priority: options.priority || 'medium'
    });
    
    // Create the task
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .insert({
        title: options.title,
        description: options.description,
        task_type: options.type || 'feature',
        priority: options.priority || 'medium',
        status: 'pending',
        claude_request: claudeRequest
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Add tags if provided
    if (tags.length > 0 && task) {
      const tagInserts = tags.map(tag => ({
        task_id: task.id,
        tag: tag
      }));
      
      const { error: tagError } = await supabase
        .from('dev_task_tags')
        .insert(tagInserts);
        
      if (tagError) {
        console.warn('⚠️  Warning: Failed to add tags:', tagError.message);
      }
    }
    
    console.log(`✅ Task created: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Type: ${task.task_type}`);
    console.log(`   Priority: ${task.priority}`);
    if (tags.length > 0) {
      console.log(`   Tags: ${tags.join(', ')}`);
    }
    console.log('');
    console.log('📋 To copy request to Claude, run:');
    console.log(`   ./dev-tasks-cli.sh copy-request ${task.id}`);
    
  } catch (error: any) {
    console.error('❌ Error creating task:', error.message);
    process.exit(1);
  }
}

function formatClaudeRequest(task: any): string {
  const lines = [
    `# Task: ${task.title}`,
    '',
    `**Type:** ${task.type}`,
    `**Priority:** ${task.priority}`,
    '',
    '## Description',
    task.description,
    '',
    '## Requirements',
    '- Please implement this task following the project guidelines in CLAUDE.md',
    '- Use appropriate shared services where available',
    '- Follow TypeScript best practices',
    '- Test the implementation with real data',
    '- Provide a summary of changes when complete'
  ];
  
  return lines.join('\n');
}

program
  .option('--title <title>', 'Task title (required)')
  .option('--description <description>', 'Task description (required)')
  .option('--type <type>', 'Task type: bug, feature, refactor, question (default: feature)')
  .option('--priority <priority>', 'Priority: low, medium, high (default: medium)')
  .option('--tags <tags>', 'Comma-separated tags')
  .parse(process.argv);

const options = program.opts() as CreateTaskOptions;

if (!options.title || !options.description) {
  console.error('❌ Error: --title and --description are required');
  process.exit(1);
}

createTask(options).catch(console.error);