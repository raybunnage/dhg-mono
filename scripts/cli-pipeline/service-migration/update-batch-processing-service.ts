import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateBatchProcessingService() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const serviceData = {
    service_name: 'BatchProcessingService',
    service_path: 'packages/shared/services/batch-processing-service.ts',
    service_type: 'business',
    instantiation_pattern: 'dependency_injection',
    category: 'utility',
    is_singleton: false,
    environment_support: ['both'],
    base_class_type: 'BusinessService',
    migration_status: 'completed',
    migration_notes: 'Migrated from flawed singleton pattern to BusinessService with proper dependency injection. Added comprehensive retry logic, transaction support, progress tracking, and performance monitoring. Fixed getInstance parameter anti-pattern.',
    has_tests: true,
    test_coverage_percent: 90,
    description: 'Manages batch processing operations with concurrency control and progress tracking',
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
    console.error('Error updating BatchProcessingService:', error);
    return;
  }

  console.log('✅ Updated BatchProcessingService in sys_shared_services');
  console.log('Service details:', data);
}

updateBatchProcessingService().catch(console.error);