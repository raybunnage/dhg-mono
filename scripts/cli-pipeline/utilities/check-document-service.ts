import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkDocumentService() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check for DocumentService in sys_shared_services
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .or('service_name.ilike.%DocumentService%,service_name.ilike.%document-service%')
      .order('service_name');
    
    if (error) {
      console.error('Database error:', error);
      return;
    }
    
    console.log('\n=== DocumentService Search Results ===');
    if (!services || services.length === 0) {
      console.log('No services found with "DocumentService" in the name');
    } else {
      services.forEach((service: any, index: number) => {
        console.log(`\n${index + 1}. ${service.service_name}`);
        console.log(`   Path: ${service.service_path}`);
        console.log(`   Description: ${service.description}`);
        console.log(`   Usage Count: ${service.usage_count || 0}`);
        console.log(`   Migration Status: ${service.migration_status || 'not started'}`);
      });
    }
    
    // Also check for similar services
    console.log('\n=== Similar Document-Related Services ===');
    const { data: similarServices, error: similarError } = await supabase
      .from('sys_shared_services')
      .select('service_name, service_path, usage_count, migration_status')
      .ilike('service_name', '%document%')
      .order('usage_count', { ascending: false });
    
    if (similarServices && similarServices.length > 0) {
      similarServices.forEach((service: any) => {
        console.log(`- ${service.service_name} (${service.usage_count || 0} uses) - ${service.migration_status || 'not started'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking DocumentService:', error);
    process.exit(1);
  }
}

checkDocumentService();