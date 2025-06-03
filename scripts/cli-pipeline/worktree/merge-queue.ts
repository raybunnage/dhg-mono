#!/usr/bin/env ts-node

import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';
import * as readline from 'readline';

interface MergeQueueOptions {
  action: 'list' | 'add' | 'remove' | 'prioritize' | 'next' | 'dependencies';
  branch?: string;
  priority?: number;
  dependsOn?: string;
  json?: boolean;
}

async function askInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question + ': ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function listQueue(options: { json?: boolean }): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  const { data, error } = await supabase
    .from('dev_merge_queue')
    .select(`
      *,
      dev_merge_checklist (
        check_type,
        status,
        executed_at
      ),
      dev_merge_dependencies (
        depends_on_branch,
        dependency_type
      )
    `)
    .not('merge_status', 'eq', 'merged')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching merge queue:', error);
    return;
  }
  
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('\n📭 Merge queue is empty\n');
    return;
  }
  
  console.log('\n📋 Merge Queue\n' + '='.repeat(100));
  console.log('Priority | Branch'.padEnd(40) + ' | Status'.padEnd(15) + ' | Tests | Conflicts | Dependencies | Created');
  console.log('-'.repeat(100));
  
  for (const item of data) {
    const deps = item.dev_merge_dependencies?.map((d: any) => d.depends_on_branch).join(', ') || '-';
    const testsCheck = item.dev_merge_checklist?.find((c: any) => c.check_type === 'run_tests');
    const testsIcon = testsCheck?.status === 'passed' ? '✅' : testsCheck?.status === 'failed' ? '❌' : '⏳';
    
    console.log(
      `${item.priority.toString().padStart(8)} | ` +
      `${item.branch_name.padEnd(38)} | ` +
      `${item.merge_status.padEnd(13)} | ` +
      `${testsIcon.padEnd(5)} | ` +
      `${item.conflicts_detected ? '⚠️ Yes' : '✅ No '}`.padEnd(10) + ' | ' +
      `${deps.substring(0, 20).padEnd(20)} | ` +
      new Date(item.created_at).toLocaleDateString()
    );
  }
  
  console.log('\n' + '='.repeat(100));
  
  // Show next candidate
  const { data: nextCandidate } = await supabase.rpc('get_next_merge_candidate');
  if (nextCandidate && nextCandidate.length > 0) {
    console.log(`\n🎯 Next merge candidate: ${nextCandidate[0].branch_name}`);
  }
}

async function addToQueue(branch: string, priority: number = 0): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  const { error } = await supabase
    .from('dev_merge_queue')
    .insert({
      branch_name: branch,
      priority,
      merge_status: 'pending'
    });
  
  if (error) {
    if (error.code === '23505') { // Unique violation
      console.error(`Branch '${branch}' is already in the merge queue`);
    } else {
      console.error('Error adding to queue:', error);
    }
    return;
  }
  
  console.log(`✅ Added '${branch}' to merge queue with priority ${priority}`);
}

async function removeFromQueue(branch: string): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  const { error } = await supabase
    .from('dev_merge_queue')
    .delete()
    .eq('branch_name', branch);
  
  if (error) {
    console.error('Error removing from queue:', error);
    return;
  }
  
  console.log(`✅ Removed '${branch}' from merge queue`);
}

async function updatePriority(branch: string, priority: number): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  const { error } = await supabase
    .from('dev_merge_queue')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('branch_name', branch);
  
  if (error) {
    console.error('Error updating priority:', error);
    return;
  }
  
  console.log(`✅ Updated priority for '${branch}' to ${priority}`);
}

async function showNextCandidate(): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  const { data, error } = await supabase.rpc('get_next_merge_candidate');
  
  if (error) {
    console.error('Error getting next candidate:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('\n❌ No branches are ready to merge\n');
    console.log('Possible reasons:');
    console.log('  - No branches in "ready" status');
    console.log('  - All ready branches have unmet dependencies');
    console.log('\nRun "merge-queue list" to see the current queue status.');
    return;
  }
  
  const candidate = data[0];
  console.log('\n🎯 Next merge candidate:\n');
  console.log(`  Branch: ${candidate.branch_name}`);
  console.log(`  Priority: ${candidate.priority}`);
  console.log(`  Pending Dependencies: ${candidate.pending_dependencies}`);
  console.log('\nTo merge this branch, run:');
  console.log(`  worktree-cli.sh execute-merge --branch ${candidate.branch_name}`);
}

