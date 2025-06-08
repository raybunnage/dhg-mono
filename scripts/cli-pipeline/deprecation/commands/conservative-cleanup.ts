#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function conservativeCleanup() {
  console.log('🧹 Conservative Command Registry Cleanup');
  console.log('Targeting only definitely dead pipelines\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Only target pipelines that are confirmed dead
  const deadPipelines = ['google_sync', 'merge', 'refactor_tracking', 'work_summaries', 'worktree'];
  
  let totalRemoved = 0;
  
  for (const pipelineName of deadPipelines) {
    console.log(`📦 Cleaning pipeline: ${pipelineName}`);
    
    // Get pipeline ID
    const { data: pipelineData, error: pipelineError } = await supabase
      .from('command_pipelines')
      .select('id')
      .eq('name', pipelineName)
      .single();
      
    if (pipelineError || !pipelineData) {
      console.log(`  ⚠️ Pipeline ${pipelineName} not found in database`);
      continue;
    }
    
    // Get all commands for this pipeline
    const { data: commands, error: commandsError } = await supabase
      .from('command_definitions')
      .select('id, command_name')
      .eq('pipeline_id', pipelineData.id);
      
    if (commandsError) {
      console.error(`  ❌ Error getting commands for ${pipelineName}:`, commandsError.message);
      continue;
    }
    
    if (!commands || commands.length === 0) {
      console.log(`  ℹ️ No commands found for ${pipelineName}`);
      continue;
    }
    
    console.log(`  Found ${commands.length} commands to remove`);
    
    // Remove all commands for this pipeline
    const { error: deleteError } = await supabase
      .from('command_definitions')
      .delete()
      .eq('pipeline_id', pipelineData.id);
      
    if (deleteError) {
      console.error(`  ❌ Error removing commands for ${pipelineName}:`, deleteError.message);
    } else {
      console.log(`  ✅ Removed ${commands.length} commands from ${pipelineName}`);
      totalRemoved += commands.length;
    }
  }
  
  console.log(`\n📊 Total commands removed: ${totalRemoved}`);
  console.log('✅ Conservative cleanup completed');
}

conservativeCleanup().catch(console.error);