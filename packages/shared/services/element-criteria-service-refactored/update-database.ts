import { SupabaseClientService } from '../supabase-client';

async function updateElementCriteriaServiceRecord() {
  try {
    console.log('Connecting to Supabase...');
    const supabase = SupabaseClientService.getInstance().getClient();

    console.log('Updating ElementCriteriaService record in sys_shared_services...');
    
    const { data, error } = await supabase
      .from('sys_shared_services')
      .update({
        migration_status: 'completed',
        service_path: 'element-criteria-service-refactored/',
        base_class_type: 'BusinessService',
        service_type: 'business',
        instantiation_pattern: 'dependency_injection',
        updated_at: new Date().toISOString()
      })
      .eq('service_name', 'ElementCriteriaService')
      .select();

    if (error) {
      console.error('❌ Database update failed:', error);
      throw new Error(`Failed to update record: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.error('❌ No records found for ElementCriteriaService');
      throw new Error('No records found to update');
    }

    console.log('✅ Successfully updated ElementCriteriaService record:');
    console.log(JSON.stringify(data[0], null, 2));
    
    return data[0];
  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  }
}

// Run the update
updateElementCriteriaServiceRecord()
  .then(() => {
    console.log('\n🎉 Database update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database update failed:', error);
    process.exit(1);
  });