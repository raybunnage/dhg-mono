#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
const glob = require('glob');

interface ServiceUsage {
  apps: { name: string; file: string; lineNumber: number }[];
  pipelines: { name: string; file: string; lineNumber: number }[];
  proxyServers: { name: string; file: string; lineNumber: number }[];
  services: { name: string; file: string; lineNumber: number }[];
  totalReferences: number;
}

async function scanServiceUsage() {
  console.log('🔍 Scanning service usage across monorepo...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all services from database
  const { data: services, error } = await supabase
    .from('sys_shared_services')
    .select('id, service_name, service_path');
    
  if (error || !services) {
    console.error('Error fetching services:', error);
    return;
  }
  
  console.log(`Found ${services.length} services to scan\n`);
  
  // File patterns to scan
  const patterns = {
    apps: 'apps/**/src/**/*.{ts,tsx,js,jsx}',
    pipelines: 'scripts/cli-pipeline/**/*.{ts,js}',
    proxyServers: '**/*-server.{js,ts,cjs,mjs}',
    services: 'packages/shared/services/**/*.{ts,js}'
  };
  
  let processedCount = 0;
  
  for (const service of services) {
    const usage: ServiceUsage = {
      apps: [],
      pipelines: [],
      proxyServers: [],
      services: [],
      totalReferences: 0
    };
    
    // Create regex patterns for finding imports
    const importPatterns = [
      // ES6 imports
      new RegExp(`import.*{.*${service.service_name}.*}.*from`, 'g'),
      new RegExp(`import.*${service.service_name}.*from`, 'g'),
      // CommonJS requires
      new RegExp(`require.*${service.service_name}`, 'g'),
      // Direct usage (for singletons)
      new RegExp(`${service.service_name}\\.(getInstance|getClient)`, 'g')
    ];
    
    // Scan each category
    for (const [category, pattern] of Object.entries(patterns)) {
      const files = glob.sync(pattern, { ignore: ['**/node_modules/**', '**/.archived/**'] });
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          for (const importPattern of importPatterns) {
            if (importPattern.test(line)) {
              const usageEntry = {
                name: path.basename(path.dirname(file)),
                file: file.replace(process.cwd() + '/', ''),
                lineNumber: index + 1
              };
              
              (usage as any)[category].push(usageEntry);
              usage.totalReferences++;
            }
          }
        });
      }
    }
    
    // Update database with usage information
    const updateData: any = {
      usage_count: usage.totalReferences,
      used_by_apps: [...new Set(usage.apps.map(u => u.name))],
      used_by_pipelines: [...new Set(usage.pipelines.map(u => u.name))],
      used_by_proxy_servers: [...new Set(usage.proxyServers.map(u => u.name))],
      last_usage_scan: new Date().toISOString(),
      usage_locations: {
        apps: usage.apps.map(u => ({ name: u.name, file: u.file })),
        services: usage.services.map(u => ({ name: u.name, file: u.file })),
        pipelines: usage.pipelines.map(u => ({ name: u.name, file: u.file })),
        proxyServers: usage.proxyServers.map(u => ({ name: u.name, file: u.file }))
      }
    };
    
    const { error: updateError } = await supabase
      .from('sys_shared_services')
      .update(updateData)
      .eq('id', service.id);
      
    if (updateError) {
      console.error(`Error updating usage for ${service.service_name}:`, updateError);
    } else {
      processedCount++;
      if (usage.totalReferences > 0) {
        console.log(`✅ ${service.service_name}: ${usage.totalReferences} references found`);
      }
    }
  }
  
  console.log(`\n✅ Scan complete! Processed ${processedCount} services`);
  
  // Show summary
  const { data: summary } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT 
        COUNT(*) as total_services,
        COUNT(*) FILTER (WHERE usage_count > 0) as used_services,
        COUNT(*) FILTER (WHERE usage_count = 0) as unused_services,
        COUNT(*) FILTER (WHERE usage_count > 10) as high_usage_services
      FROM sys_shared_services
    `
  });
  
  if (summary && summary[0]) {
    console.log('\n📊 Usage Summary:');
    console.log(`- Total services: ${summary[0].total_services}`);
    console.log(`- Used services: ${summary[0].used_services}`);
    console.log(`- Unused services: ${summary[0].unused_services}`);
    console.log(`- High usage (>10): ${summary[0].high_usage_services}`);
  }
}

// Run the scanner
scanServiceUsage().catch(console.error);