#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const supabase = SupabaseClientService.getInstance().getClient();

async function testDeleteTask() {
  try {
    console.log(chalk.blue('Testing task delete functionality...\n'));
    
    // 1. Create a test task
    console.log(chalk.blue('Creating test task...'));
    const { data: newTask, error: createError } = await supabase
      .from('dev_tasks')
      .insert({
        title: 'TEST TASK - Can be deleted',
        description: 'This is a test task created to verify delete functionality',
        task_type: 'feature',
        status: 'pending',
        priority: 'low'
      })
      .select()
      .single();
      
    if (createError) {
      console.error(chalk.red('Error creating test task:'), createError);
      return;
    }
    
    console.log(chalk.green('✓ Test task created:'));
    console.log(`  ID: ${newTask.id}`);
    console.log(`  Title: ${newTask.title}\n`);
    
    // 2. Verify it exists
    console.log(chalk.blue('Verifying task exists...'));
    const { data: fetchedTask, error: fetchError } = await supabase
      .from('dev_tasks')
      .select('id, title')
      .eq('id', newTask.id)
      .single();
      
    if (fetchError || !fetchedTask) {
      console.error(chalk.red('Error: Could not fetch created task'));
      return;
    }
    
    console.log(chalk.green('✓ Task verified in database\n'));
    
    // 3. Delete the task
    console.log(chalk.blue('Testing delete...'));
    const { error: deleteError } = await supabase
      .from('dev_tasks')
      .delete()
      .eq('id', newTask.id);
      
    if (deleteError) {
      console.error(chalk.red('Error deleting task:'), deleteError);
      return;
    }
    
    console.log(chalk.green('✓ Delete operation completed\n'));
    
    // 4. Verify it's gone
    console.log(chalk.blue('Verifying task is deleted...'));
    const { data: deletedTask, error: verifyError } = await supabase
      .from('dev_tasks')
      .select('id')
      .eq('id', newTask.id)
      .single();
      
    if (verifyError && verifyError.code === 'PGRST116') {
      console.log(chalk.green('✓ Task successfully deleted (not found in database)\n'));
    } else if (deletedTask) {
      console.error(chalk.red('Error: Task still exists after delete!'));
      return;
    }
    
    console.log(chalk.green.bold('✅ All tests passed! Delete functionality is working correctly.'));
    
    // List tasks that might be test tasks to delete
    console.log(chalk.yellow('\n📋 Tasks that might be test tasks:'));
    const { data: testTasks } = await supabase
      .from('dev_tasks')
      .select('id, title, created_at')
      .or('title.ilike.%test%,description.ilike.%test%')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (testTasks && testTasks.length > 0) {
      testTasks.forEach(task => {
        console.log(`- ${task.title} (${task.id})`);
      });
    } else {
      console.log('No obvious test tasks found');
    }
    
  } catch (error) {
    console.error(chalk.red('Test failed:'), error);
  }
}

testDeleteTask();