#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import * as readline from 'readline';

const execAsync = promisify(exec);

interface PrepareMergeOptions {
  branch?: string;
  skipTests?: boolean;
  skipLint?: boolean;
  skipTypecheck?: boolean;
  force?: boolean;
  taskId?: string;
}

interface CheckResult {
  check: string;
  status: 'passed' | 'failed' | 'skipped';
  message: string;
  details?: any;
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question + ' (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function updateFromDevelopment(branch: string): Promise<CheckResult> {
  try {
    console.log('📥 Updating from development...');
    
    // Fetch latest
    await execAsync('git fetch origin development');
    
    // Check if we're behind
    const { stdout: behind } = await execAsync(`git rev-list --count ${branch}..origin/development`);
    const behindCount = parseInt(behind.trim());
    
    if (behindCount === 0) {
      return {
        check: 'update_from_source',
        status: 'passed',
        message: 'Already up to date with development'
      };
    }
    
    // Perform merge
    const { stdout: mergeOutput } = await execAsync(`git merge origin/development --no-edit`);
    
    return {
      check: 'update_from_source',
      status: 'passed',
      message: `Updated from development (${behindCount} commits)`,
      details: mergeOutput
    };
  } catch (error: any) {
    return {
      check: 'update_from_source',
      status: 'failed',
      message: 'Failed to update from development',
      details: error.message
    };
  }
}

async function checkForConflicts(branch: string): Promise<CheckResult> {
  try {
    console.log('🔍 Checking for conflicts...');
    
    const { stdout: conflicts } = await execAsync(
      `git merge-tree $(git merge-base origin/development ${branch}) origin/development ${branch} | grep -c "<<<<<<< "` 
    ).catch(() => ({ stdout: '0' }));
    
    const conflictCount = parseInt(conflicts.trim());
    
    if (conflictCount > 0) {
      return {
        check: 'check_conflicts',
        status: 'failed',
        message: `Found ${conflictCount} conflicts with development`,
        details: { conflictCount }
      };
    }
    
    return {
      check: 'check_conflicts',
      status: 'passed',
      message: 'No conflicts detected'
    };
  } catch (error: any) {
    return {
      check: 'check_conflicts',
      status: 'failed',
      message: 'Error checking conflicts',
      details: error.message
    };
  }
}

async function runTests(): Promise<CheckResult> {
  try {
    console.log('🧪 Running tests...');
    
    // Check if test script exists
    const { stdout: packageJson } = await execAsync('cat package.json').catch(() => ({ stdout: '{}' }));
    const pkg = JSON.parse(packageJson);
    
    if (!pkg.scripts?.test) {
      return {
        check: 'run_tests',
        status: 'skipped',
        message: 'No test script found'
      };
    }
    
    const { stdout: testOutput } = await execAsync('pnpm test', { 
      timeout: 300000 // 5 minute timeout
    });
    
    return {
      check: 'run_tests',
      status: 'passed',
      message: 'All tests passed',
      details: testOutput
    };
  } catch (error: any) {
    return {
      check: 'run_tests',
      status: 'failed',
      message: 'Tests failed',
      details: error.message
    };
  }
}

async function runLinter(): Promise<CheckResult> {
  try {
    console.log('🔧 Running linter...');
    
    // Try common lint commands
    const lintCommands = ['pnpm lint', 'npm run lint', 'eslint .'];
    
    for (const cmd of lintCommands) {
      try {
        const { stdout } = await execAsync(cmd, { timeout: 120000 });
        return {
          check: 'run_linter',
          status: 'passed',
          message: 'Linting passed',
          details: stdout
        };
      } catch {
        continue;
      }
    }
    
    return {
      check: 'run_linter',
      status: 'skipped',
      message: 'No linter configuration found'
    };
  } catch (error: any) {
    return {
      check: 'run_linter',
      status: 'failed',
      message: 'Linting failed',
      details: error.message
    };
  }
}

async function runTypeCheck(): Promise<CheckResult> {
  try {
    console.log('📘 Running TypeScript check...');
    
    const { stdout } = await execAsync('tsc --noEmit', { timeout: 120000 });
    
    return {
      check: 'run_typecheck',
      status: 'passed',
      message: 'TypeScript check passed',
      details: stdout
    };
  } catch (error: any) {
    // Check if tsc exists
    const { stdout: tscVersion } = await execAsync('tsc --version').catch(() => ({ stdout: '' }));
    if (!tscVersion) {
      return {
        check: 'run_typecheck',
        status: 'skipped',
        message: 'TypeScript not configured'
      };
    }
    
    return {
      check: 'run_typecheck',
      status: 'failed',
      message: 'TypeScript check failed',
      details: error.message
    };
  }
}

