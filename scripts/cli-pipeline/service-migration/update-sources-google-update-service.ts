import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateSourcesGoogleUpdateService() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const serviceData = {
    service_name: 'SourcesGoogleUpdateService',
    service_path: 'packages/shared/services/google-drive/sources-google-update-service.ts',
    service_type: 'business',
    instantiation_pattern: 'dependency_injection',
    category: 'google',
    is_singleton: false,
    environment_support: ['node'],
    base_class_type: 'BusinessService',
    migration_status: 'completed',
    migration_notes: 'Migrated from flawed singleton pattern to BusinessService with proper dependency injection. Added batch processing, conflict resolution, sync from Google Drive, queued updates, and comprehensive retry logic. Fixed getInstance parameter anti-pattern.',
    has_tests: false,
    test_coverage_percent: 0,
    description: 'Updates Google Drive metadata in sources_google table with batch processing and sync capabilities',
    dependencies: ['@supabase/supabase-js'],
    usage_count: 0, // Will be updated by usage scan
    breaking_changes: true,
    backwards_compatible: false
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
    console.error('Error updating SourcesGoogleUpdateService:', error);
    return;
  }

  console.log('✅ Updated SourcesGoogleUpdateService in sys_shared_services');
  console.log('Service details:', data);
}

updateSourcesGoogleUpdateService().catch(console.error);