#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const ARCHIVED_PIPELINES = ['documentation', 'examples', 'merge', 'worktree'];

async function cleanupArchivedPipelineCommands(): Promise<void> {
  console.log('🧹 Cleaning up database commands for archived pipelines\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  for (const pipelineName of ARCHIVED_PIPELINES) {
    console.log(`📦 Processing pipeline: ${pipelineName}`);
    
    // Find the pipeline ID
    const { data: pipeline, error: pipelineError } = await supabase
      .from('command_pipelines')
      .select('id, name, display_name')
      .eq('name', pipelineName)
      .single();
    
    if (pipelineError || !pipeline) {
      console.log(`   ⚠️  Pipeline '${pipelineName}' not found in database`);
      continue;
    }
    
    // Count commands for this pipeline
    const { data: commands, error: commandsError } = await supabase
      .from('command_definitions')
      .select('id, command_name')
      .eq('pipeline_id', pipeline.id);
    
    if (commandsError) {
      console.error(`   ❌ Error fetching commands for ${pipelineName}:`, commandsError);
      continue;
    }
    
    if (!commands || commands.length === 0) {
      console.log(`   ✅ No commands to clean up for ${pipelineName}`);
    } else {
      console.log(`   🗑️  Removing ${commands.length} commands:`);
      for (const cmd of commands) {
        console.log(`      - ${cmd.command_name}`);
      }
      
      // Delete commands for this pipeline
      const { error: deleteError } = await supabase
        .from('command_definitions')
        .delete()
        .eq('pipeline_id', pipeline.id);
      
      if (deleteError) {
        console.error(`   ❌ Error deleting commands for ${pipelineName}:`, deleteError);
        continue;
      }
      
      console.log(`   ✅ Deleted ${commands.length} commands`);
    }
    
    // Update pipeline status to deprecated
    const { error: updateError } = await supabase
      .from('command_pipelines')
      .update({ 
        status: 'deprecated',
        updated_at: new Date().toISOString()
      })
      .eq('id', pipeline.id);
    
    if (updateError) {
      console.error(`   ❌ Error updating pipeline status:`, updateError);
    } else {
      console.log(`   ✅ Marked pipeline as deprecated`);
    }
  }
  
  console.log('\n📊 Cleanup Summary:');
  console.log('- Processed 4 archived pipelines');
  console.log('- Removed associated command definitions');
  console.log('- Updated pipeline status to "deprecated"');
  console.log('\n✨ Database cleanup complete!');
}

// Main execution
cleanupArchivedPipelineCommands().catch(console.error);