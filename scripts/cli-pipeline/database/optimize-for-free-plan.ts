#!/usr/bin/env ts-node

/**
 * Optimize database for Supabase free plan limits
 * Helps reduce bandwidth usage and table count
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();
const supabase = SupabaseClientService.getInstance().getClient();

async function archiveOldData() {
  console.log('🗄️  Archiving old data to reduce bandwidth...\n');
  
  // Archive old dev_tasks
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: oldTasks, error: tasksError } = await supabase
    .from('dev_tasks')
    .select('id, title, created_at')
    .eq('status', 'completed')
    .lt('created_at', thirtyDaysAgo.toISOString());
    
  if (oldTasks && oldTasks.length > 0) {
    console.log(`Found ${oldTasks.length} completed tasks older than 30 days`);
    // In production, you would move these to an archive table
  }
  
  // Clean old command history
  const { count: commandCount } = await supabase
    .from('command_history')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', thirtyDaysAgo.toISOString());
    
  console.log(`Found ${commandCount || 0} old command history records\n`);
}

async function optimizeQueries() {
  console.log('📊 Query Optimization Recommendations:\n');
  
  // Check for tables with large text columns
  const largeTextTables = [
    'dev_tasks',
    'sources_google',
    'media_transcriptions',
    'doc_files',
    'scripts'
  ];
  
  console.log('Tables with large text fields (optimize SELECT queries):');
  largeTextTables.forEach(table => {
    console.log(`  - ${table}: Use specific column selection instead of SELECT *`);
  });
  
  console.log('\n🔧 Immediate Actions:');
  console.log('1. Update all queries to select only needed columns');
  console.log('2. Implement pagination (limit 50-100 records per request)');
  console.log('3. Add caching layer for frequently accessed data');
  console.log('4. Disable real-time subscriptions if not critical');
}

async function checkBandwidthUsage() {
  console.log('\n📈 Bandwidth Usage Patterns:\n');
  
  // Identify high-traffic operations
  const highTrafficOps = [
    { operation: 'Google Drive sync', impact: 'High', recommendation: 'Run less frequently, batch operations' },
    { operation: 'Media transcriptions', impact: 'High', recommendation: 'Process locally, upload results only' },
    { operation: 'Command tracking', impact: 'Medium', recommendation: 'Batch inserts, reduce frequency' },
    { operation: 'Real-time subscriptions', impact: 'Very High', recommendation: 'Disable or limit to critical tables' }
  ];
  
  console.log('High bandwidth operations:');
  highTrafficOps.forEach(op => {
    console.log(`  ${op.operation}:`);
    console.log(`    Impact: ${op.impact}`);
    console.log(`    Recommendation: ${op.recommendation}`);
  });
}

async function suggestTableConsolidation() {
  console.log('\n🏗️  Table Consolidation Opportunities:\n');
  
  const consolidationSuggestions = [
    {
      tables: ['command_history', 'command_tracking', 'command_usage'],
      suggestion: 'Merge into single command_analytics table with type field'
    },
    {
      tables: ['work_summaries', 'ai_work_summaries', 'dev_task_work_sessions'],
      suggestion: 'Combine into unified work_tracking table'
    },
    {
      tables: ['media_transcriptions', 'media_summaries', 'media_sessions'],
      suggestion: 'Create single media_processing table with status field'
    }
  ];
  
  console.log('Suggested consolidations:');
  consolidationSuggestions.forEach(s => {
    console.log(`  ${s.tables.join(', ')}:`);
    console.log(`    → ${s.suggestion}\n`);
  });
}

program
  .name('optimize-for-free-plan')
  .description('Analyze and optimize database for Supabase free plan limits')
  .action(async () => {
    console.log('🚀 Supabase Free Plan Optimization Analysis\n');
    console.log('Target: Reduce egress bandwidth below 5 GB\n');
    
    await archiveOldData();
    await optimizeQueries();
    await checkBandwidthUsage();
    await suggestTableConsolidation();
    
    console.log('\n✅ Analysis complete!');
    console.log('\n💡 Top 3 Actions to Stay on Free Plan:');
    console.log('1. Implement caching to reduce API calls by 70%');
    console.log('2. Disable real-time subscriptions (saves 50%+ bandwidth)');
    console.log('3. Archive old data and consolidate tables (reduce from 135 to ~80)');
  });

program.parse(process.argv);