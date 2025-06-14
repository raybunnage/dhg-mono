#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const supabase = SupabaseClientService.getInstance().getClient();

interface WorkSummary {
  id: string;
  title: string;
  summary_content: string;
  work_date: string;
  created_at: string;
  worktree?: string;
  metadata?: any;
  commands?: string[];
  tags?: string[];
}

interface DevTask {
  id: string;
  title: string;
  description: string;
  created_at: string;
  worktree_path?: string;
  git_commit_current?: string;
  claude_submission_timestamp?: string;
}

interface DevTaskCommit {
  task_id: string;
  commit_hash: string;
  commit_message: string;
  committed_at: string;
}

async function findTaskIdInText(text: string): Promise<string[]> {
  // Look for various task ID patterns
  const patterns = [
    /Task:\s*#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,  // Task: #uuid
    /task[_-]id[:\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,  // task_id: uuid
    /dev[_-]task[_-]id[:\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,  // dev_task_id: uuid
    /#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi  // Just #uuid
  ];
  
  const foundIds = new Set<string>();
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      foundIds.add(match[1]);
    }
  }
  
  return Array.from(foundIds);
}

async function getCommitsAroundDate(date: string, worktree?: string): Promise<string[]> {
  try {
    // Get commits within 24 hours of the work summary date
    const targetDate = new Date(date);
    const beforeDate = new Date(targetDate);
    const afterDate = new Date(targetDate);
    beforeDate.setHours(beforeDate.getHours() + 24);
    afterDate.setHours(afterDate.getHours() - 24);
    
    let gitCommand = `git log --since="${afterDate.toISOString()}" --until="${beforeDate.toISOString()}" --format="%H"`;
    
    // If worktree is specified, try to filter by branch
    if (worktree) {
      gitCommand += ` --branches="*${worktree}*"`;
    }
    
    const { stdout } = await execAsync(gitCommand);
    return stdout.trim().split('\n').filter(hash => hash);
  } catch (error) {
    console.error(`Error getting commits: ${error}`);
    return [];
  }
}

async function analyzeCommitForTaskId(commitHash: string): Promise<{ taskId?: string; message?: string }> {
  try {
    const { stdout } = await execAsync(`git show -s --format="%B" ${commitHash}`);
    const message = stdout.trim();
    
    const taskIds = await findTaskIdInText(message);
    return {
      taskId: taskIds[0],
      message
    };
  } catch (error) {
    console.error(`Error analyzing commit ${commitHash}: ${error}`);
    return {};
  }
}

