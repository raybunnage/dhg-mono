#!/usr/bin/env ts-node
/**
 * Track a git commit for a dev task
 * Usage: ts-node track-commit-for-task.ts <task_id> <commit_hash> [commit_message]
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { execSync } from 'child_process';

async function trackCommitForTask() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: ts-node track-commit-for-task.ts <task_id> <commit_hash> [commit_message]');
    console.log('Example: ts-node track-commit-for-task.ts bb1d3a41-39ef-4ac8-8786-c8bcc7d10dc9 ad534c18 "fix: health check"');
    process.exit(1);
  }
  
  const [taskId, commitHash, commitMessage] = args;
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log(`🔗 Tracking commit ${commitHash} for task ${taskId.substring(0, 8)}...`);
  
  try {
    // Get commit details from git if message not provided
    let finalCommitMessage = commitMessage;
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    
    try {
      if (!commitMessage) {
        finalCommitMessage = execSync(`git log --format=%s -n 1 ${commitHash}`, { encoding: 'utf8' }).trim();
      }
      
      // Get file stats
      const stats = execSync(`git show --stat ${commitHash} | tail -1`, { encoding: 'utf8' }).trim();
      const match = stats.match(/(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/);
      if (match) {
        filesChanged = parseInt(match[1]) || 0;
        insertions = parseInt(match[2]) || 0;
        deletions = parseInt(match[3]) || 0;
      }
    } catch (gitError) {
      console.log('⚠️  Could not get git details, using provided info only');
    }
    
    // Insert into dev_task_commits
    const { data: commitRecord, error: commitError } = await supabase
      .from('dev_task_commits')
      .insert({
        task_id: taskId,
        commit_hash: commitHash,
        commit_message: finalCommitMessage,
        files_changed: filesChanged,
        insertions,
        deletions
      })
      .select()
      .single();
      
    if (commitError) {
      console.error('❌ Error tracking commit:', commitError);
      return;
    }
    
    console.log('✅ Successfully tracked commit:');
    console.log(`   ID: ${commitRecord.id}`);
    console.log(`   Hash: ${commitRecord.commit_hash}`);
    console.log(`   Message: ${commitRecord.commit_message}`);
    console.log(`   Files: ${commitRecord.files_changed}, +${commitRecord.insertions}/-${commitRecord.deletions}`);
    
    // Update dev_tasks with latest commit info
    // First get current count
    const { data: currentTask } = await supabase
      .from('dev_tasks')
      .select('git_commits_count')
      .eq('id', taskId)
      .single();
      
    const newCount = (currentTask?.git_commits_count || 0) + 1;
    
    const { error: taskError } = await supabase
      .from('dev_tasks')
      .update({
        git_commit_current: commitHash,
        git_commits_count: newCount
      })
      .eq('id', taskId);
      
    if (taskError) {
      console.error('⚠️  Error updating task:', taskError);
    } else {
      console.log('✅ Updated task git tracking fields');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

trackCommitForTask().catch(console.error);