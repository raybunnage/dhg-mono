#!/usr/bin/env ts-node

/**
 * Update Service Test Metadata
 * Updates the sys_shared_services table with metadata about the dhg-service-test app
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateServiceTestMetadata() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Updating dhg-service-test metadata in sys_shared_services...');
  
  const metadata = {
    service_name: 'dhg-service-test',
    service_name_normalized: 'dhg-service-test',
    service_path: 'apps/dhg-service-test/',
    category: 'testing',
    description: 'Service testing and evaluation application for identifying consolidation opportunities',
    status: 'active',
    is_singleton: false,
    environment_support: ['browser'],
    environment_type: 'browser',
    has_browser_variant: false,
    has_tests: true,
    exports: {
      components: ['TestSupabaseServices', 'ServiceStatus'],
      features: ['Service health checks', 'Performance metrics', 'Consolidation analysis']
    },
    dependencies: {
      internal: ['SupabaseClientService', 'SupabaseService', 'createSupabaseAdapter'],
      external: ['react', '@supabase/supabase-js']
    },
    usage_notes: 'Test application for evaluating service patterns and identifying consolidation opportunities',
    maintenance_recommendation: 'Keep as reference for service testing patterns',
    consolidation_candidate: false,
    service_health: 'healthy',
    test_coverage: 90,
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('sys_shared_services')
    .upsert(metadata, {
      onConflict: 'service_name'
    })
    .select();
    
  if (error) {
    console.error('Error updating metadata:', error);
    return;
  }
  
  console.log('Successfully updated dhg-service-test metadata');
  console.log('Record:', data?.[0]);
}

// Run the update
updateServiceTestMetadata().catch(console.error);