async function findTaskByTitleAndDate(title: string, date: string, worktree?: string): Promise<string | null> {
  // Try to find a task with similar title created around the same time
  const searchDate = new Date(date);
  const dayBefore = new Date(searchDate);
  const dayAfter = new Date(searchDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  let query = supabase
    .from('dev_tasks')
    .select('id, title, created_at, worktree_path')
    .gte('created_at', dayBefore.toISOString())
    .lte('created_at', dayAfter.toISOString());
  
  if (worktree) {
    query = query.eq('worktree_path', worktree);
  }
  
  const { data: tasks, error } = await query;
  
  if (error || !tasks || tasks.length === 0) return null;
  
  // Find best matching task by title similarity
  const titleLower = title.toLowerCase();
  let bestMatch: { task: any; score: number } | null = null;
  
  for (const task of tasks) {
    const taskTitleLower = task.title.toLowerCase();
    let score = 0;
    
    // Check for common words
    const titleWords = titleLower.split(/\s+/);
    const taskWords = taskTitleLower.split(/\s+/);
    
    for (const word of titleWords) {
      if (taskWords.includes(word) && word.length > 3) {
        score += 1;
      }
    }
    
    // Bonus for exact substring match
    if (taskTitleLower.includes(titleLower) || titleLower.includes(taskTitleLower)) {
      score += 5;
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { task, score };
    }
  }
  
  return bestMatch && bestMatch.score >= 2 ? bestMatch.task.id : null;
}

async function linkWorkSummariesToTasks() {
  console.log('🔄 Starting to link work summaries to dev tasks...\n');
  
  try {
    // 1. Find work summaries without dev_task links
    const { data: summaries, error: summariesError } = await supabase
      .from('ai_work_summaries')
      .select('*')
      .is('metadata->dev_task_id', null)
      .order('created_at', { ascending: false });
    
    if (summariesError) throw summariesError;
    
    if (!summaries || summaries.length === 0) {
      console.log('✅ All work summaries already have dev_task links!');
      return;
    }
    
    console.log(`Found ${summaries.length} work summaries without dev_task links\n`);
    
    let linkedCount = 0;
    
    for (const summary of summaries) {
      console.log(`\n📋 Processing: ${summary.title}`);
      console.log(`   Date: ${new Date(summary.work_date).toLocaleDateString()}`);
      
      let foundTaskId: string | null = null;
      
      // Strategy 1: Check if task ID is mentioned in the summary content
      const contentTaskIds = await findTaskIdInText(summary.summary_content);
      if (contentTaskIds.length > 0) {
        foundTaskId = contentTaskIds[0];
        console.log(`   ✅ Found task ID in content: ${foundTaskId}`);
      }
      
      // Strategy 2: Check git commits around the work date
      if (!foundTaskId && summary.work_date) {
        const commits = await getCommitsAroundDate(summary.work_date, summary.worktree);
        console.log(`   🔍 Checking ${commits.length} commits around work date...`);
        
        for (const commitHash of commits) {
          const { taskId, message } = await analyzeCommitForTaskId(commitHash);
          if (taskId) {
            foundTaskId = taskId;
            console.log(`   ✅ Found task ID in commit ${commitHash.substring(0, 7)}: ${taskId}`);
            break;
          }
        }
      }
      
      // Strategy 3: Check dev_task_commits table for commits on the same day
      if (!foundTaskId) {
        const { data: taskCommits, error: commitsError } = await supabase
          .from('dev_task_commits')
          .select('task_id, commit_message, committed_at')
          .gte('committed_at', new Date(summary.work_date).toISOString().split('T')[0])
          .lt('committed_at', new Date(new Date(summary.work_date).getTime() + 24*60*60*1000).toISOString().split('T')[0]);
        
        if (!commitsError && taskCommits && taskCommits.length > 0) {
          // Check if any commit messages match the work summary
          for (const commit of taskCommits) {
            const summaryWords = summary.title.toLowerCase().split(/\s+/);
            const commitWords = commit.commit_message.toLowerCase().split(/\s+/);
            
            const matchingWords = summaryWords.filter((word: string) => 
              word.length > 3 && commitWords.includes(word)
            );
            
            if (matchingWords.length >= 2) {
              foundTaskId = commit.task_id;
              console.log(`   ✅ Found matching task via commit message: ${foundTaskId}`);
              break;
            }
          }
        }
      }
      
      // Strategy 4: Try to match by title and date
      if (!foundTaskId) {
        foundTaskId = await findTaskByTitleAndDate(summary.title, summary.work_date, summary.worktree);
        if (foundTaskId) {
          console.log(`   ✅ Found task by title/date matching: ${foundTaskId}`);
        }
      }
      
      // Update the work summary if we found a task
      if (foundTaskId) {
        const updatedMetadata = {
          ...(summary.metadata || {}),
          dev_task_id: foundTaskId
        };
        
        const { error: updateError } = await supabase
          .from('ai_work_summaries')
          .update({ metadata: updatedMetadata })
          .eq('id', summary.id);
        
        if (updateError) {
          console.error(`   ❌ Error updating summary: ${updateError.message}`);
        } else {
          console.log(`   ✅ Successfully linked to task ${foundTaskId}`);
          linkedCount++;
        }
      } else {
        console.log(`   ⚠️  No matching task found`);
      }
    }
    
    console.log(`\n✅ Linking complete!`);
    console.log(`   Linked ${linkedCount} of ${summaries.length} work summaries`);
    
    // Show statistics
    const { count: totalSummaries } = await supabase
      .from('ai_work_summaries')
      .select('*', { count: 'exact', head: true });
    
    const { count: linkedSummaries } = await supabase
      .from('ai_work_summaries')
      .select('*', { count: 'exact', head: true })
      .not('metadata->dev_task_id', 'is', null);
    
    console.log(`\n📊 Overall Statistics:`);
    console.log(`   Total work summaries: ${totalSummaries}`);
    console.log(`   Summaries with task links: ${linkedSummaries}`);
    console.log(`   Coverage: ${((linkedSummaries || 0) / (totalSummaries || 1) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error during linking:', error);
    process.exit(1);
  }
}

// Run the linking process
linkWorkSummariesToTasks();