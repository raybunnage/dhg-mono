#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import * as readline from 'readline';

const execAsync = promisify(exec);

interface ExecuteMergeOptions {
  branch?: string;
  skipConfirmation?: boolean;
  message?: string;
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

async function getNextBranch(): Promise<string | null> {
  const supabase = createSupabaseAdapter();
  const { data, error } = await supabase.rpc('get_next_merge_candidate');
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return data[0].branch_name;
}

async function executeMerge(options: ExecuteMergeOptions): Promise<void> {
  try {
    const supabase = createSupabaseAdapter();
    
    // Determine which branch to merge
    let branchToMerge = options.branch;
    if (!branchToMerge) {
      branchToMerge = await getNextBranch();
      if (!branchToMerge) {
        console.error('❌ No branches are ready to merge');
        console.log('\nRun "merge-queue list" to see the current queue status.');
        process.exit(1);
      }
      console.log(`\n🎯 Selected next branch from queue: ${branchToMerge}`);
    }
    
    // Get merge queue entry
    const { data: queueEntry, error } = await supabase
      .from('dev_merge_queue')
      .select('*')
      .eq('branch_name', branchToMerge)
      .single();
    
    if (error || !queueEntry) {
      console.error(`❌ Branch '${branchToMerge}' not found in merge queue`);
      console.log('\nRun "prepare-merge" first to add it to the queue.');
      process.exit(1);
    }
    
    // Check if ready
    if (queueEntry.merge_status !== 'ready') {
      console.error(`❌ Branch '${branchToMerge}' is not ready to merge`);
      console.log(`   Status: ${queueEntry.merge_status}`);
      if (queueEntry.conflicts_detected) {
        console.log('   ⚠️  Conflicts detected - resolve them first');
      }
      console.log('\nRun "prepare-merge" to update the branch status.');
      process.exit(1);
    }
    
    // Display merge information
    console.log('\n📋 Merge Details:');
    console.log(`   Branch: ${branchToMerge}`);
    console.log(`   Target: development`);
    console.log(`   Priority: ${queueEntry.priority}`);
    console.log(`   Last updated: ${new Date(queueEntry.last_updated_from_source).toLocaleString()}`);
    
    // Confirm merge
    if (!options.skipConfirmation) {
      const confirmed = await askConfirmation('\nProceed with merge?');
      if (!confirmed) {
        console.log('Merge cancelled.');
        return;
      }
    }
    
    // Update status to in_progress
    await supabase
      .from('dev_merge_queue')
      .update({
        merge_status: 'in_progress',
        merge_started_at: new Date().toISOString()
      })
      .eq('id', queueEntry.id);
    
    console.log('\n🔄 Starting merge process...\n');
    
    // Switch to development branch
    console.log('1️⃣  Switching to development branch...');
    await execAsync('git checkout development');
    
    // Pull latest development
    console.log('2️⃣  Pulling latest development...');
    await execAsync('git pull origin development');
    
    // Merge the feature branch
    console.log(`3️⃣  Merging ${branchToMerge}...`);
    const mergeMessage = options.message || `Merge branch '${branchToMerge}' into development`;
    
    try {
      const { stdout: mergeOutput } = await execAsync(`git merge ${branchToMerge} -m "${mergeMessage}"`);
      console.log(mergeOutput);
    } catch (mergeError: any) {
      // Handle merge failure
      console.error('\n❌ Merge failed!');
      console.error(mergeError.message);
      
      // Update status
      await supabase
        .from('dev_merge_queue')
        .update({
          merge_status: 'failed',
          notes: `Merge failed: ${mergeError.message}`
        })
        .eq('id', queueEntry.id);
      
      // Abort merge
      await execAsync('git merge --abort').catch(() => {});
      process.exit(1);
    }
    
    // Get merge commit SHA
    const { stdout: commitSha } = await execAsync('git rev-parse HEAD');
    
    // Run post-merge verification
    console.log('\n4️⃣  Running post-merge verification...');
    
    // Quick smoke tests
    const postMergeChecks = [];
    
    // Try to run build
    try {
      console.log('   - Running build check...');
      await execAsync('pnpm build', { timeout: 300000 });
      postMergeChecks.push({ check: 'build', passed: true });
    } catch {
      postMergeChecks.push({ check: 'build', passed: false });
    }
    
    // Try to run tests
    try {
      console.log('   - Running test suite...');
      await execAsync('pnpm test', { timeout: 300000 });
      postMergeChecks.push({ check: 'tests', passed: true });
    } catch {
      postMergeChecks.push({ check: 'tests', passed: false });
    }
    
    // Update merge queue entry
    await supabase
      .from('dev_merge_queue')
      .update({
        merge_status: 'merged',
        merge_completed_at: new Date().toISOString(),
        merge_commit_sha: commitSha.trim(),
        notes: `Post-merge checks: ${JSON.stringify(postMergeChecks)}`
      })
      .eq('id', queueEntry.id);
    
    console.log('\n✅ Merge completed successfully!');
    console.log(`   Commit: ${commitSha.trim()}`);
    
    // Show post-merge check results
    if (postMergeChecks.some(c => !c.passed)) {
      console.log('\n⚠️  Some post-merge checks failed:');
      postMergeChecks.forEach(check => {
        console.log(`   ${check.check}: ${check.passed ? '✅' : '❌'}`);
      });
      console.log('\nPlease verify and fix any issues.');
    } else {
      console.log('\n✅ All post-merge checks passed!');
    }
    
    // Push to remote
    const pushConfirmed = await askConfirmation('\nPush to remote?');
    if (pushConfirmed) {
      console.log('\n📤 Pushing to origin...');
      await execAsync('git push origin development');
      console.log('✅ Pushed successfully!');
    }
    
    // Show next steps
    console.log('\n📝 Next steps:');
    console.log('   1. Monitor CI/CD pipeline');
    console.log('   2. Update related documentation');
    console.log('   3. Close related issues/PRs');
    
    // Check for more branches
    const nextBranch = await getNextBranch();
    if (nextBranch) {
      console.log(`\n🎯 Next branch ready to merge: ${nextBranch}`);
    }
    
  } catch (error) {
    console.error('Error executing merge:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ExecuteMergeOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--branch':
    case '-b':
      options.branch = args[++i];
      break;
    case '--skip-confirmation':
    case '-y':
      options.skipConfirmation = true;
      break;
    case '--message':
    case '-m':
      options.message = args[++i];
      break;
    case '--help':
      console.log(`
Usage: execute-merge [options]

Options:
  -b, --branch <name>         Specific branch to merge (default: next in queue)
  -y, --skip-confirmation     Skip confirmation prompts
  -m, --message <text>        Custom merge commit message
  --help                      Show this help message

Executes the merge of a branch into development, including:
- Pre-merge validation
- Actual git merge
- Post-merge verification (build, tests)
- Status tracking in merge queue

If no branch is specified, merges the next ready branch from the queue.
`);
      process.exit(0);
  }
}

executeMerge(options);