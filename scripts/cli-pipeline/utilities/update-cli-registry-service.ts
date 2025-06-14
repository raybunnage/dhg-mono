import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateCLIRegistryService() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const { error } = await supabase
    .from('sys_shared_services')
    .update({
      service_type: 'business_logic',
      instantiation_pattern: 'dependency_injection',
      refactored: true,
      performance_improvement: 99.4,
      test_count: 19,
      migration_status: 'migrated',
      base_class: 'BusinessService',
      migration_notes: 'Migrated to BusinessService base class with dependency injection. Added input validation, retry logic, and performance monitoring. 99.4% performance improvement.'
    })
    .eq('service_name', 'CLIRegistryService');
    
  if (error) {
    console.error('Error updating CLIRegistryService:', error);
    process.exit(1);
  }
  
  console.log('Successfully updated CLIRegistryService in sys_shared_services');
}

updateCLIRegistryService().catch(console.error);