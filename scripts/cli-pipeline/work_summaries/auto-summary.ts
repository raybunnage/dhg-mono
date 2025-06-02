#!/usr/bin/env ts-node
/**
 * Automated work summary generator
 * 
 * This provides a quick way to add summaries with smart defaults
 * and can be called directly by the AI assistant after completing work
 * 
 * Usage:
 *   ts-node auto-summary.ts "Title" "Summary content" [options]
 * 
 * Or with JSON:
 *   ts-node auto-summary.ts --json '{"title":"...","content":"...","commands":["cmd1"]}'
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface SummaryData {
  title: string;
  content: string;
  commands?: string[];
  tags?: string[];
  category?: string;
  metadata?: any;
}

async function autoSummary() {
  const args = process.argv.slice(2);
  
  let summaryData: SummaryData;
  
  // Check if JSON input
  if (args[0] === '--json' && args[1]) {
    try {
      summaryData = JSON.parse(args[1]);
    } catch (error) {
      console.error('❌ Invalid JSON input');
      process.exit(1);
    }
  } else if (args.length >= 2) {
    // Simple positional arguments
    summaryData = {
      title: args[0],
      content: args[1],
      commands: args[2]?.split(',').map(c => c.trim()),
      tags: args[3]?.split(',').map(t => t.trim()),
      category: args[4] || autoDetectCategory(args[0] + ' ' + args[1])
    };
  } else {
    console.error('❌ Invalid arguments');
    console.log('Usage: auto-summary.ts "Title" "Content" ["cmd1,cmd2"] ["tag1,tag2"] [category]');
    console.log('   Or: auto-summary.ts --json \'{"title":"...","content":"..."}\'');
    process.exit(1);
  }

  // Auto-detect tags if not provided
  if (!summaryData.tags || summaryData.tags.length === 0) {
    summaryData.tags = autoDetectTags(summaryData.title + ' ' + summaryData.content);
  }

  // Auto-detect category if not provided
  if (!summaryData.category) {
    summaryData.category = autoDetectCategory(summaryData.title + ' ' + summaryData.content);
  }

  try {
    // First check for duplicates within the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const { data: existingSummaries, error: checkError } = await supabase
      .from('ai_work_summaries')
      .select('id, title, created_at')
      .eq('title', summaryData.title)
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (checkError) throw checkError;
    
    if (existingSummaries && existingSummaries.length > 0) {
      console.log(`⚠️  Duplicate detected: A summary with the same title was created ${Math.round((Date.now() - new Date(existingSummaries[0].created_at).getTime()) / 60000)} minutes ago`);
      console.log(`   Existing ID: ${existingSummaries[0].id}`);
      console.log(`   Use --force to create anyway`);
      
      // Check if --force flag is present
      if (!process.argv.includes('--force')) {
        process.exit(0);
      }
    }
    
    const { data, error } = await supabase
      .from('ai_work_summaries')
      .insert({
        title: summaryData.title,
        summary_content: summaryData.content,
        commands: summaryData.commands || [],
        tags: summaryData.tags || [],
        category: summaryData.category,
        metadata: summaryData.metadata,
        work_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    // Output in a format that's easy to parse
    console.log(`✅ Summary added: ${data.id}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function autoDetectCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('fix') || lowerText.includes('bug') || lowerText.includes('issue')) {
    return 'bug_fix';
  }
  if (lowerText.includes('refactor') || lowerText.includes('reorganiz')) {
    return 'refactoring';
  }
  if (lowerText.includes('document') || lowerText.includes('readme') || lowerText.includes('comment')) {
    return 'documentation';
  }
  
  return 'feature';
}

function autoDetectTags(text: string): string[] {
  const tags: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common tags to detect
  const tagPatterns = [
    { pattern: /databas|table|migration|sql/i, tag: 'database' },
    { pattern: /cli|command/i, tag: 'cli' },
    { pattern: /ui|interface|page|component/i, tag: 'ui' },
    { pattern: /fix|bug|issue/i, tag: 'bug_fix' },
    { pattern: /refactor/i, tag: 'refactoring' },
    { pattern: /test/i, tag: 'testing' },
    { pattern: /google.*(sync|drive)/i, tag: 'google_sync' },
    { pattern: /auth|login|user/i, tag: 'authentication' },
    { pattern: /batch|process/i, tag: 'batch_processing' },
    { pattern: /track|monitor/i, tag: 'tracking' }
  ];
  
  tagPatterns.forEach(({ pattern, tag }) => {
    if (pattern.test(lowerText) && !tags.includes(tag)) {
      tags.push(tag);
    }
  });
  
  return tags.slice(0, 5); // Limit to 5 tags
}

autoSummary().catch(console.error);