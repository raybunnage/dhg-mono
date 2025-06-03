#!/usr/bin/env node

import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';
import { Database } from '../../../../supabase/types';
import { format } from 'date-fns';

type MergeQueueItem = Database['public']['Tables']['dev_merge_queue']['Row'];

async function listMergeQueue() {
  console.log('📋 Merge Queue\n');

  const supabase = createSupabaseAdapter();

  try {
    // Get all items from merge queue
    const { data, error } = await supabase
      .from('dev_merge_queue')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No branches in merge queue.');
      return;
    }

    // Group by status
    const pending = data.filter(item => item.merge_status === 'pending');
    const ready = data.filter(item => item.merge_status === 'ready');
    const inProgress = data.filter(item => item.merge_status === 'in_progress');
    const conflicts = data.filter(item => item.merge_status === 'conflicts');
    const completed = data.filter(item => ['merged', 'failed'].includes(item.merge_status));

    // Display active items
    console.log('🔄 Active Queue:\n');

    const activeItems = [...inProgress, ...ready, ...pending, ...conflicts];
    
    if (activeItems.length === 0) {
      console.log('  No active items in queue.\n');
    } else {
      for (const item of activeItems) {
        displayQueueItem(item);
      }
    }

    // Display recent completed items
    if (completed.length > 0) {
      console.log('\n✅ Recently Completed:\n');
      const recentCompleted = completed.slice(0, 5); // Show last 5
      
      for (const item of recentCompleted) {
        displayCompletedItem(item);
      }
      
      if (completed.length > 5) {
        console.log(`\n  ... and ${completed.length - 5} more completed items`);
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  In Progress: ${inProgress.length}`);
    console.log(`  Ready: ${ready.length}`);
    console.log(`  Pending: ${pending.length}`);
    console.log(`  Conflicts: ${conflicts.length}`);
    console.log(`  Total Active: ${activeItems.length}`);
    console.log(`  Total Completed: ${completed.length}`);

  } catch (error) {
    console.error('Failed to list merge queue:', error);
    process.exit(1);
  }
}

function displayQueueItem(item: MergeQueueItem) {
  const statusEmoji = getStatusEmoji(item.merge_status);
  const statusColor = getStatusColor(item.merge_status);
  
  console.log(`${statusEmoji} ${item.branch_name}`);
  console.log(`   Status: ${statusColor}${item.merge_status}${resetColor()}`);
  console.log(`   Source: ${item.source_branch}`);
  
  if (item.priority > 0) {
    console.log(`   Priority: ⭐ ${item.priority}`);
  }
  
  if (item.worktree_path) {
    console.log(`   Worktree: ${item.worktree_path}`);
  }
  
  if (item.conflicts_detected) {
    console.log(`   ⚠️  Conflicts detected`);
  }
  
  if (item.tests_passed !== null) {
    console.log(`   Tests: ${item.tests_passed ? '✅ Passed' : '❌ Failed'}`);
  }
  
  console.log(`   Added: ${format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}`);
  
  if (item.notes) {
    console.log(`   Note: ${item.notes}`);
  }
  
  console.log('');
}

function displayCompletedItem(item: MergeQueueItem) {
  const statusEmoji = item.merge_status === 'merged' ? '✅' : '❌';
  
  console.log(`${statusEmoji} ${item.branch_name} → ${item.source_branch}`);
  
  if (item.merge_completed_at) {
    console.log(`   Completed: ${format(new Date(item.merge_completed_at), 'MMM d, yyyy HH:mm')}`);
    
    if (item.merge_started_at) {
      const duration = Math.round(
        (new Date(item.merge_completed_at).getTime() - 
         new Date(item.merge_started_at).getTime()) / 1000 / 60
      );
      console.log(`   Duration: ${duration} minutes`);
    }
  }
  
  if (item.merge_commit_sha) {
    console.log(`   Commit: ${item.merge_commit_sha.substring(0, 8)}`);
  }
  
  console.log('');
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'ready': return '✅';
    case 'in_progress': return '🔄';
    case 'conflicts': return '⚠️';
    case 'merged': return '✅';
    case 'failed': return '❌';
    default: return '❓';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ready': return '\x1b[32m'; // green
    case 'in_progress': return '\x1b[34m'; // blue
    case 'pending': return '\x1b[33m'; // yellow
    case 'conflicts':
    case 'failed': return '\x1b[31m'; // red
    default: return '';
  }
}

function resetColor(): string {
  return '\x1b[0m';
}

// Run the command
listMergeQueue();