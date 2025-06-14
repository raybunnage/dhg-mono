import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkDocumentService() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Query sys_shared_services for any service with 'DocumentService' in the name
    const { data, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .ilike('service_name', '%DocumentService%')
      .order('service_name');
    
    if (error) {
      console.error('Error querying sys_shared_services:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`Found ${data.length} service(s) with 'DocumentService' in the name:\n`);
      
      data.forEach((service, index) => {
        console.log(`${index + 1}. Service Name: ${service.service_name}`);
        console.log(`   Description: ${service.description || 'No description'}`);
        console.log(`   Category: ${service.category}`);
        console.log(`   Status: ${service.status}`);
        console.log(`   Location: ${service.location}`);
        console.log(`   Is Singleton: ${service.is_singleton}`);
        console.log(`   Environment Compatibility: ${service.environment_compatibility}`);
        console.log(`   Dependencies: ${service.dependencies || 'None'}`);
        console.log(`   Date Added: ${new Date(service.date_added).toLocaleDateString()}`);
        console.log('---');
      });
    } else {
      console.log('No services found with "DocumentService" in the name.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDocumentService();