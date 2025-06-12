#!/usr/bin/env ts-node

import { DevTaskService } from '../../../../packages/shared/services/dev-task-service/dev-task-service';
import chalk from 'chalk';

async function showTracking() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error(chalk.red('Usage: show-tracking <task-id>'));
    process.exit(1);
  }

  const taskId = args[0];

  try {
    const taskService = DevTaskService.getInstance();
    
    // Get task details
    const task = await taskService.getTask(taskId);
    console.log(chalk.blue(`\n📋 Task: ${task.title}`));
    console.log(chalk.gray(`   ID: ${task.id}`));
    console.log(chalk.gray(`   Status: ${task.status}`));
    console.log(chalk.gray(`   Priority: ${task.priority}`));

    // Get work summaries with tracking info
    const summaries = await taskService.lifecycle.getTaskWorkSummaries(taskId);
    
    if (summaries.length === 0) {
      console.log(chalk.yellow('\n⚠️  No work summaries found for this task'));
      return;
    }

    console.log(chalk.green(`\n📝 Work Summaries (${summaries.length}):\n`));

    for (const summary of summaries) {
      console.log(chalk.bold(`${summary.title}`));
      console.log(chalk.gray(`   ID: ${summary.id}`));
      console.log(chalk.gray(`   Created: ${new Date(summary.created_at).toLocaleString()}`));
      
      // Status indicators
      const indicators = [];
      if (summary.has_submission) indicators.push('📤 Submitted');
      if (summary.has_validation) {
        const icon = summary.validation_status === 'passed' ? '✅' : 
                     summary.validation_status === 'failed' ? '❌' : '⚠️';
        indicators.push(`${icon} Validation: ${summary.validation_status}`);
      }
      if (summary.has_tests) {
        const passedCount = summary.passed_count ?? 0;
        const failedCount = summary.failed_count ?? 0;
        const icon = failedCount > 0 ? '❌' : '✅';
        indicators.push(`${icon} Tests: ${passedCount}/${passedCount + failedCount} passed`);
      }
      
      if (indicators.length > 0) {
        console.log(`   ${indicators.join(' | ')}`);
      }

      // Todo progress
      if (summary.total_todos > 0) {
        const progress = ((summary.completed_todos / summary.total_todos) * 100).toFixed(0);
        console.log(chalk.gray(`   📋 Todos: ${summary.completed_todos}/${summary.total_todos} (${progress}% complete)`));
      }

      // Follow-ups
      if (summary.follow_up_count > 0) {
        console.log(chalk.gray(`   🔄 Follow-ups: ${summary.completed_follow_ups}/${summary.follow_up_count} completed`));
      }

      // Needs action?
      if (summary.needs_action) {
        console.log(chalk.red(`   ⚠️  ACTION REQUIRED`));
      }

      console.log(); // Empty line between summaries
    }

    // Get todos for latest summary
    if (summaries.length > 0) {
      const latestSummary = summaries[0];
      const todos = await taskService.lifecycle.getWorkSummaryTodos(latestSummary.id);
      
      if (todos.length > 0) {
        console.log(chalk.yellow('📋 Latest Summary Todos:'));
        todos.forEach(todo => {
          const icon = todo.completed ? '✅' : '☐';
          const priority = todo.priority === 'high' ? chalk.red('!') : 
                          todo.priority === 'low' ? chalk.gray('-') : '';
          console.log(`   ${icon} ${todo.todo_text} ${priority}`);
        });
      }
    }

  } catch (error) {
    console.error(chalk.red('❌ Error showing tracking info:'), error);
    process.exit(1);
  }
}

showTracking();