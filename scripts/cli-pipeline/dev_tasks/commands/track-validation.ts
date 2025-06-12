#!/usr/bin/env ts-node

import { DevTaskService } from '../../../../packages/shared/services/dev-task-service/dev-task-service';
import chalk from 'chalk';

async function trackValidation() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error(chalk.red('Usage: track-validation <task-id> --status <passed|failed|issues_found> [--summary "Summary"] [--issues "issue1,issue2"]'));
    process.exit(1);
  }

  const taskId = args[0];
  let status: 'passed' | 'failed' | 'issues_found' = 'pending' as any;
  let summary = '';
  let issues: string[] = [];

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--status' && args[i + 1]) {
      status = args[i + 1] as any;
      i++;
    } else if (args[i] === '--summary' && args[i + 1]) {
      summary = args[i + 1];
      i++;
    } else if (args[i] === '--issues' && args[i + 1]) {
      issues = args[i + 1].split(',').map(s => s.trim());
      i++;
    }
  }

  if (!['passed', 'failed', 'issues_found'].includes(status)) {
    console.error(chalk.red('Invalid status. Must be: passed, failed, or issues_found'));
    process.exit(1);
  }

  try {
    const taskService = DevTaskService.getInstance();
    
    // Get the latest work summary for this task
    const summaries = await taskService.lifecycle.getTaskWorkSummaries(taskId);
    if (summaries.length === 0) {
      console.error(chalk.red('No work summaries found for this task'));
      process.exit(1);
    }

    const latestSummary = summaries[0];

    // Create validation record
    const validation = await taskService.lifecycle.createValidation({
      workSummaryId: latestSummary.id,
      devTaskId: taskId,
      status,
      summary,
      issues: issues.map(issue => ({ description: issue }))
    });

    console.log(chalk.green('✅ Validation tracked successfully'));
    console.log(chalk.blue(`   ID: ${validation.id}`));
    console.log(chalk.gray(`   Status: ${status}`));
    if (summary) {
      console.log(chalk.gray(`   Summary: ${summary}`));
    }
    if (issues.length > 0) {
      console.log(chalk.yellow(`   Issues: ${issues.length}`));
      issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }

  } catch (error) {
    console.error(chalk.red('❌ Error tracking validation:'), error);
    process.exit(1);
  }
}

trackValidation();