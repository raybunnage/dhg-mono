#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Command } from 'commander';

interface CleanupOptions {
  dryRun?: boolean;
  includeConsolidate?: boolean;
}

class DeadPipelineCleanup {
  private supabase = SupabaseClientService.getInstance().getClient();
  
  // Pipelines with health score 0-20 (dead or nearly dead)
  private deadPipelines = [
    'all_pipelines',
    'dev_tasks', 
    'google_sync',
    'mime_types',
    'refactor_tracking',
    'work_summaries',
    'document_types'
  ];
  
  // Pipelines that could be consolidated (health score 20-40)
  private consolidateCandidates = [
    'drive_filter',
    'prompt_service'
  ];

  async cleanup(options: CleanupOptions) {
    console.log('🧹 Dead Pipeline Cleanup\n');
    
    const pipelinesToClean = [...this.deadPipelines];
    if (options.includeConsolidate) {
      pipelinesToClean.push(...this.consolidateCandidates);
    }
    
    console.log('📦 Pipelines to clean:');
    pipelinesToClean.forEach(p => console.log(`   - ${p}`));
    console.log('');
    
    let totalRemoved = 0;
    let totalFailed = 0;
    
    for (const pipelineName of pipelinesToClean) {
      const result = await this.cleanPipeline(pipelineName, options);
      totalRemoved += result.removed;
      totalFailed += result.failed;
    }
    
    console.log('\n📊 Overall Summary:');
    console.log(`   Total commands removed: ${totalRemoved}`);
    console.log(`   Failed removals: ${totalFailed}`);
    console.log(`   Pipelines cleaned: ${pipelinesToClean.length}`);
    
    if (!options.dryRun && totalRemoved > 0) {
      console.log('\n💡 Next Steps:');
      console.log('1. Consider marking these pipelines as inactive:');
      console.log('   UPDATE command_pipelines SET status = \'inactive\' WHERE name IN (...)');
      console.log('2. Archive the pipeline directories');
      console.log('3. Update documentation to reflect changes');
    }
  }

  private async cleanPipeline(
    pipelineName: string, 
    options: CleanupOptions
  ): Promise<{ removed: number; failed: number }> {
    console.log(`\n🔧 Cleaning pipeline: ${pipelineName}`);
    
    // Get pipeline ID
    const { data: pipeline, error: pipelineError } = await this.supabase
      .from('command_pipelines')
      .select('id')
      .eq('name', pipelineName)
      .single();
    
    if (pipelineError || !pipeline) {
      console.log(`   ❌ Pipeline not found in database`);
      return { removed: 0, failed: 0 };
    }
    
    // Get all commands for this pipeline
    const { data: commands, error: commandsError } = await this.supabase
      .from('command_definitions')
      .select('id, command_name')
      .eq('pipeline_id', pipeline.id);
    
    if (commandsError || !commands) {
      console.log(`   ❌ Error loading commands: ${commandsError?.message}`);
      return { removed: 0, failed: 0 };
    }
    
    console.log(`   Found ${commands.length} commands`);
    
    if (options.dryRun) {
      console.log('   🔵 DRY RUN - Would remove:');
      commands.forEach(cmd => console.log(`      - ${cmd.command_name}`));
      return { removed: commands.length, failed: 0 };
    }
    
    // Remove commands
    let removed = 0;
    let failed = 0;
    
    for (const cmd of commands) {
      const { error } = await this.supabase
        .from('command_definitions')
        .delete()
        .eq('id', cmd.id);
      
      if (error) {
        console.log(`   ❌ Failed to remove ${cmd.command_name}: ${error.message}`);
        failed++;
      } else {
        console.log(`   ✅ Removed ${cmd.command_name}`);
        removed++;
      }
    }
    
    console.log(`   Summary: ${removed} removed, ${failed} failed`);
    
    return { removed, failed };
  }
}

// CLI setup
if (require.main === module) {
  const program = new Command();
  
  program
    .option('--dry-run', 'Show what would be removed without removing')
    .option('--include-consolidate', 'Also clean pipelines marked for consolidation')
    .parse(process.argv);
  
  const options = program.opts() as CleanupOptions;
  
  const cleaner = new DeadPipelineCleanup();
  cleaner.cleanup(options).catch(console.error);
}