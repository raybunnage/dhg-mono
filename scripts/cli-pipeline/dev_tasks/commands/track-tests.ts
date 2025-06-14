#!/usr/bin/env ts-node

import { DevTaskService } from '../../../../packages/shared/services/dev-task-service/dev-task-service';
import chalk from 'chalk';

async function trackTests() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error(chalk.red('Usage: track-tests <task-id> --passed <n> --failed <n> [--skipped <n>] [--coverage <n>] [--suite "name"] [--report-url "url"]'));
    process.exit(1);
  }

  const taskId = args[0];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let coverage: number | undefined;
  let suiteName = 'default';
  let reportUrl = '';

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--passed' && args[i + 1]) {
      passed = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--failed' && args[i + 1]) {
      failed = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skipped' && args[i + 1]) {
      skipped = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--coverage' && args[i + 1]) {
      coverage = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--suite' && args[i + 1]) {
      suiteName = args[i + 1];
      i++;
    } else if (args[i] === '--report-url' && args[i + 1]) {
      reportUrl = args[i + 1];
      i++;
    }
  }

  try {
    const taskService = DevTaskService.getInstance();
    
    // Get the latest work summary for this task
    const summaries = await taskService.lifecycle.getTaskWorkSummaries(taskId);
    const latestSummaryId = summaries.length > 0 ? summaries[0].id : undefined;

    // Record test results
    const testResult = await taskService.lifecycle.recordTestResults({
      devTaskId: taskId,
      workSummaryId: latestSummaryId,
      testSuiteName: suiteName,
      passed,
      failed,
      skipped,
      coverage,
      reportUrl
    });

    const total = passed + failed + skipped;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

    console.log(chalk.green('✅ Test results tracked successfully'));
    console.log(chalk.blue(`   Suite: ${suiteName}`));
    console.log(chalk.gray(`   Total: ${total} tests`));
    console.log(chalk.green(`   Passed: ${passed}`));
    if (failed > 0) {
      console.log(chalk.red(`   Failed: ${failed}`));
    } else {
      console.log(chalk.gray(`   Failed: ${failed}`));
    }
    if (skipped > 0) {
      console.log(chalk.yellow(`   Skipped: ${skipped}`));
    }
    console.log(chalk.gray(`   Pass rate: ${passRate}%`));
    if (coverage !== undefined) {
      console.log(chalk.gray(`   Coverage: ${coverage}%`));
    }
    if (reportUrl) {
      console.log(chalk.gray(`   Report: ${reportUrl}`));
    }

  } catch (error) {
    console.error(chalk.red('❌ Error tracking test results:'), error);
    process.exit(1);
  }
}

trackTests();