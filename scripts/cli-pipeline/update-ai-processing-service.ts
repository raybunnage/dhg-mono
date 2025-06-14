import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

async function updateAIProcessingService() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First check if the service exists
  console.log('Checking if AIProcessingService exists in sys_shared_services...');
  
  const { data: existing, error: fetchError } = await supabase
    .from('sys_shared_services')
    .select('*')
    .eq('service_name', 'AIProcessingService')
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching AIProcessingService:', fetchError);
    return;
  }
  
  const serviceData = {
    service_name: 'AIProcessingService',
    service_path: 'packages/shared/services/ai-processing-service',
    description: 'Provides common AI processing utilities for document analysis, classification, and content extraction using the Claude service',
    category: 'AI Services',
    is_singleton: true,
    has_browser_variant: false,
    dependencies: ['@shared/services/claude-service'],
    exports: ['AIProcessingService', 'aiProcessing'],
    status: 'archived',
    environment_type: 'universal',
    has_tests: false,
    test_coverage_percent: null,
    checklist_compliant: false,
    compliance_issues: ['Service file archived on 20250614'],
    refactoring_notes: 'Archived - functionality may be replaced by specific AI services like document-type-ai-service',
    environment_config: {
      requiresAuth: false,
      supportsNode: true,
      requiresProxy: false,
      supportsBrowser: false
    },
    usage_count: 0,
    service_health: 'deprecated',
    consolidation_candidate: false,
    maintenance_recommendation: 'remove-unused',
    scan_frequency: 'none',
    service_type: 'business',
    instantiation_pattern: 'singleton',
    environment_support: ['both'],
    requires_initialization: false,
    initialization_dependencies: [],
    resource_management: null,
    base_class_type: null,
    migration_status: 'archived',
    migration_notes: 'Archived on 2025-06-14 as part of service cleanup',
    breaking_changes: false,
    backwards_compatible: true
  };
  
  if (existing) {
    console.log('Updating existing AIProcessingService entry...');
    const { data: updated, error: updateError } = await supabase
      .from('sys_shared_services')
      .update(serviceData)
      .eq('id', existing.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating AIProcessingService:', updateError);
    } else {
      console.log('Successfully updated AIProcessingService:', updated);
    }
  } else {
    console.log('Creating new AIProcessingService entry...');
    const { data: created, error: createError } = await supabase
      .from('sys_shared_services')
      .insert(serviceData)
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating AIProcessingService:', createError);
    } else {
      console.log('Successfully created AIProcessingService:', created);
    }
  }
}

updateAIProcessingService().catch(console.error);