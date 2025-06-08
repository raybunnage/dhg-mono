#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface PipelineAnalysis {
  name: string;
  hasMainCLI: boolean;
  hasCommands: boolean;
  hasMigratedScripts: boolean;
  commandCount: number;
  scriptCount: number;
  lastModified: Date;
  functionality: string[];
  consolidationCategory: 'keep' | 'merge' | 'minimal';
  mergeTarget?: string;
  reason: string;
}

async function analyzeConsolidationOpportunities(): Promise<void> {
  console.log('🔍 Analyzing Pipeline Consolidation Opportunities\n');
  
  const pipelineDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const analyses: PipelineAnalysis[] = [];
  
  // Get all pipeline directories
  const entries = await fs.readdir(pipelineDir, { withFileTypes: true });
  const pipelines = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort();
  
  console.log(`📊 Found ${pipelines.length} pipelines to analyze\n`);
  
  // Analyze each pipeline
  for (const pipeline of pipelines) {
    const analysis = await analyzePipeline(pipeline, pipelineDir);
    analyses.push(analysis);
  }
  
  // Generate consolidation recommendations
  await generateConsolidationPlan(analyses);
}

async function analyzePipeline(name: string, baseDir: string): Promise<PipelineAnalysis> {
  const pipelinePath = join(baseDir, name);
  
  // Check for main CLI script
  const mainCLIPath = join(pipelinePath, `${name}-cli.sh`);
  let hasMainCLI = false;
  try {
    await fs.access(mainCLIPath);
    hasMainCLI = true;
  } catch (error) {
    // No main CLI
  }
  
  // Check for command scripts and count them
  let hasCommands = false;
  let commandCount = 0;
  const commandsPath = join(pipelinePath, 'commands');
  try {
    const commandFiles = await fs.readdir(commandsPath);
    commandCount = commandFiles.filter(f => f.endsWith('.ts') || f.endsWith('.js')).length;
    hasCommands = commandCount > 0;
  } catch (error) {
    // No commands directory
  }
  
  // Check for migrated scripts
  let hasMigratedScripts = false;
  let scriptCount = 0;
  const migratedPath = join(pipelinePath, 'migrated_scripts');
  try {
    const migratedFiles = await fs.readdir(migratedPath);
    scriptCount = migratedFiles.length;
    hasMigratedScripts = scriptCount > 0;
  } catch (error) {
    // No migrated scripts
  }
  
  // Get last modified time
  const stats = await fs.stat(pipelinePath);
  const lastModified = stats.mtime;
  
  // Determine functionality and categorization
  const functionality = determineFunctionality(name, hasMainCLI, hasCommands, hasMigratedScripts);
  const { category, mergeTarget, reason } = determineConsolidationStrategy(
    name, hasMainCLI, hasCommands, hasMigratedScripts, commandCount, scriptCount
  );
  
  return {
    name,
    hasMainCLI,
    hasCommands,
    hasMigratedScripts,
    commandCount,
    scriptCount,
    lastModified,
    functionality,
    consolidationCategory: category,
    mergeTarget,
    reason
  };
}

function determineFunctionality(name: string, hasMainCLI: boolean, hasCommands: boolean, hasMigratedScripts: boolean): string[] {
  const functionality: string[] = [];
  
  // Core functionality based on name
  if (name.includes('database') || name.includes('db')) functionality.push('database-operations');
  if (name.includes('media') || name.includes('audio') || name.includes('video')) functionality.push('media-processing');
  if (name.includes('google') || name.includes('drive')) functionality.push('google-integration');
  if (name.includes('auth')) functionality.push('authentication');
  if (name.includes('doc')) functionality.push('document-management');
  if (name.includes('prompt') || name.includes('ai')) functionality.push('ai-services');
  if (name.includes('git')) functionality.push('git-operations');
  if (name.includes('system') || name.includes('util')) functionality.push('system-utilities');
  
  // Implementation status
  if (hasMainCLI) functionality.push('has-cli');
  if (hasCommands) functionality.push('has-commands');
  if (hasMigratedScripts) functionality.push('enhanced-functionality');
  
  return functionality;
}

