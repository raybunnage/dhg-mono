import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { execSync } from 'child_process';

const supabase = SupabaseClientService.getInstance().getClient();

async function updateHealthCheckFlags() {
  console.log('\n🔧 UPDATING HEALTH CHECK FLAGS IN DATABASE');
  console.log('==========================================\n');

  // Get all pipelines from master health check script
  const masterHealthCheckPath = 'scripts/cli-pipeline/all_pipelines/run-all-health-checks.sh';
  const scriptContent = execSync(`cat ${masterHealthCheckPath}`, { encoding: 'utf8' });
  
  // Extract pipeline names from run_health_check calls
  const healthCheckCalls = scriptContent.match(/run_health_check\s+"([^"]+)"/g) || [];
  const pipelinesInMasterCheck = healthCheckCalls.map(call => {
    const match = call.match(/run_health_check\s+"([^"]+)"/);
    return match ? match[1] : null;
  }).filter(Boolean);

  console.log(`Found ${pipelinesInMasterCheck.length} pipelines in master health check\n`);

  // Update has_health_check flag for all pipelines in master check
  for (const pipelineName of pipelinesInMasterCheck) {
    const { error } = await supabase
      .from('registry_cli_pipelines')
      .update({ has_health_check: true })
      .eq('name', pipelineName);

    if (error) {
      console.error(`❌ Error updating ${pipelineName}:`, error.message);
    } else {
      console.log(`✅ Updated ${pipelineName}: has_health_check = true`);
    }
  }

  // Also check for pipelines with health-check commands in their CLI files
  console.log('\n🔍 Checking for additional pipelines with health-check commands...\n');
  
  const { data: allPipelines } = await supabase
    .from('registry_cli_pipelines')
    .select('name, script_path, has_health_check')
    .order('name');

  for (const pipeline of allPipelines || []) {
    if (pipeline.script_path && !pipelinesInMasterCheck.includes(pipeline.name)) {
      try {
        const content = execSync(`cat ${pipeline.script_path} 2>/dev/null || echo ""`, { encoding: 'utf8' });
        if (content.includes('health-check)') || content.includes('health_check)')) {
          if (!pipeline.has_health_check) {
            const { error } = await supabase
              .from('registry_cli_pipelines')
              .update({ has_health_check: true })
              .eq('name', pipeline.name);

            if (!error) {
              console.log(`✅ Found and updated ${pipeline.name}: has_health_check = true`);
            }
          }
        }
      } catch (e) {
        // Script file not found, skip
      }
    }
  }

  // Summary
  const { data: summary } = await supabase
    .from('registry_cli_pipelines')
    .select('has_health_check');
    
  const withHealthCheck = summary?.filter(p => p.has_health_check).length || 0;
  const total = summary?.length || 0;
  
  console.log('\n📊 SUMMARY:');
  console.log(`   Total pipelines: ${total}`);
  console.log(`   With health checks: ${withHealthCheck}`);
  console.log(`   Without health checks: ${total - withHealthCheck}`);
}

updateHealthCheckFlags().catch(console.error);