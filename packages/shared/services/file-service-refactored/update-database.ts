/**
 * Update database record for FileService migration
 */

import { SupabaseClientService } from '../../supabase-client';

async function updateDatabaseRecord() {
  console.log('Updating FileService migration record...');
  
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const now = new Date().toISOString();
    
    // Update the service record
    const { data, error } = await supabase
      .from('sys_shared_services')
      .update({
        migration_status: 'completed',
        migration_completed_at: now,
        service_path: 'file-service-refactored/',
        migration_notes: 'Refactored to extend SingletonService, added metrics, health checks, resource management, and comprehensive file/Google Drive operations',
        base_class_type: 'SingletonService',
        service_type: 'infrastructure',
        instantiation_pattern: 'singleton',
        requires_initialization: true,
        breaking_changes: true,
        breaking_changes_description: 'Export pattern changed from direct instance export to getInstance() method',
        updated_at: now
      })
      .eq('service_name', 'FileService')
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
      service_type: data.service_type,
      breaking_changes: data.breaking_changes
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