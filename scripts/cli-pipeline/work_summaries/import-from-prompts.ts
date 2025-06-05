#!/usr/bin/env ts-node
/**
 * Import work summaries from claude_code_prompts.txt
 * 
 * This script parses the prompts file and extracts summaries
 * to add to the ai_work_summaries table
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface ParsedSummary {
  title: string;
  content: string;
  commands: string[];
  tags: string[];
  date?: string;
}

async function importFromPrompts() {
  const promptsPath = path.join(process.cwd(), 'docs/claude_code_prompts.txt');
  
  if (!fs.existsSync(promptsPath)) {
    console.error('❌ claude_code_prompts.txt not found');
    process.exit(1);
  }

  console.log('📖 Reading claude_code_prompts.txt...');
  const content = fs.readFileSync(promptsPath, 'utf-8');
  const lines = content.split('\n');

  const summaries: ParsedSummary[] = [];
  let currentSummary: Partial<ParsedSummary> | null = null;
  let inSummaryBlock = false;
  let summaryContent: string[] = [];

  // Look for patterns that indicate summaries
  const summaryMarkers = [
    /^## Summary/i,
    /^### Summary/i,
    /^Summary:/i,
    /^✅.*completed/i,
    /^Successfully/i,
    /^I've.*created/i,
    /^I've.*fixed/i,
    /^The.*has been/i
  ];

  for (let i = 0; i < Math.min(lines.length, 2000); i++) {
    const line = lines[i];
    
    // Check if this line starts a summary
    if (summaryMarkers.some(marker => marker.test(line))) {
      // Save previous summary if exists
      if (currentSummary && summaryContent.length > 0) {
        currentSummary.content = summaryContent.join('\n').trim();
        if (currentSummary.title && currentSummary.content) {
          summaries.push(currentSummary as ParsedSummary);
        }
      }

      // Start new summary
      currentSummary = {
        title: extractTitle(line, lines, i),
        commands: extractCommands(lines, i),
        tags: extractTags(line)
      };
      summaryContent = [line];
      inSummaryBlock = true;
    } else if (inSummaryBlock) {
      // Continue collecting summary content
      if (line.trim() === '' && summaryContent.length > 3) {
        // End of summary block
        inSummaryBlock = false;
      } else if (line.startsWith('Human:') || line.startsWith('Assistant:')) {
        // End of summary
        inSummaryBlock = false;
      } else {
        summaryContent.push(line);
      }
    }
  }

  // Save last summary
  if (currentSummary && summaryContent.length > 0) {
    currentSummary.content = summaryContent.join('\n').trim();
    if (currentSummary.title && currentSummary.content) {
      summaries.push(currentSummary as ParsedSummary);
    }
  }

  console.log(`\n📊 Found ${summaries.length} summaries to import`);

  if (summaries.length === 0) {
    console.log('No summaries found to import');
    return;
  }

  // Show preview
  console.log('\n📋 Preview of summaries to import:\n');
  summaries.slice(0, 5).forEach((summary, index) => {
    console.log(`${index + 1}. ${summary.title}`);
    console.log(`   ${summary.content.substring(0, 100)}...`);
    console.log('');
  });

  // Import to database
  console.log('\n💾 Importing to database...');
  
  let imported = 0;
  for (const summary of summaries) {
    try {
      const { error } = await supabase
        .from('ai_work_summaries')
        .insert({
          title: summary.title,
          summary_content: summary.content,
          commands: summary.commands,
          tags: summary.tags,
          category: determineCategory(summary),
          work_date: summary.date || '2025-05-01', // Default to earlier date
          metadata: { source: 'claude_code_prompts.txt' }
        });

      if (!error) {
        imported++;
      } else {
        console.error(`Failed to import: ${summary.title}`);
      }
    } catch (err) {
      console.error(`Error importing: ${summary.title}`, err);
    }
  }

  console.log(`\n✅ Successfully imported ${imported} summaries`);
}

function extractTitle(line: string, lines: string[], index: number): string {
  // Try to extract a meaningful title
  if (line.match(/^##+ /)) {
    return line.replace(/^##+ /, '').trim();
  }
  
  // Look for command names or feature descriptions
  const nextFewLines = lines.slice(index, index + 5).join(' ');
  
  // Common patterns
  if (nextFewLines.includes('created')) {
    const match = nextFewLines.match(/created\s+(?:a\s+)?(\w+[\w\s-]+)/i);
    if (match) return `Created ${match[1]}`;
  }
  
  if (nextFewLines.includes('fixed')) {
    const match = nextFewLines.match(/fixed\s+(?:the\s+)?(\w+[\w\s-]+)/i);
    if (match) return `Fixed ${match[1]}`;
  }
  
  return line.substring(0, 100).trim();
}

function extractCommands(lines: string[], startIndex: number): string[] {
  const commands: string[] = [];
  const searchLines = lines.slice(startIndex, startIndex + 20).join('\n');
  
  // Look for command patterns
  const cmdPatterns = [
    /`([a-z-]+(?:-[a-z]+)*)`/g,
    /command[:\s]+([a-z-]+(?:-[a-z]+)*)/gi,
    /\b(sync|classify|process|update|fix|repair|assign)[-\w]+/g
  ];
  
  cmdPatterns.forEach(pattern => {
    const matches = searchLines.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !commands.includes(match[1])) {
        commands.push(match[1]);
      }
    }
  });
  
  return commands.slice(0, 5); // Limit to 5 commands
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  
  // Keywords that indicate tags
  const keywords = [
    'refactor', 'bug', 'fix', 'feature', 'enhancement',
    'database', 'cli', 'ui', 'api', 'migration',
    'performance', 'security', 'documentation'
  ];
  
  keywords.forEach(keyword => {
    if (content.toLowerCase().includes(keyword)) {
      tags.push(keyword);
    }
  });
  
  return tags;
}

function determineCategory(summary: ParsedSummary): string {
  const content = summary.title + ' ' + summary.content;
  
  if (content.match(/\bfix(ed|ing)?\b/i) || content.match(/\bbug\b/i)) {
    return 'bug_fix';
  }
  if (content.match(/\brefactor/i)) {
    return 'refactoring';
  }
  if (content.match(/\bdoc(s|umentation)\b/i)) {
    return 'documentation';
  }
  
  return 'feature';
}

importFromPrompts().catch(console.error);