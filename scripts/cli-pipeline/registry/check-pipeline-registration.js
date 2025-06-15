#!/usr/bin/env node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function checkPipelineRegistration() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('\n📋 CLI PIPELINE REGISTRATION CHECK');
  console.log('==================================\n');

  // Find all CLI pipeline scripts
  const cliPipelines = execSync('find scripts/cli-pipeline -name "*-cli.sh" -type f | grep -v archived | sort', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  console.log(`Found ${cliPipelines.length} CLI pipeline scripts\n`);

  // Get registered pipelines from database
  const { data: registeredPipelines, error } = await supabase
    .from('sys_cli_pipelines')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching registered pipelines:', error);
    return;
  }

  // Create a map of registered pipelines by script path
  const registeredMap = new Map();
  registeredPipelines?.forEach(p => {
    registeredMap.set(p.script_path, p);
  });

  // Check each pipeline
  const unregistered = [];
  const registered = [];
  const healthCheckStatus = {
    hasHealthCheck: [],
    noHealthCheck: [],
    notRegistered: []
  };

  for (const scriptPath of cliPipelines) {
    const pipelineName = path.basename(path.dirname(scriptPath));
    const registration = registeredMap.get(scriptPath);
    
    if (registration) {
      registered.push({
        name: registration.name,
        displayName: registration.display_name,
        path: scriptPath,
        hasHealthCheck: registration.has_health_check,
        status: registration.status
      });
      
      if (registration.has_health_check) {
        healthCheckStatus.hasHealthCheck.push(registration.name);
      } else {
        healthCheckStatus.noHealthCheck.push(registration.name);
      }
    } else {
      unregistered.push({
        name: pipelineName,
        path: scriptPath
      });
      healthCheckStatus.notRegistered.push(pipelineName);
    }
  }

  // Display results
  console.log('✅ REGISTERED PIPELINES:', registered.length);
  registered.forEach(p => {
    console.log(`   ${p.name} (${p.displayName}) - Health Check: ${p.hasHealthCheck ? '✓' : '✗'} - Status: ${p.status}`);
  });

  if (unregistered.length > 0) {
    console.log('\n❌ UNREGISTERED PIPELINES:', unregistered.length);
    unregistered.forEach(p => {
      console.log(`   ${p.name} - ${p.path}`);
    });
  }

  console.log('\n📊 HEALTH CHECK SUMMARY:');
  console.log(`   Has health check: ${healthCheckStatus.hasHealthCheck.length}`);
  console.log(`   No health check: ${healthCheckStatus.noHealthCheck.length}`);
  console.log(`   Not registered: ${healthCheckStatus.notRegistered.length}`);

  if (healthCheckStatus.noHealthCheck.length > 0) {
    console.log('\n⚠️  PIPELINES WITHOUT HEALTH CHECKS:');
    healthCheckStatus.noHealthCheck.forEach(name => {
      console.log(`   - ${name}`);
    });
  }

  // Check if each pipeline script has a health-check command
  console.log('\n🔍 CHECKING HEALTH CHECK IMPLEMENTATIONS:');
  for (const pipeline of registered) {
    if (pipeline.hasHealthCheck) {
      const scriptContent = fs.readFileSync(pipeline.path, 'utf8');
      const hasHealthCheckCommand = scriptContent.includes('health-check)') || scriptContent.includes('health_check)');
      console.log(`   ${pipeline.name}: ${hasHealthCheckCommand ? '✓ Implemented' : '⚠️  Missing implementation'}`);
    }
  }

  // Check master health check
  console.log('\n🎯 MASTER HEALTH CHECK:');
  const masterScript = 'scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh';
  if (fs.existsSync(masterScript)) {
    const masterContent = fs.readFileSync(masterScript, 'utf8');
    const hasMasterHealthCheck = masterContent.includes('master-health-check');
    console.log(`   all-pipelines: ${hasMasterHealthCheck ? '✓ Has master-health-check command' : '⚠️  Missing master-health-check'}`);
  }
}

checkPipelineRegistration().catch(console.error);