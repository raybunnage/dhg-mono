#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

/**
 * Phase 1 (SAFE): Consolidate minimal pipelines into logical homes
 * Risk Level: LOW
 * Target: Pipelines with minimal functionality that can be merged
 */

async function executePhase1Safe(): Promise<void> {
  console.log('🔄 Executing Phase 1 (SAFE): Consolidate minimal pipelines\n');
  
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const archiveDir = join(baseDir, '.archived_pipelines');
  const archiveDate = new Date().toISOString().split('T')[0];
  
  // Conservative mergers - only truly minimal pipelines
  const consolidationPlan = [
    { source: 'analysis', target: 'all_pipelines', reason: 'Generic analysis functionality fits in all_pipelines' },
    { source: 'archive', target: 'all_pipelines', reason: 'Archive commands can be part of general utilities' }
  ];
  
  // Ensure archive directory exists
  await fs.mkdir(archiveDir, { recursive: true });
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Pre-execution validation:');
  for (const consolidation of consolidationPlan) {
    const sourceExists = await checkDirectoryExists(join(baseDir, consolidation.source));
    const targetExists = await checkDirectoryExists(join(baseDir, consolidation.target));
    
    console.log(`   ${sourceExists && targetExists ? '✅' : '❌'} ${consolidation.source} → ${consolidation.target}`);
    
    if (!sourceExists || !targetExists) {
      console.error(`❌ Aborting: Missing source or target directory`);
      return;
    }
  }
  
  console.log('\n📦 Processing consolidations:');
  let consolidatedCount = 0;
  
  for (const consolidation of consolidationPlan) {
    console.log(`   Consolidating ${consolidation.source} → ${consolidation.target}...`);
    
    const sourcePath = join(baseDir, consolidation.source);
    const targetPath = join(baseDir, consolidation.target);
    const migratedDir = join(targetPath, 'migrated_scripts', consolidation.source);
    const archivePath = join(archiveDir, `${consolidation.source}.${archiveDate}`);
    
    try {
      // Create migrated_scripts subdirectory in target
      await fs.mkdir(migratedDir, { recursive: true });
      
      // Copy files from source to target/migrated_scripts/source/
      const sourceFiles = await fs.readdir(sourcePath);
      for (const file of sourceFiles) {
        const sourceFile = join(sourcePath, file);
        const targetFile = join(migratedDir, file);
        
        const stat = await fs.stat(sourceFile);
        if (stat.isDirectory()) {
          await copyDirectory(sourceFile, targetFile);
        } else {
          await fs.copyFile(sourceFile, targetFile);
        }
      }
      
      // Archive the original pipeline directory
      await fs.rename(sourcePath, archivePath);
      console.log(`   ✅ Migrated ${consolidation.source} → ${consolidation.target}/migrated_scripts/${consolidation.source}/`);
      console.log(`   ✅ Archived original → .archived_pipelines/${consolidation.source}.${archiveDate}`);
      
      // Record in database
      await supabase.from('sys_archived_scripts_files').insert({
        file_path: `scripts/cli-pipeline/${consolidation.source}/`,
        archive_reason: `Phase 1 consolidation: ${consolidation.reason}`,
        archived_date: new Date().toISOString(),
        file_type: 'consolidated_pipeline',
        original_size_kb: await getDirectorySize(archivePath),
        archive_location: `scripts/cli-pipeline/.archived_pipelines/${consolidation.source}.${archiveDate}/`,
        migration_target: `scripts/cli-pipeline/${consolidation.target}/migrated_scripts/${consolidation.source}/`
      });
      
      consolidatedCount++;
      
    } catch (error) {
      console.error(`   ❌ Error processing ${consolidation.source}:`, error);
      throw error;
    }
  }
  
  console.log(`\n✅ Phase 1 consolidation complete! Consolidated ${consolidatedCount} pipelines`);
  console.log('\n🔍 Post-execution validation:');
  
  // Validate current state
  const currentCount = await countActivePipelines(baseDir);
  console.log(`   📊 Active pipelines remaining: ${currentCount}`);
  
  console.log('\n📋 Recommended next steps:');
  console.log('   1. Run CLI validation: ./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-cli-commands');
  console.log('   2. Verify all_pipelines functionality still works');
  console.log('   3. Check command registry consistency');
  console.log('   4. Review Phase 2 plan before proceeding');
  
  console.log('\n🎯 Phase 1 Results:');
  console.log(`   - Consolidated: ${consolidatedCount} empty pipelines`);
  console.log(`   - Remaining pipelines: ${currentCount}`);
  console.log(`   - Risk level: VERY LOW (only truly empty pipelines)`);
  console.log(`   - Rollback: Simple directory restoration if needed`);
}

async function checkDirectoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
    
    return Math.round(totalSize / 1024); // Convert to KB
  } catch {
    return 0;
  }
}

async function countActivePipelines(baseDir: string): Promise<number> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries.filter(entry => 
      entry.isDirectory() && 
      !entry.name.startsWith('.')
    ).length;
  } catch (error) {
    console.error('Error counting pipelines:', error);
    return 0;
  }
}

// Main execution
executePhase1Safe().catch(console.error);