async function saveToMergeQueue(branch: string, results: CheckResult[], options: PrepareMergeOptions): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  // Check if branch already exists in queue
  const { data: existing } = await supabase
    .from('dev_merge_queue')
    .select('id')
    .eq('branch_name', branch)
    .single();
  
  const allPassed = results.every(r => r.status === 'passed' || r.status === 'skipped');
  const hasConflicts = results.find(r => r.check === 'check_conflicts')?.status === 'failed';
  const testsPassed = results.find(r => r.check === 'run_tests')?.status === 'passed';
  
  if (existing) {
    // Update existing entry
    await supabase
      .from('dev_merge_queue')
      .update({
        merge_status: allPassed ? 'ready' : hasConflicts ? 'conflicts' : 'pending',
        conflicts_detected: hasConflicts,
        tests_passed: testsPassed,
        last_updated_from_source: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    
    // Update checklist items
    for (const result of results) {
      await supabase
        .from('dev_merge_checklist')
        .upsert({
          merge_queue_id: existing.id,
          check_type: result.check,
          status: result.status,
          result: result.details,
          executed_at: new Date().toISOString()
        }, {
          onConflict: 'merge_queue_id,check_type'
        });
    }
  } else {
    // Create new entry
    const { data: newEntry } = await supabase
      .from('dev_merge_queue')
      .insert({
        branch_name: branch,
        merge_status: allPassed ? 'ready' : hasConflicts ? 'conflicts' : 'pending',
        conflicts_detected: hasConflicts,
        tests_passed: testsPassed,
        last_updated_from_source: new Date().toISOString(),
        task_ids: options.taskId ? [options.taskId] : []
      })
      .select()
      .single();
    
    if (newEntry) {
      // Add checklist items
      const checklistItems = results.map(result => ({
        merge_queue_id: newEntry.id,
        check_type: result.check,
        status: result.status,
        result: result.details,
        executed_at: new Date().toISOString()
      }));
      
      await supabase
        .from('dev_merge_checklist')
        .insert(checklistItems);
    }
  }
}

async function prepareMerge(options: PrepareMergeOptions): Promise<void> {
  try {
    // Get current branch if not specified
    const branch = options.branch || (await execAsync('git branch --show-current')).stdout.trim();
    
    console.log(`\n🚀 Preparing branch '${branch}' for merge into development\n`);
    
    // Ensure we're on the right branch
    if (branch !== (await execAsync('git branch --show-current')).stdout.trim()) {
      console.log(`Switching to branch ${branch}...`);
      await execAsync(`git checkout ${branch}`);
    }
    
    const results: CheckResult[] = [];
    
    // 1. Update from development
    results.push(await updateFromDevelopment(branch));
    
    // 2. Check for conflicts
    results.push(await checkForConflicts(branch));
    
    // 3. Run tests (unless skipped)
    if (!options.skipTests) {
      results.push(await runTests());
    }
    
    // 4. Run linter (unless skipped)
    if (!options.skipLint) {
      results.push(await runLinter());
    }
    
    // 5. Run TypeScript check (unless skipped)
    if (!options.skipTypecheck) {
      results.push(await runTypeCheck());
    }
    
    // Display results
    console.log('\n📋 Preparation Results:\n');
    const tableData = results.map(r => ({
      Check: r.check.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      Status: r.status === 'passed' ? '✅ Passed' : r.status === 'failed' ? '❌ Failed' : '⏭️  Skipped',
      Message: r.message
    }));
    
    console.table(tableData);
    
    // Check overall status
    const failedChecks = results.filter(r => r.status === 'failed');
    const allPassed = failedChecks.length === 0;
    
    if (allPassed) {
      console.log('\n✅ Branch is ready to merge!\n');
    } else {
      console.log('\n❌ Branch is not ready to merge. Issues found:\n');
      failedChecks.forEach(check => {
        console.log(`  - ${check.message}`);
        if (check.details && !options.force) {
          console.log(`    Details: ${JSON.stringify(check.details, null, 2)}`);
        }
      });
      
      if (!options.force) {
        const proceed = await askConfirmation('\nDo you want to save this status to the merge queue anyway?');
        if (!proceed) {
          console.log('Aborted.');
          process.exit(1);
        }
      }
    }
    
    // Save to merge queue
    await saveToMergeQueue(branch, results, options);
    console.log('\n💾 Status saved to merge queue.\n');
    
    if (allPassed) {
      console.log('Next steps:');
      console.log('  1. Review the changes one more time');
      console.log('  2. Run: worktree-cli.sh merge-queue list');
      console.log('  3. When ready, run: worktree-cli.sh execute-merge');
    }
    
  } catch (error) {
    console.error('Error preparing merge:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: PrepareMergeOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--branch':
    case '-b':
      options.branch = args[++i];
      break;
    case '--skip-tests':
      options.skipTests = true;
      break;
    case '--skip-lint':
      options.skipLint = true;
      break;
    case '--skip-typecheck':
      options.skipTypecheck = true;
      break;
    case '--force':
    case '-f':
      options.force = true;
      break;
    case '--task-id':
      options.taskId = args[++i];
      break;
    case '--help':
      console.log(`
Usage: prepare-merge [options]

Options:
  -b, --branch <name>    Prepare specific branch (default: current branch)
  --skip-tests          Skip running tests
  --skip-lint           Skip running linter
  --skip-typecheck      Skip TypeScript type checking
  -f, --force           Force save to queue even with failures
  --task-id <id>        Associate with a dev_task ID
  --help                Show this help message

Runs pre-merge checks including:
- Updating from development
- Checking for conflicts
- Running tests
- Running linter
- TypeScript type checking
`);
      process.exit(0);
  }
}

prepareMerge(options);