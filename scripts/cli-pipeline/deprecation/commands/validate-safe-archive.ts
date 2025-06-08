#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface PipelineValidation {
  name: string;
  hasMainCLI: boolean;
  hasAnyScript: boolean;
  hasImportantFiles: boolean;
  isEmpty: boolean;
  safeToArchive: boolean;
  reason: string;
  fileCount: number;
  importantFiles: string[];
}

async function validateSafeArchive(): Promise<void> {
  console.log('🔍 Validating Pipelines for Safe Archival\n');
  
  const pipelineDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/cli-pipeline';
  const entries = await fs.readdir(pipelineDir, { withFileTypes: true });
  const pipelines = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name);
  
  const validations: PipelineValidation[] = [];
  
  for (const pipeline of pipelines.sort()) {
    const pipelinePath = join(pipelineDir, pipeline);
    const validation = await validatePipeline(pipeline, pipelinePath);
    validations.push(validation);
  }
  
  // Print results
  console.log('📊 Pipeline Validation Results');
  console.log('='.repeat(120));
  console.log('Pipeline'.padEnd(20) + 'CLI'.padEnd(8) + 'Scripts'.padEnd(10) + 'Files'.padEnd(8) + 'Count'.padEnd(8) + 'Safe'.padEnd(8) + 'Reason');
  console.log('-'.repeat(120));
  
  for (const v of validations) {
    const cliIcon = v.hasMainCLI ? '✅' : '❌';
    const scriptIcon = v.hasAnyScript ? '✅' : '❌';
    const filesIcon = v.hasImportantFiles ? '⚠️' : '✅';
    const safeIcon = v.safeToArchive ? '✅' : '❌';
    
    console.log(
      v.name.padEnd(20) + 
      cliIcon.padEnd(8) + 
      scriptIcon.padEnd(10) + 
      filesIcon.padEnd(8) + 
      v.fileCount.toString().padEnd(8) + 
      safeIcon.padEnd(8) + 
      v.reason
    );
  }
  
  console.log('\n🎯 Safe to Archive:');
  const safeToArchive = validations.filter(v => v.safeToArchive);
  if (safeToArchive.length === 0) {
    console.log('   ⚠️  No pipelines can be safely archived without further analysis');
  } else {
    for (const v of safeToArchive) {
      console.log(`   - ${v.name}: ${v.reason}`);
    }
  }
  
  console.log('\n⚠️  Require Manual Review:');
  const requireReview = validations.filter(v => !v.safeToArchive);
  for (const v of requireReview) {
    console.log(`   - ${v.name}: ${v.reason}`);
    if (v.importantFiles.length > 0) {
      console.log(`     Important files: ${v.importantFiles.join(', ')}`);
    }
  }
}

async function validatePipeline(name: string, path: string): Promise<PipelineValidation> {
  try {
    const files = await fs.readdir(path);
    const fileCount = files.length;
    
    // Check for main CLI
    const hasMainCLI = files.some(f => f === `${name}-cli.sh`);
    
    // Check for any executable scripts
    const hasAnyScript = files.some(f => f.endsWith('.sh') || f.endsWith('.ts') || f.endsWith('.js'));
    
    // Check for important files (documentation, services, etc.)
    const importantFiles: string[] = [];
    const importantPatterns = [
      /\.md$/i,          // Documentation
      /service/i,        // Service files
      /server/i,         // Server files
      /adapter/i,        // Adapter files
      /interface/i,      // Interface files
      /package\.json$/,  // Package files
    ];
    
    for (const file of files) {
      if (importantPatterns.some(pattern => pattern.test(file))) {
        importantFiles.push(file);
      }
    }
    
    const hasImportantFiles = importantFiles.length > 0;
    const isEmpty = fileCount <= 2; // Only . and .. entries
    
    // Determine if safe to archive
    let safeToArchive = false;
    let reason = '';
    
    if (isEmpty) {
      safeToArchive = true;
      reason = 'Empty directory';
    } else if (!hasMainCLI && !hasAnyScript && !hasImportantFiles && fileCount <= 3) {
      safeToArchive = true;
      reason = 'Only temporary/test files';
    } else if (hasImportantFiles) {
      reason = 'Contains important files - requires manual review';
    } else if (hasMainCLI) {
      reason = 'Has main CLI script - functional pipeline';
    } else if (hasAnyScript) {
      reason = 'Contains scripts - may be useful';
    } else {
      reason = 'Requires manual review';
    }
    
    return {
      name,
      hasMainCLI,
      hasAnyScript,
      hasImportantFiles,
      isEmpty,
      safeToArchive,
      reason,
      fileCount,
      importantFiles
    };
    
  } catch (error) {
    return {
      name,
      hasMainCLI: false,
      hasAnyScript: false,
      hasImportantFiles: false,
      isEmpty: true,
      safeToArchive: false,
      reason: `Error reading directory: ${error}`,
      fileCount: 0,
      importantFiles: []
    };
  }
}

// Main execution
validateSafeArchive().catch(console.error);