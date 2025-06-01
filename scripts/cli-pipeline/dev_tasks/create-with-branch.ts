#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { gitService } from '../../../packages/shared/services/git-service/git-service';

interface CreateTaskOptions {
  title: string;
  description: string;
  taskType?: string;
  priority?: string;
  app?: string;
  createBranch?: boolean;
  branchPrefix?: string;
}

async function createTaskWithBranch(options: CreateTaskOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Create task first to get auto-generated ID
    const { data: newTask, error: createError } = await supabase
      .from('dev_tasks')
      .insert({
        title: options.title,
        description: options.description,
        task_type: options.taskType || 'task',
        priority: options.priority || 'medium',
        app: options.app || null,
        status: 'pending'
      })
      .select()
      .single();
    
    if (createError || !newTask) {
      console.error('Error creating task:', createError?.message || 'Unknown error');
      return;
    }
    
    const taskId = newTask.id;
    
    // Prepare git branch if requested
    let gitBranch: string | null = null;
    let gitCommitStart: string | null = null;
    
    if (options.createBranch !== false) {
      // Check current git status
      const status = await gitService.getStatus();
      if (status.hasUncommittedChanges) {
        console.warn('⚠️  Warning: You have uncommitted changes. Consider committing or stashing them first.');
        console.log('Modified files:', status.modifiedFiles);
        console.log('Untracked files:', status.untrackedFiles);
        
        // Ask for confirmation
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>(resolve => {
          readline.question('Continue anyway? (y/N): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
          console.log('Task creation cancelled.');
          return;
        }
      }
      
      // Generate branch name
      const branchType = options.branchPrefix || options.taskType || 'task';
      gitBranch = gitService.generateBranchName(taskId, options.title, branchType);
      
      // Create branch
      console.log(`\n📌 Creating git branch: ${gitBranch}`);
      await gitService.createBranch(gitBranch);
      
      // Get starting commit
      gitCommitStart = await gitService.getCurrentCommit();
      console.log(`✅ Branch created at commit: ${gitCommitStart.substring(0, 8)}`);
    }
    
    // Update task with git information
    const { data: task, error } = await supabase
      .from('dev_tasks')
      .update({
        git_branch: gitBranch,
        git_commit_start: gitCommitStart,
        git_commit_current: gitCommitStart,
        git_commits_count: 0
      })
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating task with git info:', error.message);
      
      // Try to switch back to previous branch if we created one
      if (gitBranch) {
        try {
          await gitService.switchBranch('-');
          console.log('Switched back to previous branch due to error.');
        } catch {}
      }
      return;
    }
    
    console.log('\n✅ Task created successfully!');
    console.log(`📋 Task ID: ${task.id}`);
    console.log(`📝 Title: ${task.title}`);
    if (gitBranch) {
      console.log(`🌿 Git Branch: ${gitBranch}`);
      console.log('\n💡 To start working on this task:');
      console.log(`   ./dev-tasks-cli.sh start-session ${task.id}`);
    }
    
    // Copy task ID to clipboard if possible
    try {
      require('child_process').execSync(`echo "${task.id}" | pbcopy`);
      console.log('\n📋 Task ID copied to clipboard!');
    } catch {}
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: create-with-branch <title> <description> [options]');
    console.log('Options:');
    console.log('  --type <type>         Task type (feature, bug, docs, etc.)');
    console.log('  --priority <priority> Task priority (low, medium, high)');
    console.log('  --app <app>          Associated app');
    console.log('  --no-branch          Skip branch creation');
    console.log('  --branch-prefix      Custom branch prefix (default: task type)');
    process.exit(1);
  }
  
  const options: CreateTaskOptions = {
    title: args[0],
    description: args[1],
    createBranch: true
  };
  
  // Parse additional options
  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
        options.taskType = args[++i];
        break;
      case '--priority':
        options.priority = args[++i];
        break;
      case '--app':
        options.app = args[++i];
        break;
      case '--no-branch':
        options.createBranch = false;
        break;
      case '--branch-prefix':
        options.branchPrefix = args[++i];
        break;
    }
  }
  
  await createTaskWithBranch(options);
}

main().catch(console.error);