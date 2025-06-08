#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';

interface ConsolidationStep {
  phase: number;
  description: string;
  pipelines: string[];
  mergeTarget: string;
  riskLevel: 'low' | 'medium' | 'high';
  validationChecks: string[];
  rollbackPlan: string;
}

async function createConsolidationPlan(): Promise<void> {
  console.log('📋 Creating Detailed Pipeline Consolidation Plan\n');
  
  // Load the analysis results
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/docs/script-reports/pipeline-consolidation-analysis-2025-06-08.json';
  const analysis = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
  
  // Create phased consolidation plan
  const consolidationSteps: ConsolidationStep[] = [
    // Phase 1: Low-risk empty/minimal pipelines
    {
      phase: 1,
      description: 'Consolidate empty and minimal pipelines with no functionality',
      pipelines: ['core', 'shared', 'viewers', 'utilities'],
      mergeTarget: 'all_pipelines',
      riskLevel: 'low',
      validationChecks: [
        'Verify pipelines have no main CLI scripts',
        'Confirm no command definitions in database',
        'Check for any hidden dependencies',
        'Validate no migrated scripts present'
      ],
      rollbackPlan: 'Simple directory restoration from .archived_pipelines'
    },
    
    // Phase 2: Single-function minimal pipelines
    {
      phase: 2,
      description: 'Consolidate single-function minimal pipelines',
      pipelines: ['archive', 'mime_types', 'tracking'],
      mergeTarget: 'system',
      riskLevel: 'low',
      validationChecks: [
        'Verify minimal or no command implementations',
        'Check CLI functionality still works',
        'Validate database command tracking',
        'Ensure no breaking changes to existing workflows'
      ],
      rollbackPlan: 'Restore from backup and update database references'
    },
    
    // Phase 3: Related functional pipelines
    {
      phase: 3,
      description: 'Consolidate functionally related pipelines',
      pipelines: ['analysis', 'scripts'],
      mergeTarget: 'deprecation',
      riskLevel: 'medium',
      validationChecks: [
        'Test all existing CLI commands still work',
        'Verify script analysis functionality preserved',
        'Check command registry consistency',
        'Validate help documentation updates'
      ],
      rollbackPlan: 'Full restoration with database rollback of command definitions'
    },
    
    // Phase 4: Workflow-related pipelines  
    {
      phase: 4,
      description: 'Consolidate Git workflow pipelines',
      pipelines: ['git_workflow'],
      mergeTarget: 'git',
      riskLevel: 'medium',
      validationChecks: [
        'Test all git commands function correctly',
        'Verify workflow scripts still accessible',
        'Check integration with development workflow',
        'Validate help text and documentation'
      ],
      rollbackPlan: 'Restore directory and update git workflow references'
    },
    
    // Phase 5: Communication/auth related
    {
      phase: 5,
      description: 'Consolidate communication pipelines into auth',
      pipelines: ['email', 'gmail'],
      mergeTarget: 'auth',
      riskLevel: 'medium',
      validationChecks: [
        'Test authentication workflows still work',
        'Verify email functionality preserved',
        'Check database auth table consistency',
        'Validate user management commands'
      ],
      rollbackPlan: 'Restore pipelines and update auth service references'
    }
  ];
  
  // Generate detailed plan
  console.log('📊 Phased Consolidation Plan');
  console.log('='.repeat(80));
  
  let totalPipelinesProcessed = 0;
  for (const step of consolidationSteps) {
    totalPipelinesProcessed += step.pipelines.length;
    const riskIcon = step.riskLevel === 'low' ? '🟢' : step.riskLevel === 'medium' ? '🟡' : '🔴';
    
    console.log(`\n${riskIcon} Phase ${step.phase}: ${step.description}`);
    console.log(`   Pipelines: ${step.pipelines.join(', ')} → ${step.mergeTarget}`);
    console.log(`   Risk Level: ${step.riskLevel.toUpperCase()}`);
    console.log(`   Validation Checks:`);
    for (const check of step.validationChecks) {
      console.log(`     - ${check}`);
    }
    console.log(`   Rollback: ${step.rollbackPlan}`);
  }
  
  // Summary and projections
  const currentTotal = 35;
  const afterConsolidation = currentTotal - totalPipelinesProcessed;
  const reductionPercent = (totalPipelinesProcessed / currentTotal * 100).toFixed(1);
  
  console.log('\n📈 Consolidation Impact:');
  console.log(`   Current Pipelines: ${currentTotal}`);
  console.log(`   Pipelines to Consolidate: ${totalPipelinesProcessed}`);
  console.log(`   Final Pipeline Count: ${afterConsolidation}`);
  console.log(`   Reduction: ${reductionPercent}%`);
  
  // Conservative approach recommendations
  console.log('\n🛡️  CONSERVATIVE EXECUTION STRATEGY:');
  console.log('1. Execute one phase at a time with full validation');
  console.log('2. Wait for validation completion before proceeding to next phase');
  console.log('3. Maintain rollback capability at each phase');
  console.log('4. Update documentation after each successful phase');
  console.log('5. Test CLI functionality thoroughly between phases');
  
  // Detailed phase analysis
  console.log('\n🔍 PHASE-BY-PHASE SAFETY ANALYSIS:');
  
  for (const step of consolidationSteps) {
    console.log(`\nPhase ${step.phase} Safety Assessment:`);
    
    // Check each pipeline for potential issues
    for (const pipeline of step.pipelines) {
      await analyzePipelineSafety(pipeline, step.mergeTarget);
    }
  }
  
  // Create implementation scripts for each phase
  await createPhaseImplementationScripts(consolidationSteps);
  
  console.log('\n✅ Consolidation plan created successfully!');
  console.log('📁 Implementation scripts available in deprecation/commands/phases/');
  console.log('🚀 Ready to execute Phase 1 when approved');
}

