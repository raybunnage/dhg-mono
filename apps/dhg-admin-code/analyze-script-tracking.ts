import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function analyzeScriptTracking() {
  console.log('=== Script Tracking Analysis ===\n');

  // 1. Check sys_archived_cli_pipeline_files table
  console.log('1. Checking sys_archived_cli_pipeline_files table...');
  const { data: archivedFiles, error: archiveError } = await supabase
    .from('sys_archived_cli_pipeline_files')
    .select('*')
    .limit(10);
  
  if (archiveError) {
    console.log('Error querying sys_archived_cli_pipeline_files:', archiveError.message);
  } else {
    console.log(`Found ${archivedFiles?.length || 0} archived files`);
    if (archivedFiles && archivedFiles.length > 0) {
      console.log('Sample archived files:', archivedFiles.slice(0, 3));
    }
  }

  // 2. Check command_pipelines table
  console.log('\n2. Checking command_pipelines table...');
  const { data: pipelines, error: pipelineError } = await supabase
    .from('command_pipelines')
    .select('*')
    .eq('status', 'active')
    .order('name');
  
  if (pipelineError) {
    console.log('Error querying command_pipelines:', pipelineError.message);
  } else {
    console.log(`Found ${pipelines?.length || 0} active pipelines`);
    pipelines?.forEach(p => {
      console.log(`- ${p.name}: ${p.display_name} (health_check_enabled: ${p.health_check_enabled})`);
    });
  }

  // 3. Check command_tracking for recent usage
  console.log('\n3. Checking recent command usage (last 7 days)...');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentCommands, error: trackingError } = await supabase
    .from('command_tracking')
    .select('command_name, pipeline_name')
    .gte('executed_at', sevenDaysAgo.toISOString())
    .order('executed_at', { ascending: false })
    .limit(20);
  
  if (trackingError) {
    console.log('Error querying command_tracking:', trackingError.message);
  } else {
    console.log(`Found ${recentCommands?.length || 0} recently executed commands`);
    recentCommands?.slice(0, 10).forEach(cmd => {
      console.log(`- ${cmd.pipeline_name}/${cmd.command_name}`);
    });
  }

  // Get aggregated command usage
  console.log('\n4. Getting command usage statistics...');
  const { data: commandStats, error: statsError } = await supabase
    .rpc('get_command_usage_stats', { days: 30 });
  
  if (statsError) {
    console.log('Error getting command stats:', statsError.message);
  } else if (commandStats) {
    console.log('Top 10 most used commands (last 30 days):');
    commandStats.slice(0, 10).forEach((stat: any) => {
      console.log(`- ${stat.pipeline_name}/${stat.command_name}: ${stat.usage_count} uses`);
    });
  }

  // 5. Check registry_cli_pipelines
  console.log('\n5. Checking registry_cli_pipelines table...');
  const { data: registryPipelines, error: registryError } = await supabase
    .from('registry_cli_pipelines')
    .select('*')
    .order('name');
  
  if (registryError) {
    console.log('Error querying registry_cli_pipelines:', registryError.message);
  } else {
    console.log(`Found ${registryPipelines?.length || 0} registered pipelines`);
    registryPipelines?.forEach(p => {
      console.log(`- ${p.name}: ${p.description} (status: ${p.status})`);
    });
  }

  // Check for unused commands (commands with no recent usage)
  console.log('\n6. Checking for potentially unused commands...');
  const { data: allCommands, error: allCmdError } = await supabase
    .from('command_definitions')
    .select('pipeline_id, command_name, status')
    .eq('status', 'active');
  
  if (!allCmdError && commandStats && allCommands) {
    const usedCommands = new Set(commandStats.map((s: any) => `${s.pipeline_name}/${s.command_name}`));
    const unusedCommands = allCommands.filter(cmd => {
      const pipeline = pipelines?.find(p => p.id === cmd.pipeline_id);
      const fullName = `${pipeline?.name}/${cmd.command_name}`;
      return !usedCommands.has(fullName);
    });
    
    console.log(`Found ${unusedCommands.length} commands with no usage in last 30 days`);
    if (unusedCommands.length > 0) {
      console.log('Sample unused commands:');
      unusedCommands.slice(0, 10).forEach(cmd => {
        const pipeline = pipelines?.find(p => p.id === cmd.pipeline_id);
        console.log(`- ${pipeline?.name}/${cmd.command_name}`);
      });
    }
  }
}

analyzeScriptTracking().catch(console.error);