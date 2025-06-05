#!/usr/bin/env ts-node
/**
 * Format task for copying to Claude
 * 
 * Usage:
 *   ts-node copy-request.ts <task-id> [--clipboard]
 */

import { program } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const execAsync = promisify(exec);
const supabase = SupabaseClientService.getInstance().getClient();

interface CopyRequestOptions {
  clipboard?: boolean;
}

async function copyRequest(taskId: string, options: CopyRequestOptions) {
  try {
    // Get task with tags
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .select(`
        *,
        dev_task_tags (tag),
        dev_task_files (file_path, action)
      `)
      .eq('id', taskId)
      .single();
      
    if (error) throw error;
    
    if (!task) {
      console.error('❌ Task not found');
      process.exit(1);
    }
    
    // Format the request
    const request = formatEnhancedRequest(task);
    
    // Copy to clipboard if requested
    if (options.clipboard) {
      try {
        const platform = process.platform;
        if (platform === 'darwin') {
          await execAsync(`echo ${JSON.stringify(request)} | pbcopy`);
          console.log('✅ Request copied to clipboard!');
        } else {
          console.log('⚠️  Clipboard copy only supported on macOS. Request printed below:');
        }
      } catch (err) {
        console.warn('⚠️  Could not copy to clipboard. Request printed below:');
      }
    }
    
    // Always print the request
    console.log('\n' + '═'.repeat(60));
    console.log('COPY EVERYTHING BELOW THIS LINE');
    console.log('═'.repeat(60) + '\n');
    console.log(request);
    console.log('\n' + '═'.repeat(60));
    console.log('COPY EVERYTHING ABOVE THIS LINE');
    console.log('═'.repeat(60) + '\n');
    
    // Show next steps
    console.log('📋 Next steps:');
    console.log('1. Copy the request above');
    console.log('2. Paste it into Claude Code');
    console.log('3. Work with Claude to implement the task');
    console.log('4. When done, run:');
    console.log(`   ./dev-tasks-cli.sh complete ${task.id} --response "Claude's summary..."`);
    
  } catch (error: any) {
    console.error('❌ Error formatting request:', error.message);
    process.exit(1);
  }
}

function formatEnhancedRequest(task: any): string {
  const tags = task.dev_task_tags?.map((t: any) => t.tag).join(', ') || 'none';
  const existingFiles = task.dev_task_files?.map((f: any) => `- ${f.file_path} (${f.action})`).join('\n') || '';
  
  const lines = [
    `# Development Task: ${task.title}`,
    '',
    `**Task ID:** ${task.id}`,
    `**Type:** ${task.task_type}`,
    `**Priority:** ${task.priority}`,
    `**Tags:** ${tags}`,
    '',
    '## Description',
    task.description,
    ''
  ];
  
  // Add existing files if any
  if (existingFiles) {
    lines.push('## Already Modified Files');
    lines.push(existingFiles);
    lines.push('');
  }
  
  // Add context based on task type
  if (task.task_type === 'bug') {
    lines.push('## Bug Fix Requirements');
    lines.push('- Identify the root cause of the issue');
    lines.push('- Fix the bug without introducing new issues');
    lines.push('- Add appropriate error handling if needed');
    lines.push('- Test the fix with real data');
  } else if (task.task_type === 'feature') {
    lines.push('## Feature Implementation Requirements');
    lines.push('- Follow the project architecture patterns');
    lines.push('- Use existing shared services where appropriate');
    lines.push('- Add proper TypeScript types');
    lines.push('- Consider edge cases and error handling');
  } else if (task.task_type === 'refactor') {
    lines.push('## Refactoring Requirements');
    lines.push('- Maintain existing functionality (no breaking changes)');
    lines.push('- Improve code organization and readability');
    lines.push('- Follow project conventions from CLAUDE.md');
    lines.push('- Test thoroughly before and after changes');
  }
  
  lines.push('');
  lines.push('## General Requirements');
  lines.push('- Follow all guidelines in CLAUDE.md');
  lines.push('- Use TypeScript with explicit types (no implicit any)');
  lines.push('- Run `tsc --noEmit` to check for errors');
  lines.push('- Test implementation with real data');
  lines.push('- Provide a clear summary of changes when complete');
  lines.push('');
  lines.push('## When Complete');
  lines.push('Please provide:');
  lines.push('1. A summary of what was implemented/fixed');
  lines.push('2. List of files created or modified');
  lines.push('3. Any notable decisions or trade-offs made');
  lines.push('4. Testing steps performed');
  lines.push('5. Any follow-up tasks or considerations');
  
  return lines.join('\n');
}

program
  .argument('<taskId>', 'Task ID')
  .option('--clipboard', 'Also copy to clipboard (macOS only)')
  .parse(process.argv);

const [taskId] = program.args;
const options = program.opts() as CopyRequestOptions;

if (!taskId) {
  console.error('❌ Error: Task ID is required');
  process.exit(1);
}

copyRequest(taskId, options).catch(console.error);