#!/usr/bin/env ts-node

/**
 * Service Cleanup Tracker
 * Manages and tracks cleanup tasks for shared services
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Command } from 'commander';

interface CleanupTask {
  service_name: string;
  task_type: 'migration' | 'documentation' | 'testing' | 'archival' | 'verification' | 'monitoring';
  task_description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at?: string;
  completed_at?: string;
  notes?: string;
  dependencies?: string[];
}

class ServiceCleanupTracker {
  private supabase = SupabaseClientService.getInstance().getClient();
  
  async initializeTracking(serviceName: string): Promise<void> {
    console.log(`\nInitializing cleanup tracking for ${serviceName}...`);
    
    // Standard cleanup tasks template
    const standardTasks: Omit<CleanupTask, 'service_name'>[] = [
      {
        task_type: 'migration',
        task_description: 'Migrate service to packages/shared/services',
        status: 'pending',
        priority: 'high'
      },
      {
        task_type: 'migration',
        task_description: 'Update all import paths across codebase',
        status: 'pending',
        priority: 'high',
        dependencies: ['Migrate service to packages/shared/services']
      },
      {
        task_type: 'documentation',
        task_description: 'Update service metadata in sys_shared_services',
        status: 'pending',
        priority: 'medium'
      },
      {
        task_type: 'documentation',
        task_description: 'Document service patterns and usage examples',
        status: 'pending',
        priority: 'medium'
      },
      {
        task_type: 'testing',
        task_description: 'Create integration tests in dhg-service-test',
        status: 'pending',
        priority: 'high'
      },
      {
        task_type: 'testing',
        task_description: 'Add unit tests for service methods',
        status: 'pending',
        priority: 'medium'
      },
      {
        task_type: 'verification',
        task_description: 'Run TypeScript compilation check',
        status: 'pending',
        priority: 'critical',
        dependencies: ['Update all import paths across codebase']
      },
      {
        task_type: 'verification',
        task_description: 'Test service functionality after migration',
        status: 'pending',
        priority: 'critical',
        dependencies: ['Update all import paths across codebase']
      },
      {
        task_type: 'archival',
        task_description: 'Archive old service location',
        status: 'pending',
        priority: 'low',
        dependencies: ['Test service functionality after migration']
      },
      {
        task_type: 'monitoring',
        task_description: 'Set up continuous health monitoring',
        status: 'pending',
        priority: 'medium'
      },
      {
        task_type: 'monitoring',
        task_description: 'Configure automated usage tracking',
        status: 'pending',
        priority: 'low'
      }
    ];
    
    // Insert tasks for this service
    for (const task of standardTasks) {
      const { error } = await this.supabase
        .from('sys_service_cleanup_tasks')
        .insert({
          service_name: serviceName,
          ...task,
          created_at: new Date().toISOString()
        });
        
      if (error) {
        console.error(`Error creating task: ${error.message}`);
      }
    }
    
    console.log(`✓ Created ${standardTasks.length} cleanup tasks for ${serviceName}`);
  }
  
  async updateTaskStatus(
    serviceName: string, 
    taskDescription: string, 
    status: CleanupTask['status'],
    notes?: string
  ): Promise<void> {
    const updateData: any = { status };
    if (notes) updateData.notes = notes;
    if (status === 'completed') updateData.completed_at = new Date().toISOString();
    
    const { error } = await this.supabase
      .from('sys_service_cleanup_tasks')
      .update(updateData)
      .eq('service_name', serviceName)
      .eq('task_description', taskDescription);
      
    if (error) {
      console.error(`Error updating task: ${error.message}`);
    } else {
      console.log(`✓ Updated task status to ${status}`);
    }
  }
  
  async getServiceStatus(serviceName: string): Promise<void> {
    const { data: tasks, error } = await this.supabase
      .from('sys_service_cleanup_tasks')
      .select('*')
      .eq('service_name', serviceName)
      .order('priority', { ascending: false })
      .order('created_at');
      
    if (error) {
      console.error(`Error fetching tasks: ${error.message}`);
      return;
    }
    
    console.log(`\nCleanup Status for ${serviceName}:`);
    console.log('='.repeat(50));
    
    const tasksByType = tasks.reduce((acc: Record<string, CleanupTask[]>, task) => {
      if (!acc[task.task_type]) acc[task.task_type] = [];
      acc[task.task_type].push(task);
      return acc;
    }, {} as Record<string, CleanupTask[]>);
    
    for (const [type, typeTasks] of Object.entries(tasksByType)) {
      console.log(`\n${type.toUpperCase()}:`);
      for (const task of typeTasks) {
        const status = task.status === 'completed' ? '✓' : 
                      task.status === 'in_progress' ? '⏳' : 
                      task.status === 'blocked' ? '⚠️' : '○';
        console.log(`  ${status} ${task.task_description} [${task.priority}]`);
        if (task.notes) console.log(`     Note: ${task.notes}`);
      }
    }
    
    // Summary
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const percentage = Math.round((completed / total) * 100);
    
    console.log(`\nProgress: ${completed}/${total} tasks (${percentage}%)`);
  }
  
  async getPendingTasks(): Promise<void> {
    const { data: tasks, error } = await this.supabase
      .from('sys_service_cleanup_tasks')
      .select('*')
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: false })
      .order('service_name');
      
    if (error) {
      console.error(`Error fetching tasks: ${error.message}`);
      return;
    }
    
    console.log('\nPending Cleanup Tasks:');
    console.log('='.repeat(70));
    
    const tasksByService = tasks.reduce((acc: Record<string, CleanupTask[]>, task) => {
      if (!acc[task.service_name]) acc[task.service_name] = [];
      acc[task.service_name].push(task);
      return acc;
    }, {} as Record<string, CleanupTask[]>);
    
    for (const [service, serviceTasks] of Object.entries(tasksByService)) {
      console.log(`\n${service}:`);
      for (const task of serviceTasks) {
        const icon = task.priority === 'critical' ? '🔴' :
                    task.priority === 'high' ? '🟡' :
                    task.priority === 'medium' ? '🟢' : '⚪';
        const status = task.status === 'in_progress' ? ' [IN PROGRESS]' : '';
        console.log(`  ${icon} ${task.task_description}${status}`);
      }
    }
  }
  
  async generateReport(): Promise<void> {
    const { data: services, error } = await this.supabase
      .from('sys_service_cleanup_tasks')
      .select('service_name')
      .order('service_name');
      
    if (error) {
      console.error(`Error fetching services: ${error.message}`);
      return;
    }
    
    const uniqueServices = [...new Set(services.map(s => s.service_name))];
    
    console.log('\nService Cleanup Report:');
    console.log('='.repeat(70));
    
    for (const service of uniqueServices) {
      const { data: tasks } = await this.supabase
        .from('sys_service_cleanup_tasks')
        .select('*')
        .eq('service_name', service);
        
      const completed = tasks?.filter(t => t.status === 'completed').length || 0;
      const total = tasks?.length || 0;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
      console.log(`\n${service}: [${bar}] ${percentage}% (${completed}/${total})`);
      
      // Show next pending task
      const nextTask = tasks?.find(t => t.status === 'pending' && t.priority !== 'low');
      if (nextTask) {
        console.log(`  Next: ${nextTask.task_description}`);
      }
    }
  }
}

// CLI Interface
const program = new Command();
const tracker = new ServiceCleanupTracker();

program
  .name('service-cleanup-tracker')
  .description('Track and manage service cleanup tasks')
  .version('1.0.0');

program
  .command('init <service>')
  .description('Initialize cleanup tracking for a service')
  .action(async (service) => {
    await tracker.initializeTracking(service);
  });

program
  .command('update <service> <task>')
  .description('Update task status')
  .option('-s, --status <status>', 'Task status: pending|in_progress|completed|blocked')
  .option('-n, --notes <notes>', 'Additional notes')
  .action(async (service, task, options) => {
    await tracker.updateTaskStatus(service, task, options.status || 'in_progress', options.notes);
  });

program
  .command('status <service>')
  .description('Get cleanup status for a service')
  .action(async (service) => {
    await tracker.getServiceStatus(service);
  });

program
  .command('pending')
  .description('List all pending cleanup tasks')
  .action(async () => {
    await tracker.getPendingTasks();
  });

program
  .command('report')
  .description('Generate cleanup progress report')
  .action(async () => {
    await tracker.generateReport();
  });

program.parse(process.argv);