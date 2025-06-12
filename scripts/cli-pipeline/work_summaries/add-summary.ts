#!/usr/bin/env ts-node
/**
 * Add a work summary to the database
 * 
 * Usage:
 *   ts-node add-summary.ts --title "Title" --content "Summary content" [options]
 * 
 * Options:
 *   --title <title>        Title of the work (required)
 *   --content <content>    Summary content (required)
 *   --commands <cmd1,cmd2> Comma-separated list of commands
 *   --tags <tag1,tag2>     Comma-separated list of tags
 *   --category <category>  Category (bug_fix, feature, refactoring, documentation)
 *   --task-id <task-id>    Link to dev task ID
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

async function findTaskIdInContent(content: string): Promise<string | null> {
  // Look for task ID patterns in the content
  const patterns = [
    /Task:\s*#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    /task[_-]id[:\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    /#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function getCurrentWorktree(): Promise<string> {
  try {
    const { stdout } = await execAsync('git branch --show-current');
    return stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function addSummary() {
  const title = getArg('title');
  const content = getArg('content');
  const commandsStr = getArg('commands');
  const tagsStr = getArg('tags');
  const category = getArg('category') || 'feature';
  const explicitTaskId = getArg('task-id');

  if (!title || !content) {
    console.error('Error: Both --title and --content are required');
    console.log('\nUsage:');
    console.log('  add-summary --title "Title" --content "Summary content" [options]');
    console.log('\nOptions:');
    console.log('  --commands <cmd1,cmd2>  Commands worked on');
    console.log('  --tags <tag1,tag2>      Tags for searching');
    console.log('  --category <category>   Category (bug_fix, feature, refactoring, documentation)');
    console.log('  --task-id <task-id>     Link to dev task ID');
    process.exit(1);
  }

  const commands = commandsStr ? commandsStr.split(',').map(c => c.trim()) : [];
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
  
  // Try to find task ID - explicit first, then from content
  const taskId = explicitTaskId || await findTaskIdInContent(content);
  const worktree = await getCurrentWorktree();

  try {
    // Build metadata with task ID if found
    const metadata: any = {};
    if (taskId) {
      metadata.dev_task_id = taskId;
      console.log(`🔗 Linking to dev task: ${taskId}`);
    }
    
    const { data, error } = await supabase
      .from('ai_work_summaries')
      .insert({
        title,
        summary_content: content,
        commands,
        tags,
        category,
        worktree,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        work_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Work summary added successfully');
    console.log(`   ID: ${data.id}`);
    console.log(`   Title: ${data.title}`);
    if (taskId) {
      console.log(`   Linked to task: ${taskId}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addSummary();