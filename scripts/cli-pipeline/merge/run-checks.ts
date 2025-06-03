#!/usr/bin/env ts-node

import { program } from 'commander';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import path from 'path';

const execAsync = promisify(exec);

async function runChecks(branchName: string, options: any) {
  const supabase = createSupabaseAdapter();

  try {
    // Get merge queue entry
    const { data: queueData, error: queueError } = await supabase
      .from('dev_merge_queue')
      .select('*')
      .eq('branch_name', branchName)
      .eq('target_branch', options.target || 'development')
      .single();

    if (queueError || !queueData) {
      console.error(chalk.red(`Branch '${branchName}' not found in merge queue`));
      process.exit(1);
    }

    console.log(chalk.cyan(`Running pre-merge checks for '${branchName}'...\\n`));

    const results = {
      tests_passed: false,
      lint_passed: false,
      type_check_passed: false
    };

    // Helper to update checklist item
    const updateChecklist = async (checkName: string, passed: boolean) => {
      await supabase
        .from('dev_merge_checklist')
        .update({
          status: passed ? 'passed' : 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('merge_queue_id', queueData.id)
        .eq('check_name', checkName);
    };

    // 1. Run TypeScript check
    console.log(chalk.bold('1. TypeScript Check'));
    try {
      const { stdout, stderr } = await execAsync('pnpm tsc --noEmit', {
        cwd: queueData.worktree_path || process.cwd()
      });
      console.log(chalk.green('✓ TypeScript compilation passed'));
      results.type_check_passed = true;
      await updateChecklist('types_valid', true);
    } catch (error: any) {
      console.log(chalk.red('✗ TypeScript compilation failed'));
      console.log(chalk.dim(error.stdout || error.stderr));
      await updateChecklist('types_valid', false);
    }

    // 2. Run linting (if available)
    console.log(chalk.bold('\\n2. Linting Check'));
    try {
      // Try to find lint command
      const packageJsonPath = path.join(queueData.worktree_path || process.cwd(), 'package.json');
      const packageJson = require(packageJsonPath);
      
      if (packageJson.scripts && (packageJson.scripts.lint || packageJson.scripts.eslint)) {
        const lintCommand = packageJson.scripts.lint ? 'pnpm lint' : 'pnpm eslint';
        const { stdout, stderr } = await execAsync(lintCommand, {
          cwd: queueData.worktree_path || process.cwd()
        });
        console.log(chalk.green('✓ Linting passed'));
        results.lint_passed = true;
        await updateChecklist('lint_clean', true);
      } else {
        console.log(chalk.yellow('⚠ No lint script found, skipping'));
        results.lint_passed = true; // Don't fail if no lint script
        await updateChecklist('lint_clean', true);
      }
    } catch (error: any) {
      console.log(chalk.red('✗ Linting failed'));
      console.log(chalk.dim(error.stdout || error.stderr));
      await updateChecklist('lint_clean', false);
    }

    // 3. Run tests (if available)
    console.log(chalk.bold('\\n3. Test Suite'));
    try {
      const packageJsonPath = path.join(queueData.worktree_path || process.cwd(), 'package.json');
      const packageJson = require(packageJsonPath);
      
      if (packageJson.scripts && packageJson.scripts.test) {
        const { stdout, stderr } = await execAsync('pnpm test', {
          cwd: queueData.worktree_path || process.cwd(),
          env: { ...process.env, CI: 'true' } // Run in CI mode
        });
        console.log(chalk.green('✓ Tests passed'));
        results.tests_passed = true;
        await updateChecklist('tests_pass', true);
      } else {
        console.log(chalk.yellow('⚠ No test script found, skipping'));
        results.tests_passed = true; // Don't fail if no tests
        await updateChecklist('tests_pass', true);
      }
    } catch (error: any) {
      console.log(chalk.red('✗ Tests failed'));
      console.log(chalk.dim(error.stdout || error.stderr));
      await updateChecklist('tests_pass', false);
    }

    // Update merge queue with results
    const { error: updateError } = await supabase
      .from('dev_merge_queue')
      .update({
        tests_passed: results.tests_passed,
        lint_passed: results.lint_passed,
        type_check_passed: results.type_check_passed,
        updated_at: new Date().toISOString()
      })
      .eq('id', queueData.id);

    if (updateError) {
      console.warn(chalk.yellow('Warning: Could not update merge queue:'), updateError.message);
    }

    // Summary
    console.log(chalk.bold('\\nSummary:'));
    const allPassed = results.tests_passed && results.lint_passed && results.type_check_passed;
    
    if (allPassed) {
      console.log(chalk.green('✓ All checks passed!'));
      console.log(chalk.dim('Branch is ready for merging'));
    } else {
      console.log(chalk.red('✗ Some checks failed'));
      console.log(chalk.dim('Fix issues before merging'));
    }

    // Show next steps
    console.log(chalk.cyan('\\nNext steps:'));
    if (!queueData.conflicts_detected) {
      console.log('  Check conflicts: ./merge-cli.sh check-conflicts', branchName);
    }
    if (allPassed && !queueData.conflicts_detected) {
      console.log('  Start merge: ./merge-cli.sh start-merge', branchName);
    }

  } catch (error: any) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
}

// Parse command line arguments
program
  .name('run-checks')
  .description('Run pre-merge validation checks')
  .argument('<branch>', 'Branch name to check')
  .option('--target <branch>', 'Target branch for merge', 'development')
  .action(runChecks);

program.parse(process.argv);