async function manageDependencies(branch: string, dependsOn?: string): Promise<void> {
  const supabase = createSupabaseAdapter();
  
  // Get merge queue entry
  const { data: queueEntry } = await supabase
    .from('dev_merge_queue')
    .select('id')
    .eq('branch_name', branch)
    .single();
  
  if (!queueEntry) {
    console.error(`Branch '${branch}' not found in merge queue`);
    return;
  }
  
  if (dependsOn) {
    // Add dependency
    const { error } = await supabase
      .from('dev_merge_dependencies')
      .insert({
        merge_queue_id: queueEntry.id,
        depends_on_branch: dependsOn,
        dependency_type: 'must_merge_first'
      });
    
    if (error) {
      console.error('Error adding dependency:', error);
      return;
    }
    
    console.log(`✅ Added dependency: '${branch}' depends on '${dependsOn}'`);
  } else {
    // Show dependencies
    const { data: deps } = await supabase
      .from('dev_merge_dependencies')
      .select('*')
      .eq('merge_queue_id', queueEntry.id);
    
    if (!deps || deps.length === 0) {
      console.log(`\nNo dependencies for '${branch}'`);
    } else {
      console.log(`\nDependencies for '${branch}':`);
      deps.forEach(dep => {
        console.log(`  - ${dep.depends_on_branch} (${dep.dependency_type})`);
      });
    }
  }
}

async function handleMergeQueue(options: MergeQueueOptions): Promise<void> {
  try {
    switch (options.action) {
      case 'list':
        await listQueue({ json: options.json });
        break;
        
      case 'add':
        if (!options.branch) {
          options.branch = await askInput('Branch name');
        }
        await addToQueue(options.branch, options.priority || 0);
        break;
        
      case 'remove':
        if (!options.branch) {
          options.branch = await askInput('Branch name');
        }
        await removeFromQueue(options.branch);
        break;
        
      case 'prioritize':
        if (!options.branch) {
          options.branch = await askInput('Branch name');
        }
        if (options.priority === undefined) {
          const priorityStr = await askInput('Priority (0-100)');
          options.priority = parseInt(priorityStr);
        }
        await updatePriority(options.branch, options.priority);
        break;
        
      case 'next':
        await showNextCandidate();
        break;
        
      case 'dependencies':
        if (!options.branch) {
          options.branch = await askInput('Branch name');
        }
        await manageDependencies(options.branch, options.dependsOn);
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: MergeQueueOptions = { action: 'list' };

// First argument is the action
if (args[0] && !args[0].startsWith('--')) {
  options.action = args[0] as any;
  args.shift();
}

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--branch':
    case '-b':
      options.branch = args[++i];
      break;
    case '--priority':
    case '-p':
      options.priority = parseInt(args[++i]);
      break;
    case '--depends-on':
      options.dependsOn = args[++i];
      break;
    case '--json':
      options.json = true;
      break;
    case '--help':
      console.log(`
Usage: merge-queue <action> [options]

Actions:
  list                List all branches in the merge queue (default)
  add                 Add a branch to the merge queue
  remove              Remove a branch from the merge queue
  prioritize          Update the priority of a branch
  next                Show the next branch ready to merge
  dependencies        Manage branch dependencies

Options:
  -b, --branch <name>       Branch name
  -p, --priority <number>   Priority (0-100, higher = sooner)
  --depends-on <branch>     Add dependency on another branch
  --json                    Output in JSON format
  --help                    Show this help message

Examples:
  merge-queue list
  merge-queue add --branch feature/new-ui --priority 10
  merge-queue prioritize --branch feature/fix-bug --priority 50
  merge-queue dependencies --branch feature/api --depends-on feature/auth
  merge-queue next
`);
      process.exit(0);
  }
}

handleMergeQueue(options);