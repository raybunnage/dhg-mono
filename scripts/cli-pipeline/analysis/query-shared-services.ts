#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface SharedService {
  id: string;
  service_name: string;
  service_path: string;
  category: string | null;
  status: string | null;
  description: string | null;
  is_singleton: boolean | null;
  has_browser_variant: boolean | null;
  used_by_apps: string[] | null;
  used_by_pipelines: string[] | null;
  dependencies: any | null;
  exports: any | null;
}

async function analyzeSharedServices() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Analyzing Shared Services Inventory...\n');
  
  // Fetch all shared services
  const { data: services, error } = await supabase
    .from('sys_shared_services')
    .select('*')
    .order('category', { ascending: true })
    .order('service_name', { ascending: true });
    
  if (error) {
    console.error('Error fetching shared services:', error);
    return;
  }
  
  if (!services || services.length === 0) {
    console.log('No shared services found in the database.');
    return;
  }
  
  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, SharedService[]>);
  
  console.log('=== SHARED SERVICES BY CATEGORY ===\n');
  
  Object.entries(servicesByCategory).forEach(([category, categoryServices]) => {
    console.log(`\n📁 ${category} (${categoryServices.length} services)`);
    console.log('─'.repeat(60));
    
    categoryServices.forEach(service => {
      console.log(`\n  📦 ${service.service_name}`);
      console.log(`     Path: ${service.service_path}`);
      console.log(`     Status: ${service.status || 'active'}`);
      if (service.description) {
        console.log(`     Description: ${service.description}`);
      }
      if (service.is_singleton) {
        console.log(`     🔒 Singleton Service`);
      }
      if (service.has_browser_variant) {
        console.log(`     🌐 Has Browser Variant`);
      }
      
      // Show usage
      const appCount = service.used_by_apps?.length || 0;
      const pipelineCount = service.used_by_pipelines?.length || 0;
      
      if (appCount > 0) {
        console.log(`     Apps (${appCount}): ${service.used_by_apps?.join(', ')}`);
      }
      if (pipelineCount > 0) {
        console.log(`     Pipelines (${pipelineCount}): ${service.used_by_pipelines?.join(', ')}`);
      }
      
      if (appCount === 0 && pipelineCount === 0) {
        console.log(`     ⚠️  NOT USED BY ANY APP OR PIPELINE`);
      }
    });
  });
  
  console.log('\n\n=== USAGE ANALYSIS ===\n');
  
  // Find underutilized services
  const underutilized = services.filter(service => {
    const appCount = service.used_by_apps?.length || 0;
    const pipelineCount = service.used_by_pipelines?.length || 0;
    return (appCount + pipelineCount) === 1;
  });
  
  if (underutilized.length > 0) {
    console.log('\n⚠️  Underutilized Services (used by only 1 app/pipeline):');
    underutilized.forEach(service => {
      const usage = [];
      if (service.used_by_apps?.length) {
        usage.push(`app: ${service.used_by_apps.join(', ')}`);
      }
      if (service.used_by_pipelines?.length) {
        usage.push(`pipeline: ${service.used_by_pipelines.join(', ')}`);
      }
      console.log(`  - ${service.service_name} (${usage.join(', ')})`);
    });
  }
  
  // Find unused services
  const unused = services.filter(service => {
    const appCount = service.used_by_apps?.length || 0;
    const pipelineCount = service.used_by_pipelines?.length || 0;
    return (appCount + pipelineCount) === 0;
  });
  
  if (unused.length > 0) {
    console.log('\n❌ Unused Services:');
    unused.forEach(service => {
      console.log(`  - ${service.service_name} (${service.category || 'Uncategorized'})`);
    });
  }
  
  // Category analysis
  console.log('\n\n=== CATEGORY ANALYSIS ===\n');
  
  const categoryStats = Object.entries(servicesByCategory).map(([category, svcs]) => ({
    category,
    count: svcs.length,
    singleton: svcs.filter(s => s.is_singleton).length,
    browserVariant: svcs.filter(s => s.has_browser_variant).length,
  }));
  
  categoryStats.sort((a, b) => b.count - a.count);
  
  console.log('Service Distribution by Category:');
  categoryStats.forEach(stat => {
    console.log(`  ${stat.category}: ${stat.count} services`);
    if (stat.singleton > 0) {
      console.log(`    - ${stat.singleton} singleton services`);
    }
    if (stat.browserVariant > 0) {
      console.log(`    - ${stat.browserVariant} with browser variants`);
    }
  });
  
  // Most used services
  console.log('\n\n=== MOST USED SERVICES ===\n');
  
  const serviceUsage = services.map(service => ({
    name: service.service_name,
    category: service.category || 'Uncategorized',
    totalUsage: (service.used_by_apps?.length || 0) + (service.used_by_pipelines?.length || 0),
    apps: service.used_by_apps?.length || 0,
    pipelines: service.used_by_pipelines?.length || 0,
  }));
  
  serviceUsage.sort((a, b) => b.totalUsage - a.totalUsage);
  
  console.log('Top 10 Most Used Services:');
  serviceUsage.slice(0, 10).forEach((service, index) => {
    console.log(`  ${index + 1}. ${service.name} (${service.category})`);
    console.log(`     Total: ${service.totalUsage} (${service.apps} apps, ${service.pipelines} pipelines)`);
  });
  
  // Summary
  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Total Services: ${services.length}`);
  console.log(`Categories: ${Object.keys(servicesByCategory).length}`);
  console.log(`Singleton Services: ${services.filter(s => s.is_singleton).length}`);
  console.log(`Browser Variants: ${services.filter(s => s.has_browser_variant).length}`);
  console.log(`Underutilized: ${underutilized.length}`);
  console.log(`Unused: ${unused.length}`);
  
  // Potential gaps
  console.log('\n\n=== POTENTIAL GAPS ===\n');
  
  const expectedCategories = [
    'Authentication',
    'Database',
    'AI/ML',
    'File Management',
    'Communication',
    'Monitoring',
    'Testing',
    'Utilities',
    'Media Processing',
    'Document Processing',
    'Search',
    'Caching',
    'Validation',
    'Logging',
    'Email',
    'Notifications'
  ];
  
  const existingCategories = Object.keys(servicesByCategory);
  const missingCategories = expectedCategories.filter(cat => 
    !existingCategories.some(existing => 
      existing.toLowerCase().includes(cat.toLowerCase()) || 
      cat.toLowerCase().includes(existing.toLowerCase())
    )
  );
  
  if (missingCategories.length > 0) {
    console.log('Categories that might be missing or underrepresented:');
    missingCategories.forEach(cat => {
      console.log(`  - ${cat}`);
    });
  }
}

// Run the analysis
analyzeSharedServices().catch(console.error);