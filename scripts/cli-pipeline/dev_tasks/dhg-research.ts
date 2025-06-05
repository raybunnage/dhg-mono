#!/usr/bin/env ts-node
/**
 * dhg-research command - Create Claude Code tasks for research questions
 * This provides an alternative way to create tasks focused on research and exploration
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';

interface ResearchTaskOptions {
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  context?: string;
  app?: string;
}

async function createResearchTask(question: string, options: ResearchTaskOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Format the research question as a task
    const title = `Research: ${question.slice(0, 100)}${question.length > 100 ? '...' : ''}`;
    const description = formatResearchDescription(question, options);
    
    // Create the task
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .insert({
        id: uuidv4(),
        title,
        description,
        task_type: 'question',
        priority: options.priority || 'medium',
        status: 'pending',
        app: options.app || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`\n✅ Research task created successfully!`);
    console.log(`\n📋 Task ID: ${task.id}`);
    console.log(`📝 Title: ${task.title}`);
    console.log(`🔍 Type: Question/Research`);
    console.log(`⚡ Priority: ${task.priority}`);
    
    if (task.app) {
      console.log(`📱 App: ${task.app}`);
    }

    console.log(`\n💡 Next steps:`);
    console.log(`   1. Start the research: ./dev-tasks-cli.sh start-session ${task.id}`);
    console.log(`   2. Copy to Claude: ./dev-tasks-cli.sh copy-request ${task.id}`);
    console.log(`   3. Complete with findings: ./dev-tasks-cli.sh complete ${task.id} --response "Research findings..."`);

    return task;
  } catch (error) {
    console.error('❌ Error creating research task:', error);
    process.exit(1);
  }
}

function formatResearchDescription(question: string, options: ResearchTaskOptions): string {
  let description = `**Research Question:**\n${question}\n\n`;
  
  if (options.context) {
    description += `**Context:**\n${options.context}\n\n`;
  }

  description += `**Research Goals:**\n`;
  description += `- Understand the current state and implementation\n`;
  description += `- Identify patterns and best practices\n`;
  description += `- Document findings and recommendations\n`;
  description += `- Provide code examples if applicable\n\n`;

  description += `**Areas to Explore:**\n`;
  description += `- Existing code and implementations\n`;
  description += `- Database schema and relationships\n`;
  description += `- Documentation and comments\n`;
  description += `- Potential improvements or refactoring opportunities\n`;

  return description;
}

// Main program
program
  .name('dhg-research')
  .description('Create a Claude Code research task')
  .argument('<question>', 'The research question or topic to explore')
  .option('-p, --priority <priority>', 'Task priority (low|medium|high|urgent)', 'medium')
  .option('-c, --context <context>', 'Additional context for the research')
  .option('-a, --app <app>', 'Specific app to focus on')
  .action(async (question: string, options: ResearchTaskOptions) => {
    await createResearchTask(question, options);
  });

// Example usage in help
program.addHelpText('after', `
Examples:
  # Basic research question
  ./dev-tasks-cli.sh dhg-research "How does the authentication flow work in dhg-admin-code?"

  # Research with context and priority
  ./dev-tasks-cli.sh dhg-research "What are the patterns for shared services?" \\
    --context "Looking to create a new shared service for notifications" \\
    --priority high

  # Research focused on specific app
  ./dev-tasks-cli.sh dhg-research "How is state management handled?" \\
    --app dhg-improve-experts

  # Research about database relationships
  ./dev-tasks-cli.sh dhg-research "How are expert documents linked to presentations?" \\
    --context "Need to understand the database schema for a new feature"
`);

program.parse();