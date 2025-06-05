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
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

async function addSummary() {
  const title = getArg('title');
  const content = getArg('content');
  const commandsStr = getArg('commands');
  const tagsStr = getArg('tags');
  const category = getArg('category') || 'feature';

  if (!title || !content) {
    console.error('Error: Both --title and --content are required');
    console.log('\nUsage:');
    console.log('  add-summary --title "Title" --content "Summary content" [options]');
    console.log('\nOptions:');
    console.log('  --commands <cmd1,cmd2>  Commands worked on');
    console.log('  --tags <tag1,tag2>      Tags for searching');
    console.log('  --category <category>   Category (bug_fix, feature, refactoring, documentation)');
    process.exit(1);
  }

  const commands = commandsStr ? commandsStr.split(',').map(c => c.trim()) : [];
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];

  try {
    const { data, error } = await supabase
      .from('ai_work_summaries')
      .insert({
        title,
        summary_content: content,
        commands,
        tags,
        category,
        work_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Work summary added successfully');
    console.log(`   ID: ${data.id}`);
    console.log(`   Title: ${data.title}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addSummary();