#!/usr/bin/env ts-node

import { program } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import { getSupabaseClient } from './utils/supabase-helper';

interface PopulateOptions {
  cleanFirst?: boolean;
  skipServices?: boolean;
  skipApps?: boolean;
  skipPipelines?: boolean;
}

async function clearRegistryData(): Promise<void> {
  console.log('🗑️  Clearing existing registry data...\n');
  
  const supabase = getSupabaseClient();
  
  try {
    // Clear in correct order due to foreign key constraints
    console.log('   Clearing service dependencies...');
    await supabase.from('service_dependencies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   Clearing analysis runs...');
    await supabase.from('service_dependency_analysis_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   Clearing services registry...');
    await supabase.from('registry_services').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   Clearing apps registry...');
    await supabase.from('registry_apps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   Clearing pipelines registry...');
    await supabase.from('registry_cli_pipelines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✅ Registry data cleared\n');
  } catch (error) {
    console.error('❌ Failed to clear registry data:', error);
    throw error;
  }
}

async function runScanner(scriptName: string, args: string[] = []): Promise<void> {
  const scriptPath = path.join(__dirname, scriptName);
  const command = `npx ts-node ${scriptPath} ${args.join(' ')}`;
  
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (error) {
    console.error(`❌ Failed to run ${scriptName}:`, error);
    throw error;
  }
}

async function populateRegistry(options: PopulateOptions): Promise<void> {
  console.log('🚀 Starting full registry population...\n');
  const startTime = Date.now();
  
  try {
    // Clean first if requested
    if (options.cleanFirst) {
      await clearRegistryData();
    }
    
    // Run scanners in sequence
    if (!options.skipServices) {
      console.log('═══════════════════════════════════════════════');
      console.log('📦 SCANNING SERVICES');
      console.log('═══════════════════════════════════════════════\n');
      await runScanner('scan-services.ts', ['--update-existing']);
      console.log('\n');
    }
    
    if (!options.skipApps) {
      console.log('═══════════════════════════════════════════════');
      console.log('📱 SCANNING APPLICATIONS');
      console.log('═══════════════════════════════════════════════\n');
      await runScanner('scan-apps.ts');
      console.log('\n');
    }
    
    if (!options.skipPipelines) {
      console.log('═══════════════════════════════════════════════');
      console.log('🔧 SCANNING CLI PIPELINES');
      console.log('═══════════════════════════════════════════════\n');
      await runScanner('scan-pipelines.ts', ['--verify-commands']);
      console.log('\n');
    }
    
    // Get summary statistics
    const supabase = getSupabaseClient();
    const [services, apps, pipelines] = await Promise.all([
      supabase.from('registry_services').select('id', { count: 'exact', head: true }),
      supabase.from('registry_apps').select('id', { count: 'exact', head: true }),
      supabase.from('registry_cli_pipelines').select('id', { count: 'exact', head: true })
    ]);
    
    console.log('═══════════════════════════════════════════════');
    console.log('✅ REGISTRY POPULATION COMPLETE');
    console.log('═══════════════════════════════════════════════\n');
    
    console.log('📊 Final Registry Status:');
    console.log(`   Services: ${services.count || 0}`);
    console.log(`   Applications: ${apps.count || 0}`);
    console.log(`   CLI Pipelines: ${pipelines.count || 0}`);
    console.log(`   Total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    console.log('\n💡 Next steps:');
    console.log('   1. Run "analyze-dependencies" to map service usage');
    console.log('   2. Run "find-unused" to identify archivable services');
    console.log('   3. Run "generate-report" to create analysis reports');
    
  } catch (error) {
    console.error('\n❌ Population failed:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('populate-registry')
  .description('Run all scanners to populate the service registry')
  .option('--clean-first', 'Clear all registry data before populating')
  .option('--skip-services', 'Skip scanning services')
  .option('--skip-apps', 'Skip scanning applications')
  .option('--skip-pipelines', 'Skip scanning CLI pipelines')
  .action(populateRegistry);

program.parse();