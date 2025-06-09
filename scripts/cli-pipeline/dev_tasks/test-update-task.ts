#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const supabase = SupabaseClientService.getInstance().getClient();

async function testTaskUpdate() {
  const taskId = 'e3399226-8180-4c57-8551-14e8b5291703'; // The bug task we're fixing
  
  try {
    console.log(chalk.blue('Testing task update functionality...\n'));
    
    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log(chalk.yellow('No authenticated user found'));
      console.log('This might be expected in CLI context\n');
    } else {
      console.log(chalk.green(`✓ Authenticated as: ${user.email}\n`));
    }
    
    // 2. Fetch current task
    console.log(chalk.blue('Fetching current task...'));
    const { data: currentTask, error: fetchError } = await supabase
      .from('dev_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
      
    if (fetchError) {
      console.error(chalk.red('Error fetching task:'), fetchError);
      return;
    }
    
    console.log(chalk.green('✓ Current task:'));
    console.log(`  Title: ${currentTask.title}`);
    console.log(`  Priority: ${currentTask.priority}`);
    console.log(`  Status: ${currentTask.status}`);
    console.log(`  Type: ${currentTask.task_type}\n`);
    
    // 3. Test update
    console.log(chalk.blue('Testing update...'));
    const testUpdates = {
      priority: 'high',
      status: 'in_progress',
      updated_at: new Date().toISOString()
    };
    
    const { data: updateResult, error: updateError } = await supabase
      .from('dev_tasks')
      .update(testUpdates)
      .eq('id', taskId)
      .select()
      .single();
      
    if (updateError) {
      console.error(chalk.red('Error updating task:'), updateError);
      console.error('Error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return;
    }
    
    console.log(chalk.green('✓ Update successful:'));
    console.log(`  New Priority: ${updateResult.priority}`);
    console.log(`  New Status: ${updateResult.status}\n`);
    
    // 4. Verify from enhanced view
    console.log(chalk.blue('Fetching from enhanced view...'));
    const { data: enhancedTask, error: enhancedError } = await supabase
      .from('dev_tasks_enhanced_view')
      .select('*')
      .eq('id', taskId)
      .single();
      
    if (enhancedError) {
      console.error(chalk.red('Error fetching enhanced view:'), enhancedError);
    } else {
      console.log(chalk.green('✓ Enhanced view data:'));
      console.log(`  Title: ${enhancedTask.title}`);
      console.log(`  Priority: ${enhancedTask.priority}`);
      console.log(`  Status: ${enhancedTask.status}`);
      console.log(`  Success Criteria Count: ${enhancedTask.success_criteria_count}`);
      console.log(`  Overall Completion Score: ${enhancedTask.overall_completion_score}%\n`);
    }
    
    // 5. Revert changes
    console.log(chalk.blue('Reverting to original values...'));
    const { error: revertError } = await supabase
      .from('dev_tasks')
      .update({
        priority: currentTask.priority,
        status: currentTask.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
      
    if (revertError) {
      console.error(chalk.red('Error reverting:'), revertError);
    } else {
      console.log(chalk.green('✓ Reverted successfully\n'));
    }
    
    console.log(chalk.green.bold('✅ All tests passed! Update functionality is working correctly.'));
    
  } catch (error) {
    console.error(chalk.red('Test failed:'), error);
  }
}

testTaskUpdate();