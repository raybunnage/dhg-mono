#!/usr/bin/env ts-node

import { program } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface PipelineGap {
  service_name: string;
  display_name: string;
  service_type: string;
  app_usage_count: number;
  used_by_apps: string[];
  suggested_pipeline: string;
  priority: 'high' | 'medium' | 'low';
}

interface FindGapsOptions {
  minApps?: string;
  showCommands?: boolean;
}

function suggestPipeline(serviceName: string): string {
  // Suggest appropriate pipeline based on service name patterns
  const patterns: Record<string, string> = {
    'auth': 'auth',
    'user': 'auth',
    'google': 'google_sync',
    'drive': 'google_sync',
    'email': 'gmail',
    'gmail': 'gmail',
    'document': 'document',
    'classify': 'classify',
    'ai': 'ai',
    'claude': 'ai',
    'prompt': 'prompt_service',
    'media': 'media-processing',
    'audio': 'media-processing',
    'video': 'media-processing',
    'script': 'scripts',
    'expert': 'experts',
    'database': 'database',
    'supabase': 'database',
    'convert': 'utilities',
    'format': 'utilities',
    'file': 'document'
  };
  
  const lowerName = serviceName.toLowerCase();
  
  for (const [pattern, pipeline] of Object.entries(patterns)) {
    if (lowerName.includes(pattern)) {
      return pipeline;
    }
  }
  
  return 'utilities'; // default
}

function determinePriority(appCount: number, serviceName: string): 'high' | 'medium' | 'low' {
  // High priority if used by many apps or is a critical service type
  const criticalPatterns = ['auth', 'supabase', 'database', 'google'];
  const isCritical = criticalPatterns.some(p => serviceName.toLowerCase().includes(p));
  
  if (appCount >= 5 || isCritical) return 'high';
  if (appCount >= 3) return 'medium';
  return 'low';
}

async function generateCliCommands(gap: PipelineGap): Promise<string[]> {
  // Generate suggested CLI commands based on service type
  const commands: string[] = [];
  const serviceName = gap.service_name;
  
  // Common commands
  commands.push(`list-${serviceName}s`, `get-${serviceName}`, `search-${serviceName}`);
  
  // Type-specific commands
  if (gap.service_type === 'singleton' || serviceName.includes('service')) {
    commands.push(`test-${serviceName}`, `health-check`);
  }
  
  if (serviceName.includes('auth') || serviceName.includes('user')) {
    commands.push('check-permissions', 'validate-token', 'list-users');
  }
  
  if (serviceName.includes('google') || serviceName.includes('drive')) {
    commands.push('sync-files', 'list-folders', 'check-permissions');
  }
  
  if (serviceName.includes('document') || serviceName.includes('file')) {
    commands.push('process-documents', 'validate-format', 'convert-type');
  }
  
  if (serviceName.includes('ai') || serviceName.includes('claude')) {
    commands.push('send-prompt', 'analyze-content', 'generate-summary');
  }
  
  return commands;
}

