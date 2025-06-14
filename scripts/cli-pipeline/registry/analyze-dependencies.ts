#!/usr/bin/env ts-node

import { program } from 'commander';
import * as path from 'path';
import {
  scanDirectory,
  readFileSafe,
  getRelativePath,
  getMonorepoRoot
} from './utils/file-scanner';
import {
  parseImports,
  filterSharedServiceImports,
  getUniqueServicesFromImports,
  getDependencyType
} from './utils/import-parser';
import {
  getSupabaseClient,
  getServiceByName,
  getAppByName,
  getPipelineByName,
  createAnalysisRun,
  updateAnalysisRun,
  ServiceDependencyInsert
} from './utils/supabase-helper';

interface AnalyzeOptions {
  app?: string;
  service?: string;
  pipeline?: string;
  updateExisting?: boolean;
}

interface DependencyAnalysis {
  totalImports: number;
  serviceImports: number;
  uniqueServices: string[];
  newDependencies: number;
  updatedDependencies: number;
  errors: number;
}

async function analyzeAppDependencies(appName: string, options: AnalyzeOptions): Promise<DependencyAnalysis> {
  const supabase = SupabaseClientService.getInstance().getClient();
  const app = await getAppByName(appName);
  
  if (!app) {
    throw new Error(`App '${appName}' not found in registry`);
  }
  
  console.log(`\n📱 Analyzing app: ${app.display_name}`);
  
  const analysis: DependencyAnalysis = {
    totalImports: 0,
    serviceImports: 0,
    uniqueServices: [],
    newDependencies: 0,
    updatedDependencies: 0,
    errors: 0
  };
  
  try {
    // Scan all TypeScript/JavaScript files in the app
    const appFiles = await scanDirectory(app.app_path, '**/*.{ts,tsx,js,jsx}');
    console.log(`   Found ${appFiles.length} source files`);
    
    // Collect all service imports
    const allServiceImports = new Map<string, { count: number, contexts: Set<string>, types: Set<string> }>();
    
    for (const file of appFiles) {
      const content = readFileSafe(file);
      if (!content) continue;
      
      const imports = parseImports(content);
      analysis.totalImports += imports.length;
      
      const serviceImports = filterSharedServiceImports(imports);
      analysis.serviceImports += serviceImports.length;
      
      for (const imp of serviceImports) {
        const services = getUniqueServicesFromImports([imp]);
        for (const serviceName of services) {
          if (!allServiceImports.has(serviceName)) {
            allServiceImports.set(serviceName, { count: 0, contexts: new Set(), types: new Set() });
          }
          const serviceData = allServiceImports.get(serviceName)!;
          serviceData.count++;
          serviceData.contexts.add(getRelativePath(file));
          serviceData.types.add(getDependencyType(imp));
        }
      }
    }
    
    analysis.uniqueServices = Array.from(allServiceImports.keys());
    console.log(`   Found ${analysis.uniqueServices.length} unique service dependencies`);
    
    // Store dependencies in database
    for (const [serviceName, data] of allServiceImports) {
      const service = await getServiceByName(serviceName);
      if (!service) {
        console.log(`   ⚠️  Service '${serviceName}' not found in registry`);
        analysis.errors++;
        continue;
      }
      
      // Determine usage frequency based on import count
      const usageFrequency = data.count > 10 ? 'high' : data.count > 3 ? 'medium' : 'low';
      const dependencyTypes = Array.from(data.types);
      const isCritical = usageFrequency === 'high' || dependencyTypes.includes('singleton-call');
      
      const dependency: ServiceDependencyInsert = {
        dependent_id: app.id,
        dependent_type: 'app',
        dependent_name: app.app_name,
        service_id: service.id,
        service_name: service.service_name,
        dependency_type: dependencyTypes[0], // Primary type
        import_path: `@shared/services/${serviceName}`,
        usage_context: `Used in ${data.count} files`,
        usage_frequency: usageFrequency,
        is_critical: isCritical,
        notes: `Import contexts: ${Math.min(3, data.contexts.size)} files shown`
      };
      
      // Upsert dependency
      const { data: existing } = await supabase
        .from('service_dependencies')
        .select('id')
        .eq('dependent_id', app.id)
        .eq('dependent_type', 'app')
        .eq('service_id', service.id)
        .single();
      
      if (existing) {
        if (options.updateExisting) {
          await supabase
            .from('service_dependencies')
            .update({
              ...dependency,
              last_verified_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          analysis.updatedDependencies++;
        }
      } else {
        await supabase
          .from('service_dependencies')
          .insert(dependency);
        analysis.newDependencies++;
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error analyzing app:`, error);
    analysis.errors++;
  }
  
  return analysis;
}

async function analyzePipelineDependencies(pipelineName: string, options: AnalyzeOptions): Promise<DependencyAnalysis> {
  const supabase = SupabaseClientService.getInstance().getClient();
  const pipeline = await getPipelineByName(pipelineName);
  
  if (!pipeline) {
    throw new Error(`Pipeline '${pipelineName}' not found in registry`);
  }
  
  console.log(`\n🔧 Analyzing pipeline: ${pipeline.display_name}`);
  
  const analysis: DependencyAnalysis = {
    totalImports: 0,
    serviceImports: 0,
    uniqueServices: [],
    newDependencies: 0,
    updatedDependencies: 0,
    errors: 0
  };
  
  try {
    // Scan all TypeScript files in the pipeline
    const pipelineFiles = await scanDirectory(pipeline.pipeline_path, '**/*.ts');
    console.log(`   Found ${pipelineFiles.length} TypeScript files`);
    
    // Collect all service imports
    const allServiceImports = new Map<string, { count: number, contexts: Set<string>, types: Set<string> }>();
    
    for (const file of pipelineFiles) {
      const content = readFileSafe(file);
      if (!content) continue;
      
      const imports = parseImports(content);
      analysis.totalImports += imports.length;
      
      const serviceImports = filterSharedServiceImports(imports);
      analysis.serviceImports += serviceImports.length;
      
      for (const imp of serviceImports) {
        const services = getUniqueServicesFromImports([imp]);
        for (const serviceName of services) {
          if (!allServiceImports.has(serviceName)) {
            allServiceImports.set(serviceName, { count: 0, contexts: new Set(), types: new Set() });
          }
          const serviceData = allServiceImports.get(serviceName)!;
          serviceData.count++;
          serviceData.contexts.add(getRelativePath(file));
          serviceData.types.add(getDependencyType(imp));
        }
      }
    }
    
    analysis.uniqueServices = Array.from(allServiceImports.keys());
    console.log(`   Found ${analysis.uniqueServices.length} unique service dependencies`);
    
    // Store dependencies in database
    for (const [serviceName, data] of allServiceImports) {
      const service = await getServiceByName(serviceName);
      if (!service) {
        console.log(`   ⚠️  Service '${serviceName}' not found in registry`);
        analysis.errors++;
        continue;
      }
      
      const usageFrequency = data.count > 5 ? 'high' : data.count > 2 ? 'medium' : 'low';
      const dependencyTypes = Array.from(data.types);
      const isCritical = usageFrequency === 'high' || dependencyTypes.includes('singleton-call');
      
      const dependency: ServiceDependencyInsert = {
        dependent_id: pipeline.id,
        dependent_type: 'pipeline',
        dependent_name: pipeline.pipeline_name,
        service_id: service.id,
        service_name: service.service_name,
        dependency_type: dependencyTypes[0],
        import_path: `@shared/services/${serviceName}`,
        usage_context: `Used in ${data.count} files`,
        usage_frequency: usageFrequency,
        is_critical: isCritical,
        notes: `Commands using this service`
      };
      
      // Upsert dependency
      const { data: existing } = await supabase
        .from('service_dependencies')
        .select('id')
        .eq('dependent_id', pipeline.id)
        .eq('dependent_type', 'pipeline')
        .eq('service_id', service.id)
        .single();
      
      if (existing) {
        if (options.updateExisting) {
          await supabase
            .from('service_dependencies')
            .update({
              ...dependency,
              last_verified_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          analysis.updatedDependencies++;
        }
      } else {
        await supabase
          .from('service_dependencies')
          .insert(dependency);
        analysis.newDependencies++;
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error analyzing pipeline:`, error);
    analysis.errors++;
  }
  
  return analysis;
}

async function analyzeDependencies(options: AnalyzeOptions): Promise<void> {
  console.log('🔍 Starting dependency analysis...\n');
  
  const startTime = Date.now();
  const runId = await createAnalysisRun('dependency-analysis', options.app ? 'apps' : options.pipeline ? 'pipelines' : 'all');
  
  const totals = {
    itemsAnalyzed: 0,
    totalDependencies: 0,
    newDependencies: 0,
    updatedDependencies: 0,
    errors: 0
  };
  
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Analyze specific app
    if (options.app) {
      const result = await analyzeAppDependencies(options.app, options);
      totals.itemsAnalyzed = 1;
      totals.totalDependencies = result.uniqueServices.length;
      totals.newDependencies = result.newDependencies;
      totals.updatedDependencies = result.updatedDependencies;
      totals.errors = result.errors;
    }
    // Analyze specific pipeline
    else if (options.pipeline) {
      const result = await analyzePipelineDependencies(options.pipeline, options);
      totals.itemsAnalyzed = 1;
      totals.totalDependencies = result.uniqueServices.length;
      totals.newDependencies = result.newDependencies;
      totals.updatedDependencies = result.updatedDependencies;
      totals.errors = result.errors;
    }
    // Analyze all apps and pipelines
    else {
      // Analyze all apps
      const { data: apps } = await supabase
        .from('registry_apps')
        .select('app_name')
        .eq('status', 'active');
      
      if (apps) {
        console.log(`\n📱 Analyzing ${apps.length} applications...`);
        for (const app of apps) {
          const result = await analyzeAppDependencies(app.app_name, options);
          totals.itemsAnalyzed++;
          totals.totalDependencies += result.uniqueServices.length;
          totals.newDependencies += result.newDependencies;
          totals.updatedDependencies += result.updatedDependencies;
          totals.errors += result.errors;
        }
      }
      
      // Analyze all pipelines
      const { data: pipelines } = await supabase
        .from('registry_cli_pipelines')
        .select('pipeline_name')
        .eq('status', 'active');
      
      if (pipelines) {
        console.log(`\n🔧 Analyzing ${pipelines.length} CLI pipelines...`);
        for (const pipeline of pipelines) {
          const result = await analyzePipelineDependencies(pipeline.pipeline_name, options);
          totals.itemsAnalyzed++;
          totals.totalDependencies += result.uniqueServices.length;
          totals.newDependencies += result.newDependencies;
          totals.updatedDependencies += result.updatedDependencies;
          totals.errors += result.errors;
        }
      }
    }
    
    // Update analysis run
    await updateAnalysisRun(runId, {
      status: 'completed',
      items_scanned: totals.itemsAnalyzed,
      dependencies_found: totals.totalDependencies,
      new_dependencies: totals.newDependencies,
      removed_dependencies: 0,
      errors_encountered: totals.errors,
      run_duration_ms: Date.now() - startTime
    });
    
    // Summary
    console.log('\n📊 Dependency Analysis Summary:');
    console.log(`   Items analyzed: ${totals.itemsAnalyzed}`);
    console.log(`   Total dependencies found: ${totals.totalDependencies}`);
    console.log(`   New dependencies added: ${totals.newDependencies}`);
    console.log(`   Existing dependencies updated: ${totals.updatedDependencies}`);
    console.log(`   Errors encountered: ${totals.errors}`);
    console.log(`   Time taken: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    await updateAnalysisRun(runId, {
      status: 'failed',
      errors_encountered: totals.errors + 1,
      run_duration_ms: Date.now() - startTime,
      notes: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

// CLI setup
program
  .name('analyze-dependencies')
  .description('Analyze and map service dependencies across apps and pipelines')
  .option('--app <name>', 'Analyze dependencies for a specific app')
  .option('--service <name>', 'Find all apps/pipelines using a specific service')
  .option('--pipeline <name>', 'Analyze dependencies for a specific pipeline')
  .option('--update-existing', 'Update existing dependency records')
  .action(analyzeDependencies);

program.parse();