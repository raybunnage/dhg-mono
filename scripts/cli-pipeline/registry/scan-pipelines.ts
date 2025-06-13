#!/usr/bin/env ts-node

import { program } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import {
  getSubdirectories,
  readFileSafe,
  directoryExists,
  scanDirectory,
  getMonorepoRoot
} from './utils/file-scanner';
import {
  upsertPipeline,
  createAnalysisRun,
  updateAnalysisRun,
  RegistryPipelineInsert,
  getSupabaseClient
} from './utils/supabase-helper';

interface ScanResult {
  totalFound: number;
  newPipelines: number;
  updatedPipelines: number;
  errors: number;
  totalCommands: number;
}

// Known pipeline domains from CLAUDE.md
const PIPELINE_DOMAINS = [
  'ai',
  'all_pipelines',
  'analysis',
  'batch_processing',
  'classify',
  'cmd',
  'database',
  'dev_tasks',
  'document',
  'document_types',
  'emails',
  'experts',
  'gmail',
  'google_sync',
  'media-processing',
  'presentations',
  'prompt_service',
  'registry', // Our new pipeline!
  'scripts',
  'sync',
  'transcribe',
  'viewers',
  'whisper'
];

async function findMainScript(pipelineDir: string): Promise<string | null> {
  // Look for common CLI script patterns
  const patterns = [
    `${path.basename(pipelineDir)}-cli.sh`,
    'cli.sh',
    'main.sh',
    'index.sh'
  ];
  
  for (const pattern of patterns) {
    const scriptPath = path.join(pipelineDir, pattern);
    if (fs.existsSync(scriptPath)) {
      return pattern;
    }
  }
  
  // If no standard pattern, look for any .sh file
  const shFiles = await scanDirectory(pipelineDir, '*.sh', ['node_modules']);
  if (shFiles.length > 0) {
    return path.basename(shFiles[0]);
  }
  
  return null;
}

async function countCommands(pipelineDir: string, mainScript: string | null): Promise<number> {
  if (!mainScript) return 0;
  
  const scriptPath = path.join(getMonorepoRoot(), pipelineDir, mainScript);
  const content = readFileSafe(scriptPath);
  if (!content) return 0;
  
  // Count case statements (rough estimate of commands)
  const caseMatches = content.match(/^\s*([a-zA-Z0-9_-]+)\)/gm);
  return caseMatches ? caseMatches.length : 0;
}

async function scanPipelines(options: { verifyCommands?: boolean }): Promise<void> {
  console.log('🔍 Starting CLI pipelines scan...\n');
  
  const startTime = Date.now();
  const runId = await createAnalysisRun('full-scan', 'pipelines');
  const result: ScanResult = {
    totalFound: 0,
    newPipelines: 0,
    updatedPipelines: 0,
    errors: 0,
    totalCommands: 0
  };
  
  try {
    // Scan the CLI pipeline directory
    const pipelinesDir = 'scripts/cli-pipeline';
    const pipelineDirs = getSubdirectories(pipelinesDir);
    
    console.log(`📁 Found ${pipelineDirs.length} directories in ${pipelinesDir}\n`);
    
    for (const pipelineName of pipelineDirs) {
      try {
        const pipelinePath = path.join(pipelinesDir, pipelineName);
        
        // Skip if not a valid pipeline directory
        if (!directoryExists(pipelinePath)) {
          continue;
        }
        
        // Skip special directories
        if (pipelineName.startsWith('.') || pipelineName === 'node_modules') {
          continue;
        }
        
        const mainScript = await findMainScript(pipelinePath);
        const commandCount = options.verifyCommands 
          ? await countCommands(pipelinePath, mainScript)
          : 0;
        
        // Determine domain (use directory name as domain if in known list)
        const domain = PIPELINE_DOMAINS.includes(pipelineName) ? pipelineName : 'other';
        
        const pipeline: RegistryPipelineInsert = {
          pipeline_name: pipelineName,
          display_name: pipelineName.split(/[-_]/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          description: `${domain} CLI pipeline`,
          pipeline_path: pipelinePath,
          main_script: mainScript,
          domain: domain,
          command_count: commandCount,
          status: 'active'
        };
        
        const upserted = await upsertPipeline(pipeline);
        
        if (upserted.created_at === upserted.updated_at) {
          console.log(`✅ Added: ${pipelineName} (${domain}${mainScript ? `, ${mainScript}` : ', no main script'}${commandCount > 0 ? `, ~${commandCount} commands` : ''})`);
          result.newPipelines++;
        } else {
          console.log(`📝 Updated: ${pipelineName}`);
          result.updatedPipelines++;
        }
        
        result.totalFound++;
        result.totalCommands += commandCount;
        
      } catch (error) {
        console.error(`❌ Error processing ${pipelineName}:`, error);
        result.errors++;
      }
    }
    
    // If verify commands is enabled, also check command_pipelines table
    if (options.verifyCommands) {
      console.log('\n🔗 Cross-referencing with command_pipelines table...');
      
      const supabase = SupabaseClientService.getInstance().getClient();
      const { data: commandPipelines, error } = await supabase
        .from('command_pipelines')
        .select('name, display_name, status')
        .eq('status', 'active');
      
      if (!error && commandPipelines) {
        console.log(`   Found ${commandPipelines.length} active pipelines in command_pipelines table`);
        
        // Check for pipelines in DB but not in file system
        const fsNames = new Set(pipelineDirs);
        const missingFromFs = commandPipelines.filter(cp => !fsNames.has(cp.name));
        
        if (missingFromFs.length > 0) {
          console.log('\n⚠️  Pipelines in DB but not in file system:');
          missingFromFs.forEach(cp => {
            console.log(`   - ${cp.name} (${cp.display_name})`);
          });
        }
      }
    }
    
    // Update analysis run
    await updateAnalysisRun(runId, {
      status: 'completed',
      items_scanned: pipelineDirs.length,
      dependencies_found: result.totalFound,
      new_dependencies: result.newPipelines,
      errors_encountered: result.errors,
      run_duration_ms: Date.now() - startTime
    });
    
    // Summary
    console.log('\n📊 Scan Summary:');
    console.log(`   Total pipelines found: ${result.totalFound}`);
    console.log(`   New pipelines added: ${result.newPipelines}`);
    console.log(`   Existing pipelines updated: ${result.updatedPipelines}`);
    if (options.verifyCommands) {
      console.log(`   Estimated total commands: ${result.totalCommands}`);
    }
    console.log(`   Errors encountered: ${result.errors}`);
    console.log(`   Time taken: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
  } catch (error) {
    console.error('❌ Scan failed:', error);
    await updateAnalysisRun(runId, {
      status: 'failed',
      errors_encountered: result.errors + 1,
      run_duration_ms: Date.now() - startTime,
      notes: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

// CLI setup
program
  .name('scan-pipelines')
  .description('Scan CLI pipelines and populate registry')
  .option('--verify-commands', 'Count commands in each pipeline')
  .action(scanPipelines);

program.parse();