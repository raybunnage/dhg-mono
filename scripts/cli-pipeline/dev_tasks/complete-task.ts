#!/usr/bin/env ts-node
/**
 * Mark task as complete with Claude's response
 * 
 * Usage:
 *   ts-node complete-task.ts <task-id> --response "Claude's summary..."
 *   ts-node complete-task.ts <task-id> --response-file response.txt
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface CompleteTaskOptions {
  response?: string;
  responseFile?: string;
}

async function completeTask(taskId: string, options: CompleteTaskOptions) {
  try {
    // Get the response content
    let response = '';
    if (options.responseFile) {
      try {
        response = readFileSync(options.responseFile, 'utf8');
      } catch (err) {
        console.error('❌ Error reading response file:', err);
        process.exit(1);
      }
    } else if (options.response) {
      response = options.response;
    } else {
      console.error('❌ Error: Either --response or --response-file is required');
      process.exit(1);
    }
    
    // Update the task
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .update({
        status: 'completed',
        claude_response: response,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();
      
    if (error) throw error;
    
    if (!task) {
      console.error('❌ Task not found');
      process.exit(1);
    }
    
    // Also create a work summary if it was a substantial task
    if (task.task_type !== 'question') {
      await createWorkSummary(task, response);
    }
    
    console.log(`✅ Task completed: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Type: ${task.task_type}`);
    console.log(`   Completed at: ${new Date(task.completed_at).toLocaleString()}`);
    console.log('');
    console.log('📝 Response summary:');
    console.log(response.split('\n').slice(0, 5).join('\n'));
    if (response.split('\n').length > 5) {
      console.log('   ... (truncated)');
    }
    
  } catch (error: any) {
    console.error('❌ Error completing task:', error.message);
    process.exit(1);
  }
}

async function createWorkSummary(task: any, response: string) {
  try {
    // Extract key information from the response
    const summary = extractSummary(response);
    const commands = extractCommands(response);
    
    // Get task tags
    const { data: tags } = await supabase
      .from('dev_task_tags')
      .select('tag')
      .eq('task_id', task.id);
      
    const tagList = tags?.map(t => t.tag) || [];
    
    // Create work summary
    const { error } = await supabase
      .from('ai_work_summaries')
      .insert({
        title: task.title,
        summary_content: summary,
        commands: commands,
        tags: tagList,
        category: mapTaskTypeToCategory(task.task_type),
        metadata: {
          dev_task_id: task.id,
          priority: task.priority
        },
        work_date: new Date().toISOString().split('T')[0]
      });
      
    if (!error) {
      console.log('');
      console.log('📊 Work summary also created');
    }
  } catch (err) {
    // Don't fail the whole operation if work summary fails
    console.warn('⚠️  Could not create work summary:', err);
  }
}

function extractSummary(response: string): string {
  // Try to extract a concise summary from Claude's response
  const lines = response.split('\n').filter(l => l.trim());
  
  // Look for summary indicators
  const summaryIndex = lines.findIndex(l => 
    l.toLowerCase().includes('summary') || 
    l.toLowerCase().includes('completed') ||
    l.toLowerCase().includes('implemented')
  );
  
  if (summaryIndex >= 0 && summaryIndex < lines.length - 1) {
    return lines.slice(summaryIndex, summaryIndex + 3).join(' ');
  }
  
  // Default to first few lines
  return lines.slice(0, 3).join(' ');
}

function extractCommands(response: string): string[] {
  const commands: string[] = [];
  const lines = response.split('\n');
  
  // Look for command patterns
  lines.forEach(line => {
    if (line.match(/^\s*(npm|pnpm|yarn|bash|sh|\.\/|ts-node|node)\s+/)) {
      commands.push(line.trim());
    }
  });
  
  return commands.slice(0, 5); // Limit to 5 commands
}

function mapTaskTypeToCategory(taskType: string): string {
  const mapping: Record<string, string> = {
    'bug': 'bug_fix',
    'feature': 'feature',
    'refactor': 'refactoring',
    'question': 'research'
  };
  return mapping[taskType] || 'feature';
}

program
  .argument('<taskId>', 'Task ID to complete')
  .option('--response <response>', 'Claude\'s response text')
  .option('--response-file <file>', 'File containing Claude\'s response')
  .parse(process.argv);

const [taskId] = program.args;
const options = program.opts() as CompleteTaskOptions;

if (!taskId) {
  console.error('❌ Error: Task ID is required');
  process.exit(1);
}

completeTask(taskId, options).catch(console.error);