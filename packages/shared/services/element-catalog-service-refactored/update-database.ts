/**
 * Update database record for ElementCatalogService migration
 */

import { SupabaseClientService } from '../../supabase-client';

async function updateDatabaseRecord() {
  console.log('Updating ElementCatalogService migration record...');
  
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const now = new Date().toISOString();
    
    // Update the service record
    const { data, error } = await supabase
      .from('sys_shared_services')
      .update({
        migration_status: 'completed',
        migration_completed_at: now,
        service_path: 'element-catalog-service-refactored/',
        migration_notes: 'Refactored to extend BusinessService with dependency injection, added metrics, health checks, and transaction support',
        base_class_type: 'BusinessService',
        service_type: 'business',
        instantiation_pattern: 'dependency_injection',
        requires_initialization: true,
        updated_at: now
      })
      .eq('service_name', 'ElementCatalogService')
      .select()
      .single();
    
    if (error) {
      console.error('Error updating database:', error);
      process.exit(1);
    }
    
    console.log('✅ Database record updated successfully');
    console.log('Updated record:', {
      service_name: data.service_name,
      migration_status: data.migration_status,
      base_class_type: data.base_class_type,
      service_type: data.service_type
    });
    
  } catch (error) {
    console.error('Failed to update database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateDatabaseRecord()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { updateDatabaseRecord };