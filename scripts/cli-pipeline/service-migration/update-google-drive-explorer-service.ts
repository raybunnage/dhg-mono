import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateGoogleDriveExplorerService() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const serviceData = {
    service_name: 'GoogleDriveExplorerService',
    service_path: 'packages/shared/services/google-drive-explorer/',
    service_type: 'business',
    instantiation_pattern: 'dependency_injection',
    category: 'google',
    is_singleton: false,
    environment_support: ['both'],
    base_class_type: 'BusinessService',
    migration_status: 'completed',
    migration_notes: 'Migrated from simple constructor injection to BusinessService with comprehensive features. Added caching, search capabilities, tree building, duplicate detection, and performance monitoring.',
    has_tests: true,
    test_coverage_percent: 85,
    description: 'Provides recursive search and exploration functionality for Google Drive files',
    dependencies: ['@supabase/supabase-js'],
    usage_count: 0, // Will be updated by usage scan
    breaking_changes: false,
    backwards_compatible: true
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
    console.error('Error updating GoogleDriveExplorerService:', error);
    return;
  }

  console.log('✅ Updated GoogleDriveExplorerService in sys_shared_services');
  console.log('Service details:', data);
}

updateGoogleDriveExplorerService().catch(console.error);