#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function analyzeServicesForTesting(): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get active services by category
  const { data: services, error } = await supabase
    .from('sys_shared_services')
    .select('*')
    .eq('status', 'active')
    .order('category', { ascending: true })
    .order('service_name', { ascending: true });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('🔍 ACTIVE SERVICES ANALYSIS FOR TESTING');
  console.log('=' .repeat(50));
  
  const categories: Record<string, any[]> = {};
  let totalUsedServices = 0;
  let totalCliUsage = 0;
  let totalAppUsage = 0;
  
  services.forEach((service: any) => {
    if (!categories[service.category]) {
      categories[service.category] = [];
    }
    categories[service.category].push(service);
    
    const usedByApps = service.used_by_apps || [];
    const usedByPipelines = service.used_by_pipelines || [];
    
    if (usedByApps.length > 0 || usedByPipelines.length > 0) {
      totalUsedServices++;
      totalAppUsage += usedByApps.length;
      totalCliUsage += usedByPipelines.length;
    }
  });
  
  console.log(`📊 TESTING SCOPE:`);
  console.log(`   Total active services: ${services.length}`);
  console.log(`   Services in use: ${totalUsedServices}`);
  console.log(`   App integrations: ${totalAppUsage}`);
  console.log(`   CLI integrations: ${totalCliUsage}`);
  console.log();
  
  Object.keys(categories).sort().forEach(category => {
    const categoryServices = categories[category];
    const usedInCategory = categoryServices.filter((s: any) => 
      (s.used_by_apps && s.used_by_apps.length > 0) || 
      (s.used_by_pipelines && s.used_by_pipelines.length > 0)
    );
    
    console.log(`📦 ${category.toUpperCase()} (${usedInCategory.length}/${categoryServices.length} used)`);
    
    usedInCategory.forEach((service: any) => {
      const apps = service.used_by_apps || [];
      const pipelines = service.used_by_pipelines || [];
      console.log(`   • ${service.service_name}`);
      if (apps.length > 0) console.log(`     Apps: ${apps.join(', ')}`);
      if (pipelines.length > 0) console.log(`     Pipelines: ${pipelines.slice(0, 3).join(', ')}${pipelines.length > 3 ? '...' : ''}`);
    });
    console.log();
  });
  
  // Get pipeline and app counts for test planning
  const { data: pipelines } = await supabase
    .from('command_pipelines')
    .select('name, status')
    .eq('status', 'active');
    
  console.log(`🔧 CLI TESTING SCOPE:`);
  console.log(`   Active pipelines: ${pipelines?.length || 0}`);
  
  const apps = ['dhg-hub', 'dhg-hub-lovable', 'dhg-audio', 'dhg-admin-code', 'dhg-admin-google', 'dhg-admin-suite', 'dhg-research'];
  console.log(`📱 APP TESTING SCOPE:`);
  console.log(`   Apps to test: ${apps.length}`);
  console.log(`   Apps: ${apps.join(', ')}`);
}

if (require.main === module) {
  analyzeServicesForTesting().catch(console.error);
}

export { analyzeServicesForTesting };