#!/usr/bin/env ts-node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();
const supabase = SupabaseClientService.getInstance().getClient();

program
  .name('migrate-service')
  .description('Manage service migration to new base class architecture')
  .version('1.0.0');

// Start migration for a service
program
  .command('start <serviceName> <baseClassType>')
  .description('Start migration for a service')
  .option('--pilot', 'Mark as pilot migration')
  .action(async (serviceName: string, baseClassType: string, options) => {
    try {
      console.log(`Starting migration for ${serviceName} to ${baseClassType}...`);
      
      // Validate base class type
      const validTypes = ['SingletonService', 'BusinessService', 'AdapterService', 'HybridService'];
      if (!validTypes.includes(baseClassType)) {
        throw new Error(`Invalid base class type. Must be one of: ${validTypes.join(', ')}`);
      }
      
      // Start migration in database
      const { data, error } = await supabase
        .rpc('start_service_migration', {
          p_service_name: serviceName,
          p_base_class_type: baseClassType
        });
      
      if (error) throw error;
      
      console.log(`✅ Migration started for ${serviceName}`);
      console.log(`   Base class: ${baseClassType}`);
      console.log(`   Service ID: ${data}`);
      
      // Create migration branch if requested
      if (options.pilot) {
        console.log(`\n📝 Creating pilot migration files...`);
        await createPilotFiles(serviceName, baseClassType);
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Check migration status
program
  .command('status [serviceName]')
  .description('Check migration status for a service or all services')
  .action(async (serviceName?: string) => {
    try {
      let query = supabase
        .from('sys_service_migration_progress_view')
        .select('*');
      
      if (serviceName) {
        query = query.eq('service_name', serviceName);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log('No migrations in progress');
        return;
      }
      
      console.log('\n📊 Migration Status:');
      console.log('─'.repeat(80));
      
      data.forEach(service => {
        console.log(`\n${service.service_name}:`);
        console.log(`  Status: ${service.migration_status}`);
        console.log(`  Base Class: ${service.base_class_type}`);
        console.log(`  Progress: ${service.progress_percentage}% (${service.completed_tasks}/${service.total_tasks} tasks)`);
        if (service.migration_started_at) {
          console.log(`  Started: ${new Date(service.migration_started_at).toLocaleDateString()}`);
        }
        if (service.breaking_changes) {
          console.log(`  ⚠️  Breaking Changes: Yes`);
        }
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Complete a task
program
  .command('complete-task <serviceName> <taskType>')
  .description('Mark a migration task as complete')
  .option('--notes <notes>', 'Add notes about the task')
  .action(async (serviceName: string, taskType: string, options) => {
    try {
      // Find the service
      const { data: service, error: serviceError } = await supabase
        .from('sys_shared_services')
        .select('id')
        .eq('service_name', serviceName)
        .single();
      
      if (serviceError) throw serviceError;
      
      // Update the task
      const { error } = await supabase
        .from('sys_service_migration_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: options.notes
        })
        .eq('service_id', service.id)
        .eq('task_type', taskType);
      
      if (error) throw error;
      
      console.log(`✅ Task '${taskType}' completed for ${serviceName}`);
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Record performance metrics
program
  .command('record-metrics <serviceName> <metricType>')
  .description('Record performance metrics (baseline or after)')
  .option('--memory <mb>', 'Memory usage in MB')
  .option('--init-time <ms>', 'Initialization time in ms')
  .option('--response-time <ms>', 'Average response time in ms')
  .action(async (serviceName: string, metricType: string, options) => {
    try {
      const metrics = {
        memory_mb: options.memory ? parseFloat(options.memory) : null,
        init_time_ms: options.initTime ? parseInt(options.initTime) : null,
        response_time_ms: options.responseTime ? parseInt(options.responseTime) : null,
        recorded_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .rpc('record_migration_metrics', {
          p_service_name: serviceName,
          p_metric_type: metricType,
          p_metrics: metrics
        });
      
      if (error) throw error;
      
      console.log(`✅ ${metricType} metrics recorded for ${serviceName}`);
      console.log(JSON.stringify(metrics, null, 2));
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Generate migration report
program
  .command('report')
  .description('Generate migration progress report')
  .action(async () => {
    try {
      const { data, error } = await supabase
        .from('sys_service_migration_progress_view')
        .select('*')
        .order('migration_started_at', { ascending: false });
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const completed = data?.filter(s => s.migration_status === 'completed').length || 0;
      const inProgress = data?.filter(s => s.migration_status === 'in_progress').length || 0;
      
      console.log('\n📊 Service Migration Report');
      console.log('═'.repeat(50));
      console.log(`Total Services: ${total}`);
      console.log(`Completed: ${completed}`);
      console.log(`In Progress: ${inProgress}`);
      console.log(`Pending: ${total - completed - inProgress}`);
      
      if (inProgress > 0) {
        console.log('\n🚧 Services In Progress:');
        data?.filter(s => s.migration_status === 'in_progress').forEach(s => {
          console.log(`  - ${s.service_name} (${s.progress_percentage}%)`);
        });
      }
      
      if (completed > 0) {
        console.log('\n✅ Completed Migrations:');
        data?.filter(s => s.migration_status === 'completed').forEach(s => {
          console.log(`  - ${s.service_name} → ${s.base_class_type}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Helper function to create pilot files
async function createPilotFiles(serviceName: string, baseClassType: string) {
  const timestamp = new Date().toISOString().split('T')[0];
  const pilotDir = path.join(
    process.cwd(),
    'packages/shared/services/base-classes/pilots',
    `${serviceName}-${timestamp}`
  );
  
  // Create directory
  fs.mkdirSync(pilotDir, { recursive: true });
  
  // Create refactored service file
  const refactoredContent = `// Refactored ${serviceName} using ${baseClassType}
// Created: ${timestamp}

import { ${baseClassType} } from '../${baseClassType}';

export class ${serviceName}Refactored extends ${baseClassType} {
  // TODO: Implement refactored service
  
  protected async initialize(): Promise<void> {
    // TODO: Initialize service
    this.initialized = true;
  }
  
  protected async cleanup(): Promise<void> {
    // TODO: Cleanup resources
    this.initialized = false;
  }
  
  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    // TODO: Implement health check
    return { healthy: true };
  }
}
`;
  
  fs.writeFileSync(path.join(pilotDir, `${serviceName}.refactored.ts`), refactoredContent);
  
  // Create test file
  const testContent = `// Tests for refactored ${serviceName}
import { ${serviceName}Refactored } from './${serviceName}.refactored';

describe('${serviceName}Refactored', () => {
  let service: ${serviceName}Refactored;
  
  beforeEach(() => {
    // TODO: Setup
  });
  
  afterEach(async () => {
    // TODO: Cleanup
  });
  
  test('should initialize properly', async () => {
    // TODO: Test initialization
  });
  
  test('should pass health check', async () => {
    // TODO: Test health check
  });
});
`;
  
  fs.writeFileSync(path.join(pilotDir, `${serviceName}.test.ts`), testContent);
  
  // Create migration notes
  const notesContent = `# Migration Notes: ${serviceName}

## Base Class: ${baseClassType}

## Migration Date: ${timestamp}

## Changes Made:
- [ ] Extend from ${baseClassType}
- [ ] Implement required abstract methods
- [ ] Add proper initialization logic
- [ ] Add cleanup/resource management
- [ ] Implement health check
- [ ] Add comprehensive tests
- [ ] Update documentation

## Breaking Changes:
- None identified yet

## Performance Metrics:
- Baseline: TBD
- After Migration: TBD

## Notes:
- 
`;
  
  fs.writeFileSync(path.join(pilotDir, 'MIGRATION_NOTES.md'), notesContent);
  
  console.log(`\n📁 Created pilot files in: ${pilotDir}`);
}

program.parse(process.argv);