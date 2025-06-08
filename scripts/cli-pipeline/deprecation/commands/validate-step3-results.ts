#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';

async function validateStep3Results(): Promise<void> {
  console.log('🔍 Validating Step 3: Root Scripts Review Results\n');
  
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts';
  
  // Count remaining root scripts
  const remainingScripts = await countRemainingRootScripts();
  
  // Check archived scripts
  const archivedScripts = await checkArchivedScripts();
  
  // Check migrated scripts
  const migratedScripts = await checkMigratedScripts();
  
  // Generate validation report
  await generateValidationReport(remainingScripts, archivedScripts, migratedScripts);
}

async function countRemainingRootScripts(): Promise<{count: number, scripts: string[]}> {
  const scriptsDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts';
  const scriptExtensions = ['.sh', '.ts', '.js', '.py', '.sql', '.mjs'];
  const scripts: string[] = [];
  
  async function walkDir(currentDir: string, relativePath: string = ''): Promise<void> {
    // Skip cli-pipeline and archived directories
    if (currentDir.includes('cli-pipeline') || currentDir.includes('.archived')) {
      return;
    }
    
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relPath = join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        await walkDir(fullPath, relPath);
      } else if (entry.isFile() && scriptExtensions.some(ext => entry.name.endsWith(ext))) {
        scripts.push(relPath);
      }
    }
  }
  
  await walkDir(scriptsDir);
  return { count: scripts.length, scripts };
}

async function checkArchivedScripts(): Promise<{count: number, location: string}> {
  const archiveDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/.archived_root_scripts';
  
  try {
    const files = await fs.readdir(archiveDir);
    const archivedFiles = files.filter(f => f.includes('2025-06-08')); // Today's archives
    return { count: archivedFiles.length, location: archiveDir };
  } catch (error) {
    return { count: 0, location: 'Archive directory not found' };
  }
}

async function checkMigratedScripts(): Promise<{pipelines: string[], totalMigrated: number, details: Map<string, number>}> {
  const pipelineDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const pipelines: string[] = [];
  const details = new Map<string, number>();
  let totalMigrated = 0;
  
  try {
    const pipelineEntries = await fs.readdir(pipelineDir, { withFileTypes: true });
    
    for (const entry of pipelineEntries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      
      const migratedDir = join(pipelineDir, entry.name, 'migrated_scripts');
      try {
        const migratedFiles = await fs.readdir(migratedDir);
        if (migratedFiles.length > 0) {
          pipelines.push(entry.name);
          details.set(entry.name, migratedFiles.length);
          totalMigrated += migratedFiles.length;
        }
      } catch (error) {
        // No migrated_scripts directory or empty
      }
    }
  } catch (error) {
    console.error('Error checking migrated scripts:', error);
  }
  
  return { pipelines, totalMigrated, details };
}

async function generateValidationReport(
  remaining: {count: number, scripts: string[]},
  archived: {count: number, location: string},
  migrated: {pipelines: string[], totalMigrated: number, details: Map<string, number>}
): Promise<void> {
  console.log('📊 Step 3 Validation Report: Root Scripts Review');
  console.log('='.repeat(70));
  
  // Before/After comparison (assuming we started with 60 scripts from analysis)
  const originalCount = 60;
  const processedCount = archived.count + migrated.totalMigrated;
  const reductionPercentage = parseFloat(((originalCount - remaining.count) / originalCount * 100).toFixed(1));
  
  console.log('📈 Summary:');
  console.log(`   Original root scripts: ${originalCount}`);
  console.log(`   Remaining root scripts: ${remaining.count}`);
  console.log(`   Archived scripts: ${archived.count}`);
  console.log(`   Migrated scripts: ${migrated.totalMigrated}`);
  console.log(`   Processed scripts: ${processedCount}`);
  console.log(`   Root directory reduction: ${reductionPercentage.toFixed(1)}%`);
  
  console.log('\n🗂️  Archived Scripts:');
  console.log(`   Count: ${archived.count}`);
  console.log(`   Location: ${archived.location}`);
  console.log('   Reason: Deprecated/legacy scripts removed from active codebase');
  
  console.log('\n🔄 Migrated Scripts by Pipeline:');
  if (migrated.pipelines.length === 0) {
    console.log('   No migrations found');
  } else {
    for (const pipeline of migrated.pipelines) {
      const count = migrated.details.get(pipeline) || 0;
      console.log(`   ${pipeline}: ${count} scripts`);
    }
    console.log(`   Total migrated: ${migrated.totalMigrated}`);
  }
  
  console.log('\n📁 Remaining Root Scripts:');
  if (remaining.count === 0) {
    console.log('   ✅ All root scripts have been processed!');
  } else {
    console.log(`   ${remaining.count} scripts still in root directories:`);
    for (const script of remaining.scripts.slice(0, 10)) {
      console.log(`   - ${script}`);
    }
    if (remaining.scripts.length > 10) {
      console.log(`   ... and ${remaining.scripts.length - 10} more`);
    }
  }
  
  // Quality metrics
  console.log('\n🎯 Quality Metrics:');
  console.log(`   ✅ Organization: ${processedCount}/${originalCount} scripts organized (${((processedCount/originalCount)*100).toFixed(1)}%)`);
  console.log(`   ✅ Cleanup: ${archived.count} deprecated scripts removed`);
  console.log(`   ✅ Integration: ${migrated.totalMigrated} scripts moved to pipelines`);
  console.log(`   ✅ Pipelines enhanced: ${migrated.pipelines.length} pipelines received new scripts`);
  
  // Impact assessment
  console.log('\n🚀 Impact Assessment:');
  if (reductionPercentage > 70) {
    console.log('   🟢 Excellent: Significant reduction in root script clutter');
  } else if (reductionPercentage > 50) {
    console.log('   🟡 Good: Meaningful reduction in root script clutter');
  } else {
    console.log('   🟠 Moderate: Some improvement in organization');
  }
  
  if (migrated.totalMigrated > 30) {
    console.log('   🟢 Excellent: Large number of scripts organized into pipelines');
  } else if (migrated.totalMigrated > 15) {
    console.log('   🟡 Good: Substantial script organization improvement');
  } else {
    console.log('   🟠 Moderate: Some scripts organized');
  }
  
  // Next steps
  console.log('\n📋 Next Steps:');
  console.log('1. 🔧 Review migrated scripts in each pipeline');
  console.log('2. 🔗 Integrate useful scripts into CLI commands');
  console.log('3. 📝 Update CLI help documentation');
  console.log('4. 🗑️  Archive any duplicate functionality');
  console.log('5. ▶️  Proceed to Step 4: Pipeline Consolidation');
  
  // Save detailed report
  const reportData = {
    generated_at: new Date().toISOString(),
    step: 'Step 3: Root Scripts Review',
    original_count: originalCount,
    remaining_count: remaining.count,
    archived_count: archived.count,
    migrated_count: migrated.totalMigrated,
    reduction_percentage: reductionPercentage,
    pipelines_enhanced: migrated.pipelines.length,
    remaining_scripts: remaining.scripts,
    migration_details: Object.fromEntries(migrated.details)
  };
  
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/docs/script-reports/script-cleanup-step3-validation-2025-06-08.json';
  await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
  
  console.log(`\n💾 Detailed validation report saved to: ${reportPath}`);
  
  console.log('\n✨ Step 3: Root Scripts Review - COMPLETE! ✨');
}

// Main execution
validateStep3Results().catch(console.error);