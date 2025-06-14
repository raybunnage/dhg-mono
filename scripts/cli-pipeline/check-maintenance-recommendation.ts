import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function checkMaintenanceRecommendation() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get distinct values
  const { data, error } = await supabase
    .from('sys_shared_services')
    .select('service_name, maintenance_recommendation')
    .not('maintenance_recommendation', 'is', null)
    .limit(20);
  
  if (error) {
    console.error('Error querying:', error);
    return;
  }
  
  console.log('Existing maintenance_recommendation values:');
  const uniqueValues = new Set<string>();
  data?.forEach(row => {
    console.log(`- ${row.service_name}: ${row.maintenance_recommendation}`);
    if (row.maintenance_recommendation) {
      uniqueValues.add(row.maintenance_recommendation);
    }
  });
  
  console.log('\nUnique values:');
  Array.from(uniqueValues).sort().forEach(value => {
    console.log(`- ${value}`);
  });
}

checkMaintenanceRecommendation().catch(console.error);