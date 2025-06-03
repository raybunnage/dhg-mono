#!/usr/bin/env node

import { execSync } from 'child_process';
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

interface HealthCheckResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

async function runHealthCheck() {
  console.log('🏥 Git CLI Health Check\n');

  const results: HealthCheckResult[] = [];

  // Check 1: Git installation
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
    results.push({
      check: 'Git Installation',
      status: 'pass',
      message: gitVersion
    });
  } catch (error) {
    results.push({
      check: 'Git Installation',
      status: 'fail',
      message: 'Git is not installed or not in PATH'
    });
  }

  // Check 2: Current repository
  try {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    results.push({
      check: 'Git Repository',
      status: 'pass',
      message: `Repository root: ${repoRoot}`
    });
  } catch (error) {
    results.push({
      check: 'Git Repository',
      status: 'fail',
      message: 'Not in a git repository'
    });
  }

  // Check 3: Worktree support
  try {
    const worktreeList = execSync('git worktree list', { encoding: 'utf-8' }).trim();
    const worktreeCount = worktreeList.split('\n').length;
    results.push({
      check: 'Git Worktree',
      status: 'pass',
      message: `${worktreeCount} worktree(s) found`
    });
  } catch (error) {
    results.push({
      check: 'Git Worktree',
      status: 'warning',
      message: 'Git worktree command failed'
    });
  }

  // Check 4: Database connection
  try {
    const supabase = createSupabaseAdapter();
    
    // Test dev_merge_queue table
    const { error: mergeError } = await supabase
      .from('dev_merge_queue')
      .select('id')
      .limit(1);

    if (mergeError) {
      results.push({
        check: 'Database (dev_merge_queue)',
        status: 'fail',
        message: mergeError.message
      });
    } else {
      results.push({
        check: 'Database (dev_merge_queue)',
        status: 'pass',
        message: 'Table accessible'
      });
    }

    // Test dev_tasks table
    const { error: tasksError } = await supabase
      .from('dev_tasks')
      .select('id')
      .limit(1);

    if (tasksError) {
      results.push({
        check: 'Database (dev_tasks)',
        status: 'fail',
        message: tasksError.message
      });
    } else {
      results.push({
        check: 'Database (dev_tasks)',
        status: 'pass',
        message: 'Table accessible'
      });
    }

    // Test dev_merge_checklist table
    const { error: checklistError } = await supabase
      .from('dev_merge_checklist')
      .select('id')
      .limit(1);

    if (checklistError) {
      results.push({
        check: 'Database (dev_merge_checklist)',
        status: 'fail',
        message: checklistError.message
      });
    } else {
      results.push({
        check: 'Database (dev_merge_checklist)',
        status: 'pass',
        message: 'Table accessible'
      });
    }

  } catch (error) {
    results.push({
      check: 'Database Connection',
      status: 'fail',
      message: 'Failed to connect to database'
    });
  }

  // Check 5: Command tracking
  try {
    const supabase = createSupabaseAdapter();
    const { error } = await supabase
      .from('command_pipelines')
      .select('id')
      .eq('name', 'git')
      .single();

    if (error) {
      results.push({
        check: 'Command Tracking',
        status: 'warning',
        message: 'Git pipeline not registered in command_pipelines'
      });
    } else {
      results.push({
        check: 'Command Tracking',
        status: 'pass',
        message: 'Git pipeline registered'
      });
    }
  } catch (error) {
    results.push({
      check: 'Command Tracking',
      status: 'warning',
      message: 'Could not check command tracking'
    });
  }

  // Display results
  console.log('Results:\n');
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : 
                 result.status === 'warning' ? '⚠️' : '❌';
    const color = result.status === 'pass' ? '\x1b[32m' :
                  result.status === 'warning' ? '\x1b[33m' : '\x1b[31m';
    
    console.log(`${icon} ${result.check}: ${color}${result.message}\x1b[0m`);
  }

  // Summary
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warning').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  console.log('\n📊 Summary:');
  console.log(`  Passed: ${passCount}`);
  console.log(`  Warnings: ${warnCount}`);
  console.log(`  Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n❌ Health check failed!');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('\n⚠️ Health check passed with warnings');
  } else {
    console.log('\n✅ All checks passed!');
  }
}

// Run the health check
runHealthCheck();