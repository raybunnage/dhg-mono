import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateGoogleDriveSyncService() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const serviceData = {
    service_name: 'GoogleDriveSyncService',
    service_path: 'packages/shared/services/google-drive/google-drive-sync-service.ts',
    service_type: 'business',
    instantiation_pattern: 'dependency_injection',
    category: 'google',
    is_singleton: false,
    environment_support: ['node'],
    base_class_type: 'BusinessService',
    migration_status: 'completed',
    migration_notes: 'Migrated from flawed singleton pattern to BusinessService with proper dependency injection. Added incremental sync, change detection, batch processing, path caching, conflict resolution, progress tracking, and cleanup functionality. Fixed getInstance parameter anti-pattern.',
    has_tests: false,
    test_coverage_percent: 0,
    description: 'Handles synchronization between Google Drive and Supabase with comprehensive sync capabilities',
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
    console.error('Error updating GoogleDriveSyncService:', error);
    return;
  }

  console.log('✅ Updated GoogleDriveSyncService in sys_shared_services');
  console.log('Service details:', data);
}

updateGoogleDriveSyncService().catch(console.error);