#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { gitService } from '../../../packages/shared/services/git-service/git-service';

async function startWorkSession(taskId: string) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('dev_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (taskError || !task) {
      console.error('Task not found:', taskId);
      return;
    }
    
    console.log(`\n📋 Starting work session for: ${task.title}`);
    
    // Check current git status
    const currentStatus = await gitService.getStatus();
    const currentBranch = currentStatus.branch;
    
    // If task has a branch, switch to it
    if (task.git_branch) {
      if (currentBranch !== task.git_branch) {
        // Check for uncommitted changes
        if (currentStatus.hasUncommittedChanges) {
          console.log('\n⚠️  You have uncommitted changes in the current branch.');
          console.log('Modified files:', currentStatus.modifiedFiles);
          console.log('Untracked files:', currentStatus.untrackedFiles);
          
          // Ask what to do
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise<string>(resolve => {
            readline.question('Stash changes and switch? (Y/n): ', resolve);
          });
          readline.close();
          
          if (answer.toLowerCase() !== 'n') {
            await gitService.stashChanges(`Auto-stash from task ${currentBranch}`);
            console.log('✅ Changes stashed');
          } else {
            console.log('Session start cancelled.');
            return;
          }
        }
        
        // Switch to task branch
        console.log(`\n🌿 Switching to branch: ${task.git_branch}`);
        await gitService.switchBranch(task.git_branch);
      } else {
        console.log(`✅ Already on branch: ${task.git_branch}`);
      }
    }
    
    // Create work session
    const { data: sessionData, error: sessionError } = await supabase
      .from('dev_task_work_sessions')
      .insert({
        task_id: taskId,
        claude_session_id: null, // Will be set when Claude session starts
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    const sessionId = sessionData?.id;
    
    if (sessionError) {
      console.error('Error creating work session:', sessionError.message);
      return;
    }
    
    // Update task status to in_progress if it's pending
    if (task.status === 'pending') {
      await supabase
        .from('dev_tasks')
        .update({ 
          status: 'in_progress',
          git_commit_current: await gitService.getCurrentCommit()
        })
        .eq('id', taskId);
    }
    
    console.log('\n✅ Work session started!');
    console.log(`📝 Session ID: ${sessionId}`);
    console.log(`🌿 Working on branch: ${task.git_branch || currentBranch}`);
    
    // Display task details for copying to Claude
    console.log('\n' + '='.repeat(60));
    console.log('COPY THIS TO CLAUDE:');
    console.log('='.repeat(60));
    console.log(`Task: ${task.title}`);
    console.log(`ID: ${task.id}`);
    console.log(`Type: ${task.task_type}`);
    console.log(`Priority: ${task.priority}`);
    if (task.app) console.log(`App: ${task.app}`);
    console.log(`\nDescription:\n${task.description}`);
    if (task.claude_request) {
      console.log(`\nPrevious Claude Request:\n${task.claude_request}`);
    }
    console.log('='.repeat(60));
    
    // Save session ID for end-session command
    try {
      require('child_process').execSync(`echo "${sessionId}" > .current-session-${taskId}`);
    } catch {}
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: start-session <task-id>');
    process.exit(1);
  }
  
  await startWorkSession(args[0]);
}

main().catch(console.error);