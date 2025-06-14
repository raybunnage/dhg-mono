#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../packages/shared/services/supabase-client';
import { readFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

interface ServiceUsage {
  service_name: string;
  category: string;
  registry_apps: string[];
  registry_pipelines: string[];
  actual_usage: {
    apps: string[];
    pipelines: string[];
    imports: Array<{
      file: string;
      import_line: string;
    }>;
  };
  discrepancy: boolean;
}

async function validateServiceUsage(): Promise<void> {
  console.log('🔍 Validating service usage against actual codebase...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all registered services
  const { data: services, error } = await supabase
    .from('sys_shared_services')
    .select('*')
    .order('service_name');
  
  if (error) {
    console.error('Error fetching services:', error);
    return;
  }
  
  console.log(`📊 Analyzing ${services.length} registered services...\n`);
  
  const results: ServiceUsage[] = [];
  
  for (const service of services) {
    console.log(`Analyzing: ${service.service_name}`);
    
    const usage = await findActualUsage(service.service_name, service.service_path);
    
    const registryApps = service.used_by_apps || [];
    const registryPipelines = service.used_by_pipelines || [];
    
    const discrepancy = 
      JSON.stringify(registryApps.sort()) !== JSON.stringify(usage.apps.sort()) ||
      JSON.stringify(registryPipelines.sort()) !== JSON.stringify(usage.pipelines.sort());
    
    results.push({
      service_name: service.service_name,
      category: service.category,
      registry_apps: registryApps,
      registry_pipelines: registryPipelines,
      actual_usage: usage,
      discrepancy
    });
  }
  
  // Report findings
  console.log('\n🔍 VALIDATION RESULTS\n');
  console.log('=' .repeat(80));
  
  const discrepancies = results.filter(r => r.discrepancy);
  const totallyUnused = results.filter(r => 
    r.actual_usage.apps.length === 0 && 
    r.actual_usage.pipelines.length === 0 &&
    r.actual_usage.imports.length === 0
  );
  
  console.log(`📈 Summary:`);
  console.log(`   Total services: ${results.length}`);
  console.log(`   Services with registry discrepancies: ${discrepancies.length}`);
  console.log(`   Actually unused services: ${totallyUnused.length}`);
  console.log(`   Registry claimed unused: ${results.filter(r => r.registry_apps.length === 0 && r.registry_pipelines.length === 0).length}`);
  
  console.log('\n🚨 DISCREPANCIES FOUND:\n');
  
  for (const result of discrepancies) {
    console.log(`Service: ${result.service_name} (${result.category})`);
    console.log(`   Registry says used by apps: [${result.registry_apps.join(', ')}]`);
    console.log(`   Actually used by apps: [${result.actual_usage.apps.join(', ')}]`);
    console.log(`   Registry says used by pipelines: [${result.registry_pipelines.join(', ')}]`);
    console.log(`   Actually used by pipelines: [${result.actual_usage.pipelines.join(', ')}]`);
    console.log(`   Total imports found: ${result.actual_usage.imports.length}`);
    
    if (result.actual_usage.imports.length > 0) {
      console.log(`   Sample imports:`);
      result.actual_usage.imports.slice(0, 3).forEach(imp => {
        console.log(`     ${imp.file}: ${imp.import_line.trim()}`);
      });
    }
    console.log('');
  }
  
  if (totallyUnused.length > 0) {
    console.log('\n🗑️  ACTUALLY UNUSED SERVICES:\n');
    totallyUnused.forEach(service => {
      console.log(`   ${service.service_name} (${service.category})`);
    });
  }
  
  // Write detailed report
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines/docs/service-usage-validation-report.md';
  await writeDetailedReport(results, reportPath);
  
  console.log(`\n📄 Detailed report written to: ${reportPath}`);
}

async function findActualUsage(serviceName: string, servicePath: string): Promise<{
  apps: string[];
  pipelines: string[];
  imports: Array<{ file: string; import_line: string }>;
}> {
  const usage = {
    apps: [] as string[],
    pipelines: [] as string[],
    imports: [] as Array<{ file: string; import_line: string }>
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
          const lines = content.split('\n');
          const importLine = lines.find(line => 
            line.includes('import') && line.includes(pattern)
          );
          
          if (importLine) {
            const relativePath = path.relative('/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines', file);
            usage.imports.push({
              file: relativePath,
              import_line: importLine
            });
            
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

async function writeDetailedReport(results: ServiceUsage[], reportPath: string): Promise<void> {
  const timestamp = new Date().toISOString();
  
  let content = `# Service Usage Validation Report\n\n`;
  content += `Generated: ${timestamp}\n\n`;
  
  content += `## Summary\n\n`;
  content += `- Total services analyzed: ${results.length}\n`;
  content += `- Services with discrepancies: ${results.filter(r => r.discrepancy).length}\n`;
  content += `- Actually unused services: ${results.filter(r => r.actual_usage.apps.length === 0 && r.actual_usage.pipelines.length === 0).length}\n\n`;
  
  content += `## Key Findings\n\n`;
  
  const registryClaimedUnused = results.filter(r => r.registry_apps.length === 0 && r.registry_pipelines.length === 0);
  const actuallyUsed = registryClaimedUnused.filter(r => r.actual_usage.apps.length > 0 || r.actual_usage.pipelines.length > 0);
  
  if (actuallyUsed.length > 0) {
    content += `### 🚨 Registry Data Issue Confirmed\n\n`;
    content += `The registry claims ${registryClaimedUnused.length} services are unused, but ${actuallyUsed.length} of them are actually being used.\n\n`;
    content += `**Services incorrectly marked as unused:**\n\n`;
    
    for (const service of actuallyUsed) {
      content += `- **${service.service_name}** (${service.category})\n`;
      content += `  - Used by apps: ${service.actual_usage.apps.join(', ') || 'none'}\n`;
      content += `  - Used by pipelines: ${service.actual_usage.pipelines.join(', ') || 'none'}\n`;
      content += `  - Total imports: ${service.actual_usage.imports.length}\n\n`;
    }
  }
  
  content += `## Detailed Analysis\n\n`;
  
  for (const result of results) {
    content += `### ${result.service_name}\n\n`;
    content += `**Category:** ${result.category}\n\n`;
    
    if (result.discrepancy) {
      content += `⚠️ **DISCREPANCY DETECTED**\n\n`;
    }
    
    content += `**Registry Data:**\n`;
    content += `- Apps: [${result.registry_apps.join(', ')}]\n`;
    content += `- Pipelines: [${result.registry_pipelines.join(', ')}]\n\n`;
    
    content += `**Actual Usage:**\n`;
    content += `- Apps: [${result.actual_usage.apps.join(', ')}]\n`;
    content += `- Pipelines: [${result.actual_usage.pipelines.join(', ')}]\n`;
    content += `- Total imports found: ${result.actual_usage.imports.length}\n\n`;
    
    if (result.actual_usage.imports.length > 0) {
      content += `**Import Examples:**\n`;
      result.actual_usage.imports.slice(0, 5).forEach(imp => {
        content += `- \`${imp.file}\`: \`${imp.import_line.trim()}\`\n`;
      });
      content += `\n`;
    }
    
    content += `---\n\n`;
  }
  
  // Write the file
  require('fs').writeFileSync(reportPath, content, 'utf-8');
}

if (require.main === module) {
  validateServiceUsage().catch(console.error);
}

export { validateServiceUsage };