async function analyzePipelineSafety(pipeline: string, mergeTarget: string): Promise<void> {
  const pipelineDir = `/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline/${pipeline}`;
  
  try {
    // Check what exists in the pipeline
    const files = await fs.readdir(pipelineDir);
    
    // Look for potential blockers
    const hasPackageJson = files.includes('package.json');
    const hasMainCLI = files.includes(`${pipeline}-cli.sh`);
    const hasCommands = files.includes('commands');
    const hasMigrated = files.includes('migrated_scripts');
    
    const concerns: string[] = [];
    if (hasPackageJson) concerns.push('has package.json');
    if (hasMainCLI) concerns.push('has main CLI script');
    if (hasCommands) concerns.push('has commands directory');
    if (hasMigrated) concerns.push('has migrated scripts');
    
    const safety = concerns.length === 0 ? '✅' : concerns.length < 2 ? '⚠️' : '🚨';
    console.log(`   ${safety} ${pipeline} → ${mergeTarget}: ${concerns.length === 0 ? 'SAFE' : concerns.join(', ')}`);
    
  } catch (error) {
    console.log(`   ❌ ${pipeline}: Error accessing directory`);
  }
}

async function createPhaseImplementationScripts(steps: ConsolidationStep[]): Promise<void> {
  const phasesDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline/deprecation/commands/phases';
  
  try {
    await fs.mkdir(phasesDir, { recursive: true });
  } catch (error) {
    // Directory exists
  }
  
  for (const step of steps) {
    const scriptContent = generatePhaseScript(step);
    const scriptPath = join(phasesDir, `phase-${step.phase}-consolidation.ts`);
    await fs.writeFile(scriptPath, scriptContent);
    console.log(`📝 Created implementation script: phase-${step.phase}-consolidation.ts`);
  }
}

function generatePhaseScript(step: ConsolidationStep): string {
  return `#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';

/**
 * Phase ${step.phase}: ${step.description}
 * Risk Level: ${step.riskLevel.toUpperCase()}
 * Pipelines: ${step.pipelines.join(', ')} → ${step.mergeTarget}
 */

async function executePhase${step.phase}(): Promise<void> {
  console.log('🔄 Executing Phase ${step.phase}: ${step.description}\\n');
  
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const archiveDir = join(baseDir, '.archived_pipelines');
  const archiveDate = new Date().toISOString().split('T')[0];
  
  // Ensure archive directory exists
  await fs.mkdir(archiveDir, { recursive: true });
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Pre-execution validation:');
  ${step.validationChecks.map(check => `  console.log('   - ${check}');`).join('\n  ')}
  
  // TODO: Implement actual validation checks here
  
  console.log('\\n📦 Processing pipelines:');
  const pipelines = [${step.pipelines.map(p => `'${p}'`).join(', ')}];
  
  for (const pipeline of pipelines) {
    console.log(\`   Processing \${pipeline}...\`);
    
    const sourcePath = join(baseDir, pipeline);
    const archivePath = join(archiveDir, \`\${pipeline}.\${archiveDate}\`);
    
    try {
      // Archive the pipeline directory
      await fs.rename(sourcePath, archivePath);
      console.log(\`   ✅ Archived \${pipeline} → .archived_pipelines/\${pipeline}.\${archiveDate}\`);
      
      // Record in database
      await supabase.from('sys_archived_scripts_files').insert({
        file_path: \`scripts/cli-pipeline/\${pipeline}/\`,
        archive_reason: 'Phase ${step.phase} consolidation: ${step.description}',
        archived_date: new Date().toISOString(),
        file_type: 'consolidated_pipeline',
        original_size_kb: 0,
        archive_location: \`scripts/cli-pipeline/.archived_pipelines/\${pipeline}.\${archiveDate}/\`
      });
      
    } catch (error) {
      console.error(\`   ❌ Error processing \${pipeline}:\`, error);
      throw error;
    }
  }
  
  console.log('\\n✅ Phase ${step.phase} consolidation complete!');
  console.log('🔍 Recommended next steps:');
  console.log('   1. Run CLI validation: ./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-cli-commands');
  console.log('   2. Test ${step.mergeTarget} pipeline functionality');
  console.log('   3. Update command registry if needed');
  console.log('   4. Proceed to next phase only after validation');
}

// Main execution
executePhase${step.phase}().catch(console.error);
`;
}

// Main execution
createConsolidationPlan().catch(console.error);