function determineConsolidationStrategy(
  name: string, 
  hasMainCLI: boolean, 
  hasCommands: boolean, 
  hasMigratedScripts: boolean,
  commandCount: number,
  scriptCount: number
): { category: 'keep' | 'merge' | 'minimal', mergeTarget?: string, reason: string } {
  
  // Core pipelines to definitely keep
  const corePipelines = [
    'database', 'media-processing', 'presentations', 'auth', 'classify', 
    'experts', 'prompt_service', 'all_pipelines'
  ];
  
  if (corePipelines.includes(name)) {
    return {
      category: 'keep',
      reason: 'Core pipeline with established functionality'
    };
  }
  
  // Enhanced pipelines (from Phase 3) should be kept
  if (hasMigratedScripts && scriptCount > 5) {
    return {
      category: 'keep', 
      reason: `Enhanced pipeline with ${scriptCount} migrated scripts`
    };
  }
  
  // Pipelines with substantial command implementations
  if (hasMainCLI && hasCommands && commandCount > 10) {
    return {
      category: 'keep',
      reason: `Substantial implementation with ${commandCount} commands`
    };
  }
  
  // Minimal pipelines that could be merged
  if (!hasMainCLI && !hasCommands && !hasMigratedScripts) {
    return {
      category: 'merge',
      mergeTarget: suggestMergeTarget(name),
      reason: 'Minimal pipeline with no significant functionality'
    };
  }
  
  // Pipelines with CLI but few commands (potential merge candidates)
  if (hasMainCLI && commandCount < 3 && !hasMigratedScripts) {
    return {
      category: 'merge',
      mergeTarget: suggestMergeTarget(name),
      reason: `Limited functionality - only ${commandCount} commands`
    };
  }
  
  // Everything else should be evaluated
  return {
    category: 'minimal',
    reason: 'Requires detailed evaluation for consolidation'
  };
}

function suggestMergeTarget(pipelineName: string): string {
  // Suggest logical merge targets based on functionality
  if (pipelineName.includes('git')) return 'git';
  if (pipelineName.includes('doc')) return 'document_types';
  if (pipelineName.includes('track') || pipelineName.includes('monitor')) return 'all_pipelines';
  if (pipelineName.includes('util') || pipelineName.includes('system')) return 'system';
  if (pipelineName.includes('script') || pipelineName.includes('analysis')) return 'deprecation';
  if (pipelineName.includes('archive') || pipelineName.includes('backup')) return 'system';
  if (pipelineName.includes('email') || pipelineName.includes('gmail')) return 'auth';
  if (pipelineName.includes('service') || pipelineName.includes('registry')) return 'all_pipelines';
  
  return 'all_pipelines'; // Default merge target
}

