import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function testSysSharedServices() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Querying sys_shared_services table...');
  
  const { data, error } = await supabase
    .from('sys_shared_services')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error querying sys_shared_services:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('\nColumn names in sys_shared_services:');
    const columnNames = Object.keys(data[0]);
    columnNames.forEach(col => {
      console.log(`- ${col}`);
    });
    
    console.log('\nFirst row data:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data found in sys_shared_services table');
  }
}

testSysSharedServices().catch(console.error);