import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function checkEnvironmentType() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get a sample row to see what values exist
  console.log('Checking existing environment_type values...');
  
  const { data, error } = await supabase
    .from('sys_shared_services')
    .select('service_name, environment_type')
    .not('environment_type', 'is', null)
    .limit(10);
  
  if (error) {
    console.error('Error querying:', error);
    return;
  }
  
  console.log('\nExisting environment_type values:');
  data?.forEach(row => {
    console.log(`- ${row.service_name}: ${row.environment_type}`);
  });
  
  // Get distinct values
  const { data: distinct, error: distinctError } = await supabase
    .rpc('execute_sql', {
      query: "SELECT DISTINCT environment_type FROM sys_shared_services WHERE environment_type IS NOT NULL ORDER BY environment_type"
    });
  
  if (!distinctError && distinct) {
    console.log('\nDistinct environment_type values:');
    console.log(distinct);
  }
}

checkEnvironmentType().catch(console.error);