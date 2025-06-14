#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);
const supabase = SupabaseClientService.getInstance().getClient();

interface WorkSummaryWithTask {
  id: string;
  title: string;
  summary_content: string;
  work_date: string;
  created_at: string;
  worktree?: string;
  metadata?: any;
}

interface DevTaskCommit {
  id: string;
  task_id: string;
  commit_hash: string;
  commit_message: string;
  committed_at: string;
  author_email?: string;
}

async function getGitCommitDetails(commitHash: string): Promise<{
  timestamp: string;
  branch?: string;
  worktree?: string;
} | null> {
  try {
    // Get commit timestamp
    const { stdout: timestamp } = await execAsync(`git show -s --format=%aI ${commitHash}`);
    
    // Try to determine which branch/worktree this commit was made on
    const { stdout: branches } = await execAsync(`git branch -a --contains ${commitHash}`);
    
    // Extract worktree from branch names (e.g., "improve-cli-pipelines" -> "improve-cli-pipelines")
    const branchLines = branches.split('\n').filter(line => line.trim());
    let worktree: string | undefined;
    
    for (const line of branchLines) {
      const branch = line.replace('*', '').trim();
      // Skip remote branches for now
      if (!branch.startsWith('remotes/')) {
        worktree = branch;
        break;
      }
    }
    
    return {
      timestamp: timestamp.trim(),
      worktree
    };
  } catch (error) {
    console.error(`Error getting git details for ${commitHash}:`, error);
    return null;
  }
}

async function extractTaskTextFromWorkSummary(summary: WorkSummaryWithTask): Promise<string> {
  // Try to extract task-like content from work summary
  const lines = summary.summary_content.split('\n');
  let taskText = '';
  
  // Look for task-related sections
  const taskIndicators = ['task:', 'objective:', 'goal:', 'implement', 'fix', 'create', 'update'];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (taskIndicators.some(indicator => lowerLine.includes(indicator))) {
      taskText += line + '\n';
    }
  }
  
  // If no specific task text found, use title and first paragraph
  if (!taskText) {
    taskText = `# Task: ${summary.title}\n\n${lines[0]}`;
  }
  
  return taskText.trim();
}

async function backfillClaudeSubmissions() {
  console.log('🔄 Starting backfill of Claude submission data...\n');
  
  try {
    // 1. Find dev_tasks that don't have submission data
    const { data: tasksWithoutSubmission, error: tasksError } = await supabase
      .from('dev_tasks')
      .select('*')
      .is('claude_submission_timestamp', null)
      .order('created_at', { ascending: false });
    
    if (tasksError) throw tasksError;
    
    if (!tasksWithoutSubmission || tasksWithoutSubmission.length === 0) {
      console.log('✅ All dev_tasks already have submission data!');
      return;
    }
    
    console.log(`Found ${tasksWithoutSubmission.length} tasks without submission data\n`);
    
    // 2. For each task, try to find related work summaries and commits
    for (const task of tasksWithoutSubmission) {
      console.log(`\n📋 Processing task: ${task.title} (${task.id})`);
      
      // Check for work summaries that reference this task
      const { data: workSummaries, error: summaryError } = await supabase
        .from('ai_work_summaries')
        .select('*')
        .or(`metadata->task_id.eq.${task.id},metadata->dev_task_id.eq.${task.id},summary_content.ilike.%${task.id}%`)
        .order('created_at', { ascending: true });
      
      if (summaryError) {
        console.error(`  ❌ Error fetching work summaries: ${summaryError.message}`);
        continue;
      }
      
      // Check for commits that reference this task
      const { data: commits, error: commitsError } = await supabase
        .from('dev_task_commits')
        .select('*')
        .eq('task_id', task.id)
        .order('committed_at', { ascending: true });
      
      if (commitsError) {
        console.error(`  ❌ Error fetching commits: ${commitsError.message}`);
        continue;
      }
      
      // Determine submission data from available evidence
      let submissionTimestamp: string | null = null;
      let submissionWorktree: string | null = null;
      let taskText: string | null = null;
      
      // Priority 1: Use earliest commit data (most reliable)
      if (commits && commits.length > 0) {
        const firstCommit = commits[0];
        console.log(`  🔍 Found ${commits.length} commits, using first: ${firstCommit.commit_hash}`);
        
        const gitDetails = await getGitCommitDetails(firstCommit.commit_hash);
        if (gitDetails) {
          submissionTimestamp = gitDetails.timestamp;
          submissionWorktree = gitDetails.worktree || task.worktree_path || 'unknown';
          
          // Extract task text from commit message
          const taskMatch = firstCommit.commit_message.match(/Task:\s*#?([a-f0-9-]+)/i);
          if (taskMatch) {
            taskText = `# Task: ${task.title}\n\n${task.description}`;
          }
        }
      }
      
      // Priority 2: Use work summary data
      if (!submissionTimestamp && workSummaries && workSummaries.length > 0) {
        const firstSummary = workSummaries[0];
        console.log(`  🔍 Found ${workSummaries.length} work summaries`);
        
        submissionTimestamp = firstSummary.created_at;
        submissionWorktree = firstSummary.worktree || task.worktree_path || 'unknown';
        taskText = await extractTaskTextFromWorkSummary(firstSummary);
      }
      
      // Priority 3: Use task creation data as fallback
      if (!submissionTimestamp) {
        console.log(`  ⚠️  No commits or summaries found, using task creation time`);
        submissionTimestamp = task.created_at;
        submissionWorktree = task.worktree_path || 'unknown';
        taskText = `# Task: ${task.title}\n\nType: ${task.task_type}\nPriority: ${task.priority}\n\n${task.description}`;
      }
      
      // Update the task with submission data
      const submissionId = uuidv4();
      const { error: updateError } = await supabase
        .from('dev_tasks')
        .update({
          claude_submission_timestamp: submissionTimestamp,
          claude_submission_worktree: submissionWorktree,
          claude_submission_id: submissionId,
          claude_task_text: taskText
        })
        .eq('id', task.id);
      
      if (updateError) {
        console.error(`  ❌ Error updating task: ${updateError.message}`);
      } else {
        console.log(`  ✅ Updated with submission data:`);
        console.log(`     - Timestamp: ${submissionTimestamp ? new Date(submissionTimestamp).toLocaleString() : 'N/A'}`);
        console.log(`     - Worktree: ${submissionWorktree}`);
        console.log(`     - Submission ID: ${submissionId}`);
      }
    }
    
    console.log('\n✅ Backfill complete!');
    
    // Show summary statistics
    const { count: totalTasks } = await supabase
      .from('dev_tasks')
      .select('*', { count: 'exact', head: true });
    
    const { count: tasksWithSubmission } = await supabase
      .from('dev_tasks')
      .select('*', { count: 'exact', head: true })
      .not('claude_submission_timestamp', 'is', null);
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total tasks: ${totalTasks}`);
    console.log(`   Tasks with submission data: ${tasksWithSubmission}`);
    console.log(`   Coverage: ${((tasksWithSubmission || 0) / (totalTasks || 1) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillClaudeSubmissions();