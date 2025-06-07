#!/usr/bin/env ts-node

import { program } from 'commander';
import * as path from 'path';
import {
  scanDirectory,
  readFileSafe,
  getRelativePath,
  extractServiceName,
  getServiceType,
  isSingletonService,
  getExportType,
  getMonorepoRoot
} from './utils/file-scanner';
import {
  upsertService,
  createAnalysisRun,
  updateAnalysisRun,
  RegistryServiceInsert
} from './utils/supabase-helper';

interface ScanResult {
  totalFound: number;
  newServices: number;
  updatedServices: number;
  errors: number;
}

async function scanServices(options: { updateExisting?: boolean }): Promise<void> {
  console.log('🔍 Starting service scan...\n');
  
  const startTime = Date.now();
  const runId = await createAnalysisRun('full-scan', 'services');
  const result: ScanResult = {
    totalFound: 0,
    newServices: 0,
    updatedServices: 0,
    errors: 0
  };
  
  try {
    // Scan the shared services directory
    const servicesDir = 'packages/shared/services';
    const serviceFiles = await scanDirectory(servicesDir, '**/*-{service,adapter,utils,util,helper}.{ts,js}');
    
    console.log(`📁 Found ${serviceFiles.length} service files in ${servicesDir}\n`);
    
    for (const filePath of serviceFiles) {
      try {
        const relativePath = getRelativePath(filePath);
        const serviceName = extractServiceName(filePath);
        const content = readFileSafe(filePath);
        
        if (!content) {
          console.error(`❌ Could not read: ${relativePath}`);
          result.errors++;
          continue;
        }
        
        const serviceType = getServiceType(filePath);
        const isSingleton = isSingletonService(content);
        const exportType = getExportType(content);
        
        const service: RegistryServiceInsert = {
          service_name: serviceName,
          display_name: serviceName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          description: `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} service`,
          package_path: relativePath.split('/').slice(0, -1).join('/'),
          service_file: path.basename(filePath),
          service_type: serviceType,
          export_type: exportType,
          is_singleton: isSingleton,
          status: 'active'
        };
        
        // Check if we should update existing
        if (!options.updateExisting) {
          service.created_at = new Date().toISOString();
        }
        
        const upserted = await upsertService(service);
        
        if (upserted.created_at === upserted.updated_at) {
          console.log(`✅ Added: ${serviceName} (${serviceType}${isSingleton ? ', singleton' : ''})`);
          result.newServices++;
        } else {
          console.log(`📝 Updated: ${serviceName}`);
          result.updatedServices++;
        }
        
        result.totalFound++;
        
      } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error);
        result.errors++;
      }
    }
    
    // Update analysis run
    await updateAnalysisRun(runId, {
      status: 'completed',
      items_scanned: serviceFiles.length,
      dependencies_found: result.totalFound,
      new_dependencies: result.newServices,
      errors_encountered: result.errors,
      run_duration_ms: Date.now() - startTime
    });
    
    // Summary
    console.log('\n📊 Scan Summary:');
    console.log(`   Total services found: ${result.totalFound}`);
    console.log(`   New services added: ${result.newServices}`);
    console.log(`   Existing services updated: ${result.updatedServices}`);
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
  .name('scan-services')
  .description('Scan packages/shared/services directory and populate registry')
  .option('--update-existing', 'Update existing service entries')
  .action(scanServices);

program.parse();