#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface SuccessCriteria {
  id?: string;
  task_id: string;
  criteria_type: 'functional' | 'technical' | 'quality' | 'testing';
  title: string;
  description?: string;
  is_required: boolean;
  validation_method: 'manual' | 'automated' | 'code_review' | 'testing';
  validation_script?: string;
  success_condition?: string;
  priority: 'high' | 'medium' | 'low';
}

class SuccessCriteriaManager {
  private supabase = SupabaseClientService.getInstance().getClient();

  async addCriteria(taskId: string, criteria: Omit<SuccessCriteria, 'task_id'>): Promise<void> {
    const { error } = await this.supabase
      .from('dev_task_success_criteria')
      .insert({
        task_id: taskId,
        ...criteria
      });

    if (error) {
      throw new Error(`Failed to add success criteria: ${error.message}`);
    }

    console.log(`✅ Success criteria added: ${criteria.title}`);
  }

  async addDefaultCriteriaForTask(taskId: string, taskType: string): Promise<void> {
    const defaultCriteria = this.getDefaultCriteria(taskType);
    
    for (const criteria of defaultCriteria) {
      await this.addCriteria(taskId, criteria);
    }

    console.log(`✅ Added ${defaultCriteria.length} default success criteria for task type: ${taskType}`);
  }

  private getDefaultCriteria(taskType: string): Omit<SuccessCriteria, 'task_id'>[] {
    const commonCriteria = [
      {
        criteria_type: 'quality' as const,
        title: 'TypeScript compilation passes',
        description: 'Code must compile without TypeScript errors',
        is_required: true,
        validation_method: 'automated' as const,
        validation_script: 'tsc --noEmit',
        success_condition: 'Exit code 0',
        priority: 'high' as const
      },
      {
        criteria_type: 'quality' as const,
        title: 'Code formatting and lint checks pass',
        description: 'Code must pass ESLint and formatting rules',
        is_required: true,
        validation_method: 'automated' as const,
        validation_script: 'npm run lint',
        success_condition: 'No lint errors',
        priority: 'high' as const
      },
      {
        criteria_type: 'technical' as const,
        title: 'Code committed to git',
        description: 'Changes must be committed with descriptive message',
        is_required: true,
        validation_method: 'automated' as const,
        validation_script: 'git log --oneline -1',
        success_condition: 'Recent commit exists',
        priority: 'high' as const
      }
    ];

    const typeSpecificCriteria = {
      'feature': [
        {
          criteria_type: 'functional' as const,
          title: 'Feature requirements met',
          description: 'All functional requirements implemented as specified',
          is_required: true,
          validation_method: 'manual' as const,
          success_condition: 'All requirements verified',
          priority: 'high' as const
        },
        {
          criteria_type: 'testing' as const,
          title: 'Manual testing completed',
          description: 'Feature tested manually with various inputs',
          is_required: true,
          validation_method: 'manual' as const,
          success_condition: 'Testing scenarios pass',
          priority: 'medium' as const
        }
      ],
      'bug': [
        {
          criteria_type: 'functional' as const,
          title: 'Bug reproduction verified',
          description: 'Bug can be reproduced before fix',
          is_required: true,
          validation_method: 'manual' as const,
          success_condition: 'Bug reproduced',
          priority: 'high' as const
        },
        {
          criteria_type: 'functional' as const,
          title: 'Bug fix verified',
          description: 'Bug no longer occurs after fix',
          is_required: true,
          validation_method: 'manual' as const,
          success_condition: 'Bug not reproducible',
          priority: 'high' as const
        }
      ],
      'refactor': [
        {
          criteria_type: 'technical' as const,
          title: 'Functionality preserved',
          description: 'All existing functionality works as before',
          is_required: true,
          validation_method: 'testing' as const,
          success_condition: 'Tests pass and manual verification complete',
          priority: 'high' as const
        },
        {
          criteria_type: 'quality' as const,
          title: 'Code quality improved',
          description: 'Code is cleaner, more maintainable, or more performant',
          is_required: true,
          validation_method: 'code_review' as const,
          success_condition: 'Code review approval',
          priority: 'medium' as const
        }
      ]
    };

    return [
      ...commonCriteria,
      ...(typeSpecificCriteria[taskType as keyof typeof typeSpecificCriteria] || [])
    ];
  }

  async validateCriteria(taskId: string, criteriaId: string, status: 'passed' | 'failed', notes?: string): Promise<void> {
    const { error } = await this.supabase
      .from('dev_task_validations')
      .insert({
        task_id: taskId,
        criteria_id: criteriaId,
        validation_status: status,
        validated_by: 'claude',
        validation_result: status === 'passed' ? 'Success' : 'Failed',
        notes
      });

    if (error) {
      throw new Error(`Failed to record validation: ${error.message}`);
    }

    console.log(`✅ Validation recorded: ${status}`);
  }

  async listCriteriaForTask(taskId: string): Promise<void> {
    const { data: criteria, error } = await this.supabase
      .from('dev_task_success_criteria')
      .select(`
        *,
        dev_task_validations(validation_status, validated_at, notes)
      `)
      .eq('task_id', taskId)
      .order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch criteria: ${error.message}`);
    }

    if (!criteria || criteria.length === 0) {
      console.log('No success criteria defined for this task.');
      return;
    }

    console.log('\n📋 Success Criteria for Task:');
    console.log('================================');

    criteria.forEach((criterion, index) => {
      const validation = criterion.dev_task_validations[0];
      const status = validation?.validation_status || 'pending';
      const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏳';
      
      console.log(`\n${index + 1}. ${statusIcon} ${criterion.title}`);
      console.log(`   Type: ${criterion.criteria_type} | Priority: ${criterion.priority} | Required: ${criterion.is_required ? 'Yes' : 'No'}`);
      if (criterion.description) {
        console.log(`   Description: ${criterion.description}`);
      }
      console.log(`   Validation: ${criterion.validation_method}`);
      if (criterion.success_condition) {
        console.log(`   Success condition: ${criterion.success_condition}`);
      }
      if (validation) {
        console.log(`   Status: ${status} (validated: ${new Date(validation.validated_at).toLocaleDateString()})`);
        if (validation.notes) {
          console.log(`   Notes: ${validation.notes}`);
        }
      }
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new SuccessCriteriaManager();

  try {
    switch (command) {
      case 'add-defaults':
        if (args.length < 3) {
          console.error('Usage: add-defaults <task-id> <task-type>');
          process.exit(1);
        }
        await manager.addDefaultCriteriaForTask(args[1], args[2]);
        break;

      case 'list':
        if (args.length < 2) {
          console.error('Usage: list <task-id>');
          process.exit(1);
        }
        await manager.listCriteriaForTask(args[1]);
        break;

      case 'validate':
        if (args.length < 4) {
          console.error('Usage: validate <task-id> <criteria-id> <passed|failed> [notes]');
          process.exit(1);
        }
        await manager.validateCriteria(args[1], args[2], args[3] as 'passed' | 'failed', args[4]);
        break;

      default:
        console.log('Available commands:');
        console.log('  add-defaults <task-id> <task-type>  - Add default success criteria');
        console.log('  list <task-id>                      - List criteria for task');
        console.log('  validate <task-id> <criteria-id> <passed|failed> [notes] - Record validation');
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}