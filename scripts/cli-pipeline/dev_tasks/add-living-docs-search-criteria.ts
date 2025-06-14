#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function addLivingDocsSearchCriteria() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const taskId = '5d2aa831-1926-4227-9d68-176b40e004e3';
  
  const successCriteria = [
    {
      task_id: taskId,
      criteria_type: 'functional',
      title: 'Search input field functional with real-time filtering',
      description: 'User can type in search field and see results update in real-time as they type',
      validation_method: 'manual',
      success_condition: 'Search input responds to typing with live filtering of document list',
      priority: 'high',
      is_required: true
    },
    {
      task_id: taskId,
      criteria_type: 'functional',
      title: 'Filter pills implemented (All, Recent, High Priority, Needs Update)',
      description: 'Filter pills are displayed and functional for All, Recent, High Priority, and Needs Update categories',
      validation_method: 'manual',
      success_condition: 'All four filter pills are clickable and properly filter the document list',
      priority: 'high',
      is_required: true
    },
    {
      task_id: taskId,
      criteria_type: 'functional',
      title: 'Search filters by document title, description, and category',
      description: 'Search functionality looks through title, description, and category fields to find matches',
      validation_method: 'manual',
      success_condition: 'Search finds documents by matching text in title, description, or category fields',
      priority: 'high',
      is_required: true
    },
    {
      task_id: taskId,
      criteria_type: 'functional',
      title: 'Results count displayed when filters active',
      description: 'When search or filters are active, display count of matching results',
      validation_method: 'manual',
      success_condition: 'Results count shows "X results" when filters are applied',
      priority: 'medium',
      is_required: true
    },
    {
      task_id: taskId,
      criteria_type: 'quality',
      title: 'UI follows existing design patterns and accessibility',
      description: 'New search and filter UI components follow established design system and accessibility standards',
      validation_method: 'code_review',
      success_condition: 'UI uses consistent styling, proper ARIA labels, and keyboard navigation',
      priority: 'high',
      is_required: true
    },
    {
      task_id: taskId,
      criteria_type: 'technical',
      title: 'No TypeScript errors introduced',
      description: 'All new code passes TypeScript compilation without errors',
      validation_method: 'automated',
      validation_script: 'tsc --noEmit',
      success_condition: 'tsc --noEmit runs without errors',
      priority: 'high',
      is_required: true
    },
    {
      task_id: taskId,
      criteria_type: 'quality',
      title: 'Documentation updated with implementation details',
      description: 'Living docs feature documentation updated to include search and filter functionality',
      validation_method: 'manual',
      success_condition: 'Documentation includes search implementation details and usage instructions',
      priority: 'medium',
      is_required: true
    }
  ];

  console.log(`Adding ${successCriteria.length} success criteria for living docs search task...`);

  try {
    // Verify task exists first
    const { data: taskData, error: taskError } = await supabase
      .from('dev_tasks')
      .select('id, title, description, status')
      .eq('id', taskId)
      .single();

    if (taskError || !taskData) {
      console.error('Error: Task not found with ID:', taskId);
      console.error('Task error:', taskError?.message);
      return;
    }

    console.log(`\nTask Details:`);
    console.log(`  ID: ${taskData.id}`);
    console.log(`  Title: ${taskData.title}`);
    console.log(`  Description: ${taskData.description}`);
    console.log(`  Status: ${taskData.status}`);
    console.log('');

    // Insert all criteria
    const { data, error } = await supabase
      .from('dev_task_success_criteria')
      .insert(successCriteria)
      .select();

    if (error) {
      console.error('Error inserting success criteria:', error);
      throw error;
    }

    console.log(`Successfully added ${data.length} success criteria:`);
    data.forEach((criterion: any, index: number) => {
      console.log(`  ${index + 1}. [${criterion.priority}] ${criterion.title}`);
      console.log(`     Type: ${criterion.criteria_type}`);
      console.log(`     Validation: ${criterion.validation_method}`);
      if (criterion.validation_script) {
        console.log(`     Script: ${criterion.validation_script}`);
      }
      console.log('');
    });

    // Update task to mark that success criteria are defined
    const { error: updateError } = await supabase
      .from('dev_tasks')
      .update({ 
        success_criteria_defined: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (updateError) {
      console.warn('Warning: Could not update task success_criteria_defined flag:', updateError.message);
    } else {
      console.log('✅ Task updated with success_criteria_defined = true');
    }

  } catch (error) {
    console.error('Failed to add success criteria:', error);
    throw error;
  }
}

// Run the function
if (require.main === module) {
  addLivingDocsSearchCriteria()
    .then(() => {
      console.log('\n🎉 Living docs search success criteria added successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to add success criteria:', error);
      process.exit(1);
    });
}

export { addLivingDocsSearchCriteria };