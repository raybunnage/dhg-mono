#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function verifyAnalysisCoverage() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Verifying Analysis Coverage');
  console.log('==============================\n');
  
  // 1. Check what sources we've analyzed
  console.log('📊 What dependency sources have we analyzed?');
  console.log('-------------------------------------------');
  
  const { data: sources } = await supabase
    .from('service_dependencies')
    .select('dependent_type, dependent_name')
    .order('dependent_type, dependent_name');
  
  const sourceTypes = new Map<string, Set<string>>();
  sources?.forEach((s: any) => {
    if (!sourceTypes.has(s.dependent_type)) {
      sourceTypes.set(s.dependent_type, new Set());
    }
    sourceTypes.get(s.dependent_type)!.add(s.dependent_name);
  });
  
  sourceTypes.forEach((names, type) => {
    console.log(`\n${type.toUpperCase()} (${names.size} analyzed):`);
    Array.from(names).sort().forEach(name => console.log(`  - ${name}`));
  });
  
  // 2. Check what we have in registry
  console.log('\n\n📋 What do we have in our registry?');
  console.log('-----------------------------------');
  
  const { count: appCount } = await supabase
    .from('registry_apps')
    .select('*', { count: 'exact', head: true });
    
  const { count: pipelineCount } = await supabase
    .from('sys_cli_pipelines')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total apps in registry: ${appCount}`);
  console.log(`Total pipelines in registry: ${pipelineCount}`);
  
  // 3. Check if all pipelines were analyzed
  const { data: allPipelines } = await supabase
    .from('sys_cli_pipelines')
    .select('pipeline_name')
    .order('pipeline_name');
    
  const analyzedPipelines = sourceTypes.get('pipeline') || new Set();
  const unanalyzedPipelines: string[] = [];
  
  allPipelines?.forEach((p: any) => {
    if (!analyzedPipelines.has(p.pipeline_name)) {
      unanalyzedPipelines.push(p.pipeline_name);
    }
  });
  
  if (unanalyzedPipelines.length > 0) {
    console.log('\n⚠️  PIPELINES NOT ANALYZED:');
    unanalyzedPipelines.forEach(p => console.log(`  - ${p}`));
  }
  
  // 4. Check analysis runs
  console.log('\n\n📈 Analysis Run History:');
  console.log('-----------------------');
  
  const { data: runs } = await supabase
    .from('service_dependency_analysis_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  runs?.forEach((run: any) => {
    console.log(`\n${run.run_type} - ${run.target_type}`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Dependencies found: ${run.dependencies_found || 'N/A'}`);
    console.log(`  Created: ${new Date(run.created_at).toLocaleString()}`);
  });
  
  // 5. Things we definitely didn't check
  console.log('\n\n⚠️  POTENTIAL GAPS IN ANALYSIS:');
  console.log('--------------------------------');
  console.log('1. Build scripts (webpack, vite configs, etc.)');
  console.log('2. Test files (*.test.ts, *.spec.ts)');
  console.log('3. Configuration files (*.config.js)');
  console.log('4. Dynamic imports using string concatenation');
  console.log('5. Scripts in package.json files');
  console.log('6. Shell scripts that might use ts-node');
  console.log('7. GitHub Actions workflows');
  console.log('8. Dockerfile or deployment scripts');
  
  // 6. Sample check for the 9 remaining services
  console.log('\n\n🎯 Quick check on the 9 remaining services:');
  console.log('------------------------------------------');
  
  const remainingServices = [
    'audio', 'document-pipeline', 'document-type-ai', 
    'google-auth', 'google-drive-sync', 'media-tracking',
    'prompt-management', 'report', 'script-pipeline'
  ];
  
  for (const serviceName of remainingServices.slice(0, 3)) {
    const { data: history } = await supabase
      .from('command_tracking')
      .select('command_name, pipeline_name, execution_time')
      .or(`command_name.ilike.%${serviceName}%,pipeline_name.ilike.%${serviceName}%`)
      .order('execution_time', { ascending: false })
      .limit(3);
      
    if (history && history.length > 0) {
      console.log(`\n${serviceName}: Found in command history!`);
      history.forEach((h: any) => {
        console.log(`  - ${h.pipeline_name}/${h.command_name} at ${new Date(h.execution_time).toLocaleDateString()}`);
      });
    }
  }
}

verifyAnalysisCoverage().catch(console.error);