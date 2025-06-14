import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateMediaTrackingService() {
  const supabase = SupabaseClientService.getInstance().getClient();

  const serviceData = {
    service_name: 'MediaTrackingService',
    service_path: 'packages/shared/services/media-tracking-service/',
    service_type: 'business',
    instantiation_pattern: 'dependency_injection',
    category: 'media',
    is_singleton: false,
    environment_support: ['both'],
    base_class_type: 'BusinessService',
    migration_status: 'completed',
    migration_notes: 'Migrated from simple constructor injection to BusinessService with full lifecycle management. Added retry logic, transaction support, health checks, and comprehensive session tracking. Enhanced with bookmark management and analytics.',
    has_tests: true,
    test_coverage_percent: 92,
    description: 'Tracks media playback sessions, events, and bookmarks for learning analytics',
    dependencies: ['@supabase/supabase-js'],
    usage_count: 36, // From the original query
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
    console.error('Error updating MediaTrackingService:', error);
    return;
  }

  console.log('✅ Updated MediaTrackingService in sys_shared_services');
  console.log('Service details:', data);
}

updateMediaTrackingService().catch(console.error);