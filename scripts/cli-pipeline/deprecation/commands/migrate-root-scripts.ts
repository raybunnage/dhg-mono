#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join, basename, dirname } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface MigrationPlan {
  sourceFile: string;
  targetPipeline: string;
  filename: string;
  reason: string;
}

async function migrateRootScripts(): Promise<void> {
  console.log('🔄 Migrating Root Scripts to Pipelines\n');
  
  // Load the analysis report to get migration candidates
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/docs/script-reports/root-scripts-analysis-2025-06-08.json';
  const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
  
  // Filter for scripts that should migrate
  const migrationCandidates = report.analyses.filter((a: any) => a.shouldMigrate && a.targetPipeline);
  
  console.log(`📋 Found ${migrationCandidates.length} scripts to migrate\n`);
  
  // Group by target pipeline
  const migrationPlan = new Map<string, MigrationPlan[]>();
  
  for (const candidate of migrationCandidates) {
    const pipeline = candidate.targetPipeline;
    if (!migrationPlan.has(pipeline)) {
      migrationPlan.set(pipeline, []);
    }
    
    migrationPlan.get(pipeline)!.push({
      sourceFile: candidate.path,
      targetPipeline: pipeline,
      filename: candidate.filename,
      reason: candidate.reason
    });
  }
  
  console.log('📦 Migration Plan by Pipeline:');
  for (const [pipeline, scripts] of migrationPlan) {
    console.log(`   ${pipeline}: ${scripts.length} scripts`);
  }
  console.log('');
  
  // Execute migrations
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code';
  const supabase = SupabaseClientService.getInstance().getClient();
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const [targetPipeline, scripts] of migrationPlan) {
    console.log(`📦 Migrating to ${targetPipeline}:`);
    
    // Check if target pipeline exists
    const pipelineDir = join(baseDir, 'scripts', 'cli-pipeline', targetPipeline);
    try {
      await fs.access(pipelineDir);
    } catch (error) {
      console.log(`   ⚠️  Pipeline directory '${targetPipeline}' doesn't exist - skipping`);
      skippedCount += scripts.length;
      continue;
    }
    
    // Create migrated_scripts subdirectory in the pipeline
    const migratedDir = join(pipelineDir, 'migrated_scripts');
    try {
      await fs.mkdir(migratedDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
    
    for (const migration of scripts) {
      try {
        const sourceFullPath = join(baseDir, migration.sourceFile);
        const targetPath = join(migratedDir, migration.filename);
        
        // Check if source exists
        await fs.access(sourceFullPath);
        
        // Check if target already exists
        try {
          await fs.access(targetPath);
          console.log(`   ⚠️  ${migration.filename}: Already exists in ${targetPipeline} - skipping`);
          skippedCount++;
          continue;
        } catch (error) {
          // Target doesn't exist, good to proceed
        }
        
        // Move the file
        await fs.rename(sourceFullPath, targetPath);
        console.log(`   ✅ ${migration.filename} → ${targetPipeline}/migrated_scripts/`);
        
        // Record the migration in database
        await supabase.from('sys_archived_scripts_files').insert({
          file_path: migration.sourceFile,
          archive_reason: `Migrated to ${targetPipeline} pipeline: ${migration.reason}`,
          archived_date: new Date().toISOString(),
          file_type: 'migrated_script',
          original_size_kb: 0, // Will be updated if needed
          archive_location: `scripts/cli-pipeline/${targetPipeline}/migrated_scripts/${migration.filename}`
        });
        
        migratedCount++;
        
      } catch (error) {
        console.log(`   ❌ Error migrating ${migration.filename}:`, (error as Error).message);
        skippedCount++;
      }
    }
    
    console.log('');
  }
  
  console.log('📊 Migration Summary:');
  console.log(`- Total migration candidates: ${migrationCandidates.length}`);
  console.log(`- Successfully migrated: ${migratedCount}`);
  console.log(`- Skipped: ${skippedCount}`);
  console.log('- Location: scripts/cli-pipeline/{pipeline}/migrated_scripts/');
  console.log('- Database records: sys_archived_scripts_files');
  
  if (migratedCount > 0) {
    console.log('\n✨ Script migration complete!');
    console.log('📈 Impact: Organized scripts into appropriate pipeline directories');
    console.log('🔧 Next: Update CLI pipeline commands to include migrated functionality');
  }
  
  // Generate pipeline integration suggestions
  await generateIntegrationSuggestions(migrationPlan);
}

async function generateIntegrationSuggestions(migrationPlan: Map<string, MigrationPlan[]>): Promise<void> {
  console.log('\n🔧 Pipeline Integration Suggestions:');
  console.log('='.repeat(60));
  
  for (const [pipeline, scripts] of migrationPlan) {
    if (scripts.length === 0) continue;
    
    console.log(`\n📦 ${pipeline} Pipeline:`);
    console.log(`   Added ${scripts.length} scripts to migrated_scripts/`);
    console.log('   Suggested actions:');
    console.log(`   1. Review scripts in cli-pipeline/${pipeline}/migrated_scripts/`);
    console.log(`   2. Integrate useful functionality into ${pipeline}-cli.sh`);
    console.log(`   3. Add command definitions to command_definitions table`);
    console.log('   4. Test integrated commands');
    
    // Show some example scripts
    const examples = scripts.slice(0, 3);
    if (examples.length > 0) {
      console.log('   Key scripts to review:');
      for (const script of examples) {
        console.log(`   - ${script.filename}`);
      }
    }
  }
  
  console.log('\n💡 General Integration Guidelines:');
  console.log('- Review each migrated script for current relevance');
  console.log('- Extract reusable functions into shared utilities');
  console.log('- Update CLI help text to include new commands');
  console.log('- Add command tracking for new functionality');
  console.log('- Consider archiving scripts that duplicate existing pipeline features');
}

// Main execution
migrateRootScripts().catch(console.error);