#!/usr/bin/env ts-node

import { DevTaskService } from '../../../../packages/shared/services/dev-task-service/dev-task-service';
import chalk from 'chalk';

async function createWorkSummary() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error(chalk.red('Usage: create-work-summary <task-id> --title "Title" --content "Content" [--worktree branch] [--commit hash]'));
    process.exit(1);
  }

  const taskId = args[0];
  let title = '';
  let content = '';
  let worktree = '';
  let gitCommit = '';
  let category = 'feature';

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[i + 1];
      i++;
    } else if (args[i] === '--content' && args[i + 1]) {
      content = args[i + 1];
      i++;
    } else if (args[i] === '--worktree' && args[i + 1]) {
      worktree = args[i + 1];
      i++;
    } else if (args[i] === '--commit' && args[i + 1]) {
      gitCommit = args[i + 1];
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      category = args[i + 1];
      i++;
    }
  }

  if (!title || !content) {
    console.error(chalk.red('Title and content are required'));
    process.exit(1);
  }

  // Get current git info if not provided
  if (!worktree || !gitCommit) {
    const { execSync } = require('child_process');
    
    if (!worktree) {
      try {
        worktree = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      } catch (e) {
        worktree = 'unknown';
      }
    }
    
    if (!gitCommit) {
      try {
        gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().substring(0, 8);
      } catch (e) {
        gitCommit = 'unknown';
      }
    }
  }

  try {
    const taskService = DevTaskService.getInstance();
    
    // Create work summary with task link
    const summaryId = await taskService.lifecycle.createWorkSummaryWithTaskLink({
      title,
      content,
      taskId,
      worktree,
      gitCommit,
      category
    });

    console.log(chalk.green('✅ Work summary created successfully'));
    console.log(chalk.blue(`   ID: ${summaryId}`));
    console.log(chalk.gray(`   Task: ${taskId}`));
    console.log(chalk.gray(`   Branch: ${worktree}`));
    console.log(chalk.gray(`   Commit: ${gitCommit}`));

    // Get todos that were created
    const todos = await taskService.lifecycle.getWorkSummaryTodos(summaryId);
    if (todos.length > 0) {
      console.log(chalk.yellow(`\n📋 Auto-created ${todos.length} todos:`));
      todos.forEach(todo => {
        console.log(`   ${todo.completed ? '✓' : '☐'} ${todo.todo_text}`);
      });
    }

  } catch (error) {
    console.error(chalk.red('❌ Error creating work summary:'), error);
    process.exit(1);
  }
}

createWorkSummary();