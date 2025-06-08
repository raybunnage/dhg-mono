#!/usr/bin/env ts-node

import { program } from 'commander';
import { getSupabaseClient } from './utils/supabase-helper';

interface UnusedService {
  id: string;
  service_name: string;
  display_name: string;
  service_type: string;
  package_path: string;
  dependency_count: number;
  last_command_usage: string | null;
  days_since_usage: number | null;
  recommendation: string;
}

interface FindUnusedOptions {
  includeCommands?: boolean;
  includeLowUsage?: boolean;
  daysThreshold?: string;
  exportCsv?: boolean;
}

async function checkCommandUsage(serviceName: string, daysThreshold: number): Promise<{ lastUsage: Date | null, usageCount: number }> {
  const supabase = getSupabaseClient();
  
  // Check command_tracking for any commands that might use this service
  const { data, error } = await supabase
    .from('command_tracking')
    .select('execution_time')
    .or(`command_name.ilike.%${serviceName}%,pipeline_name.ilike.%${serviceName}%`)
    .gte('execution_time', new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString())
    .order('execution_time', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return { lastUsage: null, usageCount: 0 };
  }
  
  // Get total count
  const { count } = await supabase
    .from('command_tracking')
    .select('*', { count: 'exact', head: true })
    .or(`command_name.ilike.%${serviceName}%,pipeline_name.ilike.%${serviceName}%`)
    .gte('execution_time', new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString());
  
  return {
    lastUsage: new Date(data[0].execution_time),
    usageCount: count || 0
  };
}

async function findUnusedServices(options: FindUnusedOptions): Promise<void> {
  console.log('🔍 Finding unused services...\n');
  
  const supabase = getSupabaseClient();
  const daysThreshold = parseInt(options.daysThreshold || '90');
  
  try {
    // Get all services from the unused services view
    const { data: unusedServices, error } = await supabase
      .from('registry_unused_services_view')
      .select('*')
      .eq('is_unused', true)
      .order('service_name');
    
    if (error) throw error;
    
    if (!unusedServices || unusedServices.length === 0) {
      console.log('✅ No unused services found! All services have dependencies.');
      return;
    }
    
    console.log(`Found ${unusedServices.length} services with no dependencies\n`);
    
    // Enhance with command usage data if requested
    const enhancedServices: UnusedService[] = [];
    
    for (const service of unusedServices) {
      let lastCommandUsage: Date | null = null;
      let commandUsageCount = 0;
      let daysSinceUsage: number | null = null;
      
      if (options.includeCommands) {
        const usage = await checkCommandUsage(service.service_name, daysThreshold);
        lastCommandUsage = usage.lastUsage;
        commandUsageCount = usage.usageCount;
        
        if (lastCommandUsage) {
          daysSinceUsage = Math.floor((Date.now() - lastCommandUsage.getTime()) / (24 * 60 * 60 * 1000));
        }
      }
      
      // Determine recommendation
      let recommendation = 'Safe to archive - no dependencies';
      
      if (options.includeCommands) {
        if (commandUsageCount > 0 && daysSinceUsage !== null && daysSinceUsage < 30) {
          recommendation = 'Recent command usage - verify before archiving';
        } else if (commandUsageCount > 0) {
          recommendation = `No recent usage (${daysSinceUsage} days) - consider archiving`;
        } else {
          recommendation = 'Safe to archive - no dependencies or command usage';
        }
      }
      
      enhancedServices.push({
        id: service.id,
        service_name: service.service_name,
        display_name: service.display_name,
        service_type: service.service_type,
        package_path: service.package_path,
        dependency_count: service.dependency_count,
        last_command_usage: lastCommandUsage?.toISOString() || null,
        days_since_usage: daysSinceUsage,
        recommendation
      });
    }
    
    // Filter based on options
    let filteredServices = enhancedServices;
    
    if (!options.includeLowUsage) {
      // Filter out services with recent usage
      filteredServices = enhancedServices.filter(s => 
        !s.last_command_usage || s.days_since_usage === null || s.days_since_usage > 30
      );
    }
    
    // Sort by recommendation priority
    filteredServices.sort((a, b) => {
      const priority: Record<string, number> = {
        'Safe to archive - no dependencies or command usage': 1,
        'Safe to archive - no dependencies': 2,
        'No recent usage': 3,
        'Recent command usage': 4
      };
      
      const aPriority = Object.entries(priority).find(([key]) => a.recommendation.includes(key))?.[1] || 5;
      const bPriority = Object.entries(priority).find(([key]) => b.recommendation.includes(key))?.[1] || 5;
      
      return aPriority - bPriority;
    });
    
    // Display results
    console.log('🗂️  Unused Services Report\n');
    console.log('Services are listed in order of archiving safety:\n');
    
    // Group by recommendation
    const grouped = filteredServices.reduce((acc, service) => {
      const key = service.recommendation.split(' - ')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(service);
      return acc;
    }, {} as Record<string, UnusedService[]>);
    
    for (const [recommendation, services] of Object.entries(grouped)) {
      console.log(`\n${recommendation}:`);
      console.log('─'.repeat(60));
      
      for (const service of services) {
        console.log(`\n📦 ${service.service_name} (${service.service_type})`);
        console.log(`   Display Name: ${service.display_name}`);
        console.log(`   Location: ${service.package_path}`);
        
        if (options.includeCommands && service.last_command_usage) {
          console.log(`   Last Command Usage: ${service.days_since_usage} days ago`);
        }
      }
    }
    
    // Export to CSV if requested
    if (options.exportCsv) {
      const csv = [
        'Service Name,Display Name,Type,Package Path,Dependency Count,Last Command Usage,Days Since Usage,Recommendation',
        ...filteredServices.map(s => 
          `"${s.service_name}","${s.display_name}","${s.service_type}","${s.package_path}",${s.dependency_count},"${s.last_command_usage || ''}",${s.days_since_usage || ''},"${s.recommendation}"`
        )
      ].join('\n');
      
      const filename = `unused-services-${new Date().toISOString().split('T')[0]}.csv`;
      await require('fs').promises.writeFile(filename, csv);
      console.log(`\n📄 Report exported to: ${filename}`);
    }
    
    // Summary statistics
    console.log('\n\n📊 Summary:');
    console.log(`   Total unused services: ${unusedServices.length}`);
    console.log(`   Safe to archive: ${grouped['Safe to archive']?.length || 0}`);
    if (options.includeCommands) {
      console.log(`   With recent usage: ${enhancedServices.filter(s => s.days_since_usage !== null && s.days_since_usage < 30).length}`);
      console.log(`   No recent usage: ${enhancedServices.filter(s => !s.last_command_usage || (s.days_since_usage !== null && s.days_since_usage > 30)).length}`);
    }
    
    // Archiving instructions
    console.log('\n\n📋 Next Steps:');
    console.log('1. Review the services marked as "Safe to archive"');
    console.log('2. Use the archive-service command to archive individual services:');
    console.log('   ./registry-cli.sh archive-service --service <service-name>');
    console.log('3. Or create a batch archive script for multiple services');
    
  } catch (error) {
    console.error('❌ Error finding unused services:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('find-unused')
  .description('Find services with no dependencies that may be candidates for archiving')
  .option('--include-commands', 'Check command tracking for usage patterns')
  .option('--include-low-usage', 'Include services with low/recent usage')
  .option('--days-threshold <days>', 'Number of days to check for recent usage', '90')
  .option('--export-csv', 'Export results to CSV file')
  .action(findUnusedServices);

program.parse();