async function findPipelineGaps(options: FindGapsOptions): Promise<void> {
  console.log('🔍 Finding pipeline coverage gaps...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const minApps = parseInt(options.minApps || '1');
  
  try {
    // Get all services used in apps but not in pipelines
    const { data: gaps, error } = await supabase
      .from('registry_pipeline_coverage_gaps_view')
      .select('*')
      .gte('app_usage_count', minApps)
      .order('app_usage_count', { ascending: false });
    
    if (error) throw error;
    
    if (!gaps || gaps.length === 0) {
      console.log('✅ Excellent coverage! All services used in apps are available via CLI pipelines.');
      return;
    }
    
    // Enhance gap data
    const enhancedGaps: PipelineGap[] = gaps.map(gap => ({
      service_name: gap.service_name,
      display_name: gap.display_name,
      service_type: gap.service_type,
      app_usage_count: gap.app_usage_count,
      used_by_apps: gap.used_by_apps?.split(', ') || [],
      suggested_pipeline: suggestPipeline(gap.service_name),
      priority: determinePriority(gap.app_usage_count, gap.service_name)
    }));
    
    // Sort by priority and app count
    enhancedGaps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return priorityDiff !== 0 ? priorityDiff : b.app_usage_count - a.app_usage_count;
    });
    
    console.log(`Found ${enhancedGaps.length} services that could benefit from CLI commands\n`);
    
    // Group by priority
    const grouped = enhancedGaps.reduce((acc, gap) => {
      if (!acc[gap.priority]) acc[gap.priority] = [];
      acc[gap.priority].push(gap);
      return acc;
    }, {} as Record<string, PipelineGap[]>);
    
    // Display results by priority
    for (const [priority, priorityGaps] of Object.entries(grouped)) {
      const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
      console.log(`\n${emoji} ${priority.toUpperCase()} PRIORITY\n${'─'.repeat(50)}`);
      
      for (const gap of priorityGaps) {
        console.log(`\n📦 ${gap.service_name}`);
        console.log(`   Display Name: ${gap.display_name}`);
        console.log(`   Type: ${gap.service_type}`);
        console.log(`   Used by: ${gap.app_usage_count} app(s) - ${gap.used_by_apps.join(', ')}`);
        console.log(`   Suggested Pipeline: ${gap.suggested_pipeline}`);
        
        if (options.showCommands) {
          const commands = await generateCliCommands(gap);
          console.log(`   Suggested Commands:`);
          commands.forEach(cmd => console.log(`     - ${cmd}`));
        }
      }
    }
    
    // Implementation guide
    console.log('\n\n📋 Implementation Guide\n' + '═'.repeat(50));
    console.log('\nTo add CLI commands for these services:\n');
    
    // Group by suggested pipeline
    const byPipeline = enhancedGaps.reduce((acc, gap) => {
      if (!acc[gap.suggested_pipeline]) acc[gap.suggested_pipeline] = [];
      acc[gap.suggested_pipeline].push(gap);
      return acc;
    }, {} as Record<string, PipelineGap[]>);
    
    for (const [pipeline, pipelineGaps] of Object.entries(byPipeline)) {
      console.log(`\n### ${pipeline} pipeline:`);
      console.log(`Location: scripts/cli-pipeline/${pipeline}/\n`);
      
      for (const gap of pipelineGaps) {
        console.log(`1. Create ${gap.service_name}-commands.ts:`);
        console.log(`   - Import the ${gap.service_name} service from @shared/services`);
        console.log(`   - Implement commands for common operations`);
        console.log(`   - Add error handling and user feedback\n`);
        
        console.log(`2. Update ${pipeline}-cli.sh:`);
        console.log(`   - Add new command cases`);
        console.log(`   - Update help text\n`);
      }
    }
    
    // Summary statistics
    console.log('\n📊 Summary:');
    console.log(`   Total gaps: ${enhancedGaps.length}`);
    console.log(`   High priority: ${grouped.high?.length || 0}`);
    console.log(`   Medium priority: ${grouped.medium?.length || 0}`);
    console.log(`   Low priority: ${grouped.low?.length || 0}`);
    
    // Next steps
    console.log('\n\n🚀 Next Steps:');
    console.log('1. Prioritize high-priority services used by multiple apps');
    console.log('2. Create TypeScript command files in appropriate pipelines');
    console.log('3. Update pipeline CLI scripts to include new commands');
    console.log('4. Test commands with real data');
    console.log('5. Update command registry with populate-command-registry');
    
  } catch (error) {
    console.error('❌ Error finding pipeline gaps:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('find-pipeline-gaps')
  .description('Find services used in apps but not available via CLI pipelines')
  .option('--min-apps <count>', 'Minimum number of apps using the service', '1')
  .option('--show-commands', 'Show suggested CLI commands for each service')
  .action(findPipelineGaps);

program.parse();