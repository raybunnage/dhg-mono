#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../packages/shared/services/supabase-client';
import { validateServiceUsage } from './validate-service-usage';
import { readFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

interface ServiceUsageUpdate {
  service_name: string;
  used_by_apps: string[];
  used_by_pipelines: string[];
}

async function fixServiceRegistry(): Promise<void> {
  console.log('🔧 Fixing service registry data...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all services with usage data
  const { data: services, error } = await supabase
    .from('sys_shared_services')
    .select('*')
    .order('service_name');
    
  if (error) {
    console.error('Error fetching services:', error);
    return;
  }
  
  console.log(`📊 Analyzing usage for ${services.length} services...\n`);
  
  const updates: ServiceUsageUpdate[] = [];
  
  for (const service of services) {
    console.log(`Analyzing: ${service.service_name}`);
    
    const actualUsage = await findActualUsage(service.service_name, service.service_path);
    
    // Only update if there are discrepancies
    const registryApps = service.used_by_apps || [];
    const registryPipelines = service.used_by_pipelines || [];
    
    const hasDiscrepancy = 
      JSON.stringify(registryApps.sort()) !== JSON.stringify(actualUsage.apps.sort()) ||
      JSON.stringify(registryPipelines.sort()) !== JSON.stringify(actualUsage.pipelines.sort());
    
    if (hasDiscrepancy) {
      updates.push({
        service_name: service.service_name,
        used_by_apps: actualUsage.apps,
        used_by_pipelines: actualUsage.pipelines
      });
      
      console.log(`  ⚠️  Discrepancy found:`);
      console.log(`     Registry: apps=[${registryApps.join(', ')}], pipelines=[${registryPipelines.join(', ')}]`);
      console.log(`     Actual:   apps=[${actualUsage.apps.join(', ')}], pipelines=[${actualUsage.pipelines.join(', ')}]`);
    } else {
      console.log(`  ✅ Registry data correct`);
    }
  }
  
  console.log(`\n📋 SUMMARY:`);
  console.log(`   Services needing updates: ${updates.length}`);
  console.log(`   Services with correct registry data: ${services.length - updates.length}`);
  
  if (updates.length === 0) {
    console.log('\n✅ All registry data is already correct!');
    return;
  }
  
  console.log('\n🔧 Applying updates...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    try {
      const { error: updateError } = await supabase
        .from('sys_shared_services')
        .update({
          used_by_apps: update.used_by_apps,
          used_by_pipelines: update.used_by_pipelines,
          updated_at: new Date().toISOString()
        })
        .eq('service_name', update.service_name);
      
      if (updateError) {
        console.error(`❌ Failed to update ${update.service_name}:`, updateError);
        errorCount++;
      } else {
        console.log(`✅ Updated ${update.service_name}`);
        console.log(`   Apps: [${update.used_by_apps.join(', ')}]`);
        console.log(`   Pipelines: [${update.used_by_pipelines.join(', ')}]`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error updating ${update.service_name}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n📊 UPDATE RESULTS:`);
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Failed updates: ${errorCount}`);
  
  if (successCount > 0) {
    console.log('\n🎉 Registry data has been corrected!');
    console.log('   Re-run the validation script to verify the fixes.');
  }
}

async function findActualUsage(serviceName: string, servicePath: string): Promise<{
  apps: string[];
  pipelines: string[];
}> {
  const usage = {
    apps: [] as string[],
    pipelines: [] as string[]
  };
  
  // Search patterns for this service
  const searchPatterns = [
    serviceName,
    servicePath?.split('/').pop()?.replace(/\.(ts|js)$/, '') || '',
    // Handle various import patterns
    servicePath ? `'${servicePath}'` : '',
    servicePath ? `"${servicePath}"` : '',
    servicePath ? `from '${servicePath}'` : '',
    servicePath ? `from "${servicePath}"` : '',
    // Handle relative imports
    servicePath?.includes('/') ? servicePath.split('/').slice(-2).join('/') : serviceName
  ].filter(Boolean);
  
  // Search in all TypeScript/JavaScript files
  const files = findFiles('/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines', [
    'apps',
    'scripts', 
    'packages'
  ], ['.ts', '.tsx', '.js', '.jsx']);
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for any of our search patterns
      for (const pattern of searchPatterns) {
        if (content.includes(pattern)) {
          // Find the actual import line
          const lines = content.split('\\n');
          const importLine = lines.find(line => 
            line.includes('import') && line.includes(pattern)
          );
          
          if (importLine) {
            const relativePath = path.relative('/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines', file);
            
            // Categorize by location
            if (relativePath.startsWith('apps/')) {
              const appName = relativePath.split('/')[1];
              if (!usage.apps.includes(appName)) {
                usage.apps.push(appName);
              }
            } else if (relativePath.startsWith('scripts/')) {
              const pipelinePath = relativePath.split('/').slice(0, 3).join('/');
              if (!usage.pipelines.includes(pipelinePath)) {
                usage.pipelines.push(pipelinePath);
              }
            }
          }
          break; // Found in this file, move to next file
        }
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }
  
  return usage;
}

function findFiles(rootDir: string, searchDirs: string[], extensions: string[]): string[] {
  const files: string[] = [];
  
  function walkDir(dir: string) {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other irrelevant directories
          if (item === 'node_modules' || item === '.git' || item === 'dist' || item === '.next') {
            continue;
          }
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  for (const searchDir of searchDirs) {
    const fullSearchDir = path.join(rootDir, searchDir);
    try {
      walkDir(fullSearchDir);
    } catch (error) {
      // Skip directories that don't exist
    }
  }
  
  return files;
}

if (require.main === module) {
  fixServiceRegistry().catch(console.error);
}

export { fixServiceRegistry };