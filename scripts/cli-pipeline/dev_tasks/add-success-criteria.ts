#!/usr/bin/env ts-node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const supabase = SupabaseClientService.getInstance().getClient();

interface SuccessCriteriaInput {
  task_id: string;
  criteria_type: 'functional' | 'technical' | 'quality' | 'testing';
  title: string;
  description?: string;
  validation_method?: 'manual' | 'automated' | 'code_review' | 'testing';
  validation_script?: string;
  success_condition?: string;
  priority?: 'high' | 'medium' | 'low';
  is_required?: boolean;
}

async function addSuccessCriteria(input: SuccessCriteriaInput) {
  try {
    // Verify task exists
    const { data: task, error: taskError } = await supabase
      .from('dev_tasks')
      .select('id, title')
      .eq('id', input.task_id)
      .single();

    if (taskError || !task) {
      console.error(chalk.red('Error: Task not found'));
      return;
    }

    // Add success criteria
    const { data, error } = await supabase
      .from('dev_task_success_criteria')
      .insert({
        task_id: input.task_id,
        criteria_type: input.criteria_type,
        title: input.title,
        description: input.description,
        validation_method: input.validation_method || 'manual',
        validation_script: input.validation_script,
        success_condition: input.success_condition,
        priority: input.priority || 'medium',
        is_required: input.is_required !== false
      })
      .select()
      .single();

    if (error) {
      console.error(chalk.red('Error adding success criteria:'), error.message);
      return;
    }

    // Update task to mark that criteria are defined
    await supabase
      .from('dev_tasks')
      .update({ success_criteria_defined: true })
      .eq('id', input.task_id);

    console.log(chalk.green('✅ Success criteria added:'));
    console.log(chalk.blue(`   Task: ${task.title}`));
    console.log(chalk.blue(`   Criteria: ${data.title}`));
    console.log(chalk.blue(`   Type: ${data.criteria_type}`));
    console.log(chalk.blue(`   Validation: ${data.validation_method}`));
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function listSuccessCriteria(taskId: string) {
  try {
    const { data: criteria, error } = await supabase
      .from('dev_task_success_criteria')
      .select('*')
      .eq('task_id', taskId)
      .order('priority', { ascending: true });

    if (error) {
      console.error(chalk.red('Error fetching criteria:'), error.message);
      return;
    }

    if (!criteria || criteria.length === 0) {
      console.log(chalk.yellow('No success criteria defined for this task'));
      return;
    }

    console.log(chalk.green('\n📋 Success Criteria:'));
    criteria.forEach((c, index) => {
      console.log(chalk.blue(`\n${index + 1}. ${c.title}`));
      console.log(`   Type: ${c.criteria_type}`);
      console.log(`   Priority: ${c.priority}`);
      console.log(`   Required: ${c.is_required ? 'Yes' : 'No'}`);
      console.log(`   Validation: ${c.validation_method}`);
      if (c.success_condition) {
        console.log(`   Condition: ${c.success_condition}`);
      }
    });

    // Check validation status
    const { data: validations, error: valError } = await supabase
      .from('dev_task_validations')
      .select('criteria_id, validation_status')
      .in('criteria_id', criteria.map(c => c.id));

    if (!valError && validations) {
      const validationMap = new Map(validations.map(v => [v.criteria_id, v.validation_status]));
      const passedCount = criteria.filter(c => validationMap.get(c.id) === 'passed').length;
      console.log(chalk.green(`\n✅ Progress: ${passedCount}/${criteria.length} criteria met`));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function validateCriteria(criteriaId: string, status: 'passed' | 'failed', notes?: string) {
  try {
    // Get criteria details
    const { data: criteria, error: criteriaError } = await supabase
      .from('dev_task_success_criteria')
      .select('*')
      .eq('id', criteriaId)
      .single();

    if (criteriaError || !criteria) {
      console.error(chalk.red('Error: Criteria not found'));
      return;
    }

    // Add validation record
    const { data, error } = await supabase
      .from('dev_task_validations')
      .insert({
        task_id: criteria.task_id,
        criteria_id: criteriaId,
        validation_status: status,
        validated_by: 'user',
        validation_result: notes || `Criteria ${status}`,
        confidence_level: status === 'passed' ? 9 : 3,
        notes: notes
      })
      .select()
      .single();

    if (error) {
      console.error(chalk.red('Error validating criteria:'), error.message);
      return;
    }

    console.log(chalk.green(`✅ Criteria validated: ${status}`));
    console.log(chalk.blue(`   Criteria: ${criteria.title}`));
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Example quality gates
async function addStandardQualityGates(taskId: string) {
  const standardGates = [
    { gate_type: 'typescript', gate_name: 'TypeScript Check', status: 'pending' },
    { gate_type: 'lint', gate_name: 'ESLint Check', status: 'pending' },
    { gate_type: 'tests', gate_name: 'Unit Tests', status: 'pending' },
    { gate_type: 'code_review', gate_name: 'Code Review', status: 'pending' }
  ];

  try {
    const { data, error } = await supabase
      .from('dev_task_quality_gates')
      .insert(standardGates.map(gate => ({ ...gate, task_id: taskId })))
      .select();

    if (error) {
      console.error(chalk.red('Error adding quality gates:'), error.message);
      return;
    }

    console.log(chalk.green(`✅ Added ${data.length} quality gates`));
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// CLI setup
const program = new Command();

program
  .name('success-criteria')
  .description('Manage dev task success criteria')
  .version('1.0.0');

program
  .command('add')
  .description('Add success criteria to a task')
  .requiredOption('-t, --task <taskId>', 'Task ID')
  .requiredOption('--title <title>', 'Criteria title')
  .option('--type <type>', 'Criteria type (functional|technical|quality|testing)', 'functional')
  .option('--description <desc>', 'Detailed description')
  .option('--method <method>', 'Validation method (manual|automated|code_review|testing)', 'manual')
  .option('--condition <condition>', 'Success condition')
  .option('--priority <priority>', 'Priority (high|medium|low)', 'medium')
  .option('--optional', 'Mark as optional (not required)')
  .action(async (options) => {
    await addSuccessCriteria({
      task_id: options.task,
      criteria_type: options.type,
      title: options.title,
      description: options.description,
      validation_method: options.method,
      success_condition: options.condition,
      priority: options.priority,
      is_required: !options.optional
    });
  });

program
  .command('list')
  .description('List success criteria for a task')
  .requiredOption('-t, --task <taskId>', 'Task ID')
  .action(async (options) => {
    await listSuccessCriteria(options.task);
  });

program
  .command('validate')
  .description('Validate a specific criteria')
  .requiredOption('-c, --criteria <criteriaId>', 'Criteria ID')
  .requiredOption('-s, --status <status>', 'Validation status (passed|failed)')
  .option('-n, --notes <notes>', 'Validation notes')
  .action(async (options) => {
    await validateCriteria(options.criteria, options.status, options.notes);
  });

program
  .command('add-gates')
  .description('Add standard quality gates to a task')
  .requiredOption('-t, --task <taskId>', 'Task ID')
  .action(async (options) => {
    await addStandardQualityGates(options.task);
  });

program.parse(process.argv);