async function generateConsolidationPlan(analyses: PipelineAnalysis[]): Promise<void> {
  console.log('📈 Pipeline Consolidation Analysis');
  console.log('='.repeat(100));
  
  // Summary statistics
  const totalPipelines = analyses.length;
  const keepPipelines = analyses.filter(a => a.consolidationCategory === 'keep').length;
  const mergePipelines = analyses.filter(a => a.consolidationCategory === 'merge').length;
  const minimalPipelines = analyses.filter(a => a.consolidationCategory === 'minimal').length;
  
  console.log(`📊 Summary:`);
  console.log(`   Total Pipelines: ${totalPipelines}`);
  console.log(`   Keep: ${keepPipelines}`);
  console.log(`   Merge Candidates: ${mergePipelines}`);
  console.log(`   Require Evaluation: ${minimalPipelines}`);
  
  // Detailed analysis by category
  console.log('\n🏆 KEEP - Core/Enhanced Pipelines:');
  const keepList = analyses.filter(a => a.consolidationCategory === 'keep');
  for (const pipeline of keepList) {
    const enhanced = pipeline.hasMigratedScripts ? ` (+${pipeline.scriptCount} scripts)` : '';
    const commands = pipeline.hasCommands ? ` (${pipeline.commandCount} commands)` : '';
    console.log(`   ✅ ${pipeline.name}${enhanced}${commands} - ${pipeline.reason}`);
  }
  
  console.log('\n🔄 MERGE - Consolidation Candidates:');
  const mergeList = analyses.filter(a => a.consolidationCategory === 'merge');
  for (const pipeline of mergeList) {
    console.log(`   → ${pipeline.name} → ${pipeline.mergeTarget} - ${pipeline.reason}`);
  }
  
  console.log('\n❓ EVALUATE - Require Detailed Review:');
  const minimalList = analyses.filter(a => a.consolidationCategory === 'minimal');
  for (const pipeline of minimalList) {
    const cli = pipeline.hasMainCLI ? '📋' : '❌';
    const cmds = pipeline.commandCount > 0 ? `📝${pipeline.commandCount}` : '❌';
    const scripts = pipeline.scriptCount > 0 ? `📄${pipeline.scriptCount}` : '❌';
    console.log(`   ${cli}${cmds}${scripts} ${pipeline.name} - ${pipeline.reason}`);
  }
  
  // Consolidation targets analysis
  console.log('\n🎯 Proposed Merge Targets:');
  const mergeTargets = new Map<string, string[]>();
  for (const pipeline of mergeList) {
    const target = pipeline.mergeTarget || 'unknown';
    if (!mergeTargets.has(target)) {
      mergeTargets.set(target, []);
    }
    mergeTargets.get(target)!.push(pipeline.name);
  }
  
  for (const [target, sources] of mergeTargets) {
    console.log(`   ${target}: ${sources.join(', ')}`);
  }
  
  // Projected results
  const projectedTotal = keepList.length + mergeTargets.size + minimalList.length;
  const reductionPercent = ((totalPipelines - projectedTotal) / totalPipelines * 100).toFixed(1);
  
  console.log('\n📊 Projected Results:');
  console.log(`   Current Pipelines: ${totalPipelines}`);
  console.log(`   After Consolidation: ${projectedTotal}`);
  console.log(`   Reduction: ${totalPipelines - projectedTotal} pipelines (${reductionPercent}%)`);
  
  // Save detailed analysis
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/docs/script-reports/pipeline-consolidation-analysis-2025-06-08.json';
  await fs.writeFile(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_pipelines: totalPipelines,
    analysis_summary: {
      keep: keepPipelines,
      merge: mergePipelines,
      minimal: minimalPipelines
    },
    projected_reduction: {
      current: totalPipelines,
      after: projectedTotal,
      reduction_count: totalPipelines - projectedTotal,
      reduction_percentage: parseFloat(reductionPercent)
    },
    pipelines: analyses.map(a => ({
      name: a.name,
      category: a.consolidationCategory,
      merge_target: a.mergeTarget,
      reason: a.reason,
      has_main_cli: a.hasMainCLI,
      command_count: a.commandCount,
      script_count: a.scriptCount,
      functionality: a.functionality
    }))
  }, null, 2));
  
  console.log(`\n💾 Detailed analysis saved to: ${reportPath}`);
  
  console.log('\n🚨 SAFETY RECOMMENDATIONS:');
  console.log('1. Validate each merge candidate manually before consolidation');
  console.log('2. Use conservative approach - start with obvious minimal pipelines');
  console.log('3. Maintain complete audit trail for all consolidation operations');
  console.log('4. Test CLI functionality after each consolidation step');
  console.log('5. Keep backup/rollback capability for all changes');
}

// Main execution
analyzeConsolidationOpportunities().catch(console.error);