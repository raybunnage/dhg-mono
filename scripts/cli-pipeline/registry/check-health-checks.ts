import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

const supabase = SupabaseClientService.getInstance().getClient();

async function checkHealthChecks() {
  console.log('\n🏥 CLI PIPELINE HEALTH CHECK AUDIT');
  console.log('===================================\n');

  // Get all registered pipelines
  const { data: pipelines, error } = await supabase
    .from('sys_cli_pipelines')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) {
    console.error('Error fetching pipelines:', error);
    return;
  }

  const healthCheckStatus = {
    hasHealthCheck: [] as string[],
    noHealthCheck: [] as string[],
    hasImplementation: [] as string[],
    missingImplementation: [] as string[]
  };

  console.log('📋 Checking ${pipelines?.length || 0} active pipelines:\n');

  for (const pipeline of pipelines || []) {
    const scriptPath = pipeline.script_path;
    
    // Check if marked as having health check
    if (pipeline.has_health_check) {
      healthCheckStatus.hasHealthCheck.push(pipeline.name);
    } else {
      healthCheckStatus.noHealthCheck.push(pipeline.name);
    }

    // Check actual implementation
    if (scriptPath && fs.existsSync(scriptPath)) {
      const content = fs.readFileSync(scriptPath, 'utf8');
      const hasHealthCheckCommand = 
        content.includes('health-check)') || 
        content.includes('health_check)') ||
        content.includes('health-check"') ||
        content.includes('health_check"');
      
      if (hasHealthCheckCommand) {
        healthCheckStatus.hasImplementation.push(pipeline.name);
        console.log(`✅ ${pipeline.name}: Has health check implementation`);
      } else if (pipeline.has_health_check) {
        healthCheckStatus.missingImplementation.push(pipeline.name);
        console.log(`⚠️  ${pipeline.name}: Marked as having health check but no implementation found`);
      } else {
        console.log(`❌ ${pipeline.name}: No health check`);
      }
    } else {
      console.log(`⚠️  ${pipeline.name}: Script file not found at ${scriptPath}`);
    }
  }

  console.log('\n📊 SUMMARY:');
  console.log(`   Total pipelines: ${pipelines?.length || 0}`);
  console.log(`   Has health check (DB): ${healthCheckStatus.hasHealthCheck.length}`);
  console.log(`   No health check (DB): ${healthCheckStatus.noHealthCheck.length}`);
  console.log(`   Has implementation: ${healthCheckStatus.hasImplementation.length}`);
  console.log(`   Missing implementation: ${healthCheckStatus.missingImplementation.length}`);

  if (healthCheckStatus.noHealthCheck.length > 0) {
    console.log('\n❌ PIPELINES WITHOUT HEALTH CHECKS:');
    healthCheckStatus.noHealthCheck.forEach(name => {
      console.log(`   - ${name}`);
    });
  }

  // Check master health check
  console.log('\n🎯 CHECKING MASTER HEALTH CHECK:');
  const masterPath = 'scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh';
  if (fs.existsSync(masterPath)) {
    const content = fs.readFileSync(masterPath, 'utf8');
    const hasMasterHealthCheck = content.includes('master-health-check');
    console.log(`   all_pipelines: ${hasMasterHealthCheck ? '✅ Has master-health-check command' : '❌ Missing master-health-check command'}`);
    
    // Check if it calls individual health checks
    const callsIndividualChecks = content.includes('health-check') && content.includes('for pipeline in');
    console.log(`   Calls individual checks: ${callsIndividualChecks ? '✅ Yes' : '❌ No'}`);
  }

  // Generate SQL to update has_health_check flags
  console.log('\n📝 SQL TO UPDATE HEALTH CHECK FLAGS:');
  for (const name of healthCheckStatus.hasImplementation) {
    if (!healthCheckStatus.hasHealthCheck.includes(name)) {
      console.log(`UPDATE sys_cli_pipelines SET has_health_check = true WHERE name = '${name}';`);
    }
  }
}

checkHealthChecks().catch(console.error);