import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function analyzeSharedServices() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all shared services
  const { data: services, error } = await supabase
    .from('sys_shared_services')
    .select('*')
    .order('category', { ascending: true })
    .order('service_name', { ascending: true });
    
  if (error) {
    console.error('Error fetching services:', error);
    return;
  }
  
  console.log(`\n=== SHARED SERVICES ANALYSIS ===`);
  console.log(`Total Services: ${services?.length || 0}`);
  
  // Group by category
  const byCategory: Record<string, any[]> = {};
  services?.forEach(service => {
    if (!byCategory[service.category]) {
      byCategory[service.category] = [];
    }
    byCategory[service.category].push(service);
  });
  
  console.log(`\nCategories: ${Object.keys(byCategory).length}`);
  
  // Show services by category
  Object.entries(byCategory).forEach(([category, categoryServices]) => {
    console.log(`\n📁 ${category.toUpperCase()} (${categoryServices.length} services)`);
    categoryServices.forEach(service => {
      const apps = service.used_by_apps?.length || 0;
      const pipelines = service.used_by_pipelines?.length || 0;
      const usage = apps + pipelines;
      
      let status = '✅';
      if (usage === 0) status = '❌ UNUSED';
      else if (usage === 1) status = '⚠️  LOW USE';
      else if (usage >= 3) status = '🔥 HIGH USE';
      
      console.log(`  ${status} ${service.service_name}`);
      console.log(`     ${service.description}`);
      console.log(`     Usage: ${apps} apps, ${pipelines} pipelines`);
      if (service.used_by_apps?.length > 0) {
        console.log(`     Apps: ${service.used_by_apps.join(', ')}`);
      }
      if (service.used_by_pipelines?.length > 0) {
        console.log(`     Pipelines: ${service.used_by_pipelines.join(', ')}`);
      }
      console.log(`     Status: ${service.status} | Singleton: ${service.is_singleton}`);
    });
  });
  
  // Usage analysis
  console.log(`\n=== USAGE ANALYSIS ===`);
  const unused = services?.filter(s => (s.used_by_apps?.length || 0) + (s.used_by_pipelines?.length || 0) === 0) || [];
  const lowUse = services?.filter(s => (s.used_by_apps?.length || 0) + (s.used_by_pipelines?.length || 0) === 1) || [];
  const highUse = services?.filter(s => (s.used_by_apps?.length || 0) + (s.used_by_pipelines?.length || 0) >= 3) || [];
  
  console.log(`❌ Unused Services: ${unused.length}`);
  unused.forEach(s => console.log(`   - ${s.service_name}`));
  
  console.log(`⚠️  Low Usage Services: ${lowUse.length}`);
  lowUse.forEach(s => console.log(`   - ${s.service_name}`));
  
  console.log(`🔥 High Usage Services: ${highUse.length}`);
  highUse.forEach(s => console.log(`   - ${s.service_name}`));
  
  // Category gaps analysis
  console.log(`\n=== POTENTIAL GAPS ===`);
  const commonCategories = [
    'Authentication', 'Database', 'File Management', 'Git Management',
    'Utilities', 'System', 'Task Management', 'Work Tracking',
    'Media Processing', 'Document Processing', 'API Clients',
    'State Management', 'Notification', 'Validation', 'Configuration'
  ];
  
  const existingCategories = Object.keys(byCategory);
  const missingCategories = commonCategories.filter(cat => 
    !existingCategories.some(existing => 
      existing.toLowerCase().includes(cat.toLowerCase()) || 
      cat.toLowerCase().includes(existing.toLowerCase())
    )
  );
  
  if (missingCategories.length > 0) {
    console.log(`Missing categories that might indicate opportunities:`);
    missingCategories.forEach(cat => console.log(`   - ${cat}`));
  } else {
    console.log(`✅ All common service categories are covered`);
  }
}

analyzeSharedServices().catch(console.error);