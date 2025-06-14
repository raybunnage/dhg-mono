import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateCLIRegistryService() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const serviceData = {
    service_name: 'CLIRegistryService',
    service_path: 'packages/shared/services/cli-registry-service',
    service_type: 'business',
    instantiation_pattern: 'dependency_injection',
    category: 'business',
    is_singleton: false,
    environment_support: ['both'],
    base_class_type: 'BusinessService',
    migration_status: 'completed',
    migration_notes: 'Migrated to BusinessService base class with dependency injection. Added input validation, retry logic, and performance monitoring. 99.4% performance improvement.',
    has_tests: true,
    test_coverage_percent: 95,
    description: 'Manages CLI command registry, pipelines, and command definitions',
    dependencies: ['@supabase/supabase-js'],
    used_by_pipelines: ['all_pipelines'],
    usage_count: 1,
    usage_locations: [
      'scripts/cli-pipeline/all_pipelines/scan-cli-pipelines.ts'
    ]
  };

  const { data, error } = await supabase
    .from('sys_shared_services')
    .upsert(serviceData, { 
      onConflict: 'service_name',
      ignoreDuplicates: false 
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating CLIRegistryService:', error);
    return;
  }

  console.log('✅ Updated CLIRegistryService in sys_shared_services');
  console.log('Service details:', data);
}

updateCLIRegistryService().catch(console.error);