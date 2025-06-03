#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';

const execAsync = promisify(exec);

interface MergeStatusOptions {
  branch?: string;
  all?: boolean;
  json?: boolean;
}

interface BranchStatus {
  branch: string;
  behindDevelopment: number;
  aheadOfDevelopment: number;
  hasConflicts: boolean;
  lastCommit: string;
  modifiedFiles: number;
  testsStatus?: 'passed' | 'failed' | 'not_run';
  inMergeQueue: boolean;
  mergeStatus?: string;
}

async function checkBranchStatus(branch: string, targetBranch: string = 'development'): Promise<BranchStatus> {
  try {
    // Get commits behind and ahead
    const { stdout: revList } = await execAsync(`git rev-list --left-right --count ${targetBranch}...${branch}`);
    const [behind, ahead] = revList.trim().split('\t').map(n => parseInt(n));

    // Get last commit info
    const { stdout: lastCommit } = await execAsync(`git log -1 --format="%h %s" ${branch}`);

    // Check for potential conflicts
    let hasConflicts = false;
    try {
      await execAsync(`git merge-tree $(git merge-base ${targetBranch} ${branch}) ${targetBranch} ${branch}`);
      // If the command succeeds, check if there's actual conflict output
      const { stdout: conflicts } = await execAsync(`git merge-tree $(git merge-base ${targetBranch} ${branch}) ${targetBranch} ${branch} | grep -c "<<<<<<< "`).catch(() => ({ stdout: '0' }));
      hasConflicts = parseInt(conflicts.trim()) > 0;
    } catch {
      hasConflicts = true;
    }

    // Count modified files
    const { stdout: diffStat } = await execAsync(`git diff --stat ${targetBranch}...${branch} | tail -1`).catch(() => ({ stdout: '0 files changed' }));
    const filesMatch = diffStat.match(/(\d+) files? changed/);
    const modifiedFiles = filesMatch ? parseInt(filesMatch[1]) : 0;

    return {
      branch,
      behindDevelopment: behind,
      aheadOfDevelopment: ahead,
      hasConflicts,
      lastCommit: lastCommit.trim(),
      modifiedFiles,
      inMergeQueue: false
    };
  } catch (error) {
    console.error(`Error checking status for branch ${branch}:`, error);
    throw error;
  }
}

async function getMergeQueueStatus(supabase: any): Promise<Map<string, any>> {
  const { data, error } = await supabase
    .from('dev_merge_queue')
    .select('*')
    .not('merge_status', 'eq', 'merged');

  if (error) {
    console.error('Error fetching merge queue:', error);
    return new Map();
  }

  const queueMap = new Map();
  data?.forEach(item => {
    queueMap.set(item.branch_name, item);
  });
  return queueMap;
}

async function displayMergeStatus(options: MergeStatusOptions): Promise<void> {
  try {
    const supabase = createSupabaseAdapter();
    
    // Determine which branches to check
    let branchesToCheck: string[] = [];
    
    if (options.branch) {
      branchesToCheck = [options.branch];
    } else if (options.all) {
      // Get all local branches
      const { stdout } = await execAsync('git branch --format="%(refname:short)"');
      branchesToCheck = stdout.trim().split('\n').filter(b => b && b !== 'development');
    } else {
      // Get current branch
      const { stdout } = await execAsync('git branch --show-current');
      branchesToCheck = [stdout.trim()];
    }

    // Get merge queue status
    const mergeQueue = await getMergeQueueStatus(supabase);

    // Check status for each branch
    const statuses: BranchStatus[] = [];
    for (const branch of branchesToCheck) {
      const status = await checkBranchStatus(branch);
      const queueItem = mergeQueue.get(branch);
      if (queueItem) {
        status.inMergeQueue = true;
        status.mergeStatus = queueItem.merge_status;
        status.testsStatus = queueItem.tests_passed ? 'passed' : queueItem.tests_passed === false ? 'failed' : 'not_run';
      }
      statuses.push(status);
    }

    // Display results
    if (options.json) {
      console.log(JSON.stringify(statuses, null, 2));
    } else {
      console.log('\nBranch Merge Status Report\n' + '='.repeat(80));
      
      for (const status of statuses) {
        console.log(`\nBranch: ${status.branch}`);
        console.log(`  Last Commit: ${status.lastCommit}`);
        console.log(`  Status: ${status.behindDevelopment} behind, ${status.aheadOfDevelopment} ahead of development`);
        console.log(`  Modified Files: ${status.modifiedFiles}`);
        console.log(`  Conflicts: ${status.hasConflicts ? '⚠️  Yes - needs resolution' : '✅ No conflicts'}`);
        
        if (status.inMergeQueue) {
          console.log(`  Merge Queue: ${status.mergeStatus}`);
          console.log(`  Tests: ${status.testsStatus === 'passed' ? '✅' : status.testsStatus === 'failed' ? '❌' : '⏳'} ${status.testsStatus}`);
        } else {
          console.log(`  Merge Queue: Not tracked`);
        }
        
        // Readiness assessment
        const isReady = !status.hasConflicts && status.behindDevelopment === 0;
        console.log(`  Ready to Merge: ${isReady ? '✅ Yes' : '❌ No'}`);
        
        if (!isReady) {
          const issues = [];
          if (status.behindDevelopment > 0) issues.push('needs update from development');
          if (status.hasConflicts) issues.push('has conflicts');
          console.log(`  Issues: ${issues.join(', ')}`);
        }
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('\nSummary:');
      const readyCount = statuses.filter(s => !s.hasConflicts && s.behindDevelopment === 0).length;
      console.log(`  Ready to merge: ${readyCount}/${statuses.length} branches`);
      console.log(`  With conflicts: ${statuses.filter(s => s.hasConflicts).length} branches`);
      console.log(`  Need updating: ${statuses.filter(s => s.behindDevelopment > 0).length} branches`);
    }

  } catch (error) {
    console.error('Error checking merge status:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: MergeStatusOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--branch':
    case '-b':
      options.branch = args[++i];
      break;
    case '--all':
    case '-a':
      options.all = true;
      break;
    case '--json':
      options.json = true;
      break;
    case '--help':
      console.log(`
Usage: merge-status [options]

Options:
  -b, --branch <name>   Check specific branch (default: current branch)
  -a, --all            Check all local branches
  --json               Output in JSON format
  --help               Show this help message

Shows merge readiness status for branches, including:
- Commits behind/ahead of development
- Conflict detection
- Test status (if in merge queue)
- Modified file count
`);
      process.exit(0);
  }
}

displayMergeStatus(options);