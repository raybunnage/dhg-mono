/**
 * Database Update Script for GitOperationsService
 * 
 * Updates the sys_shared_services table with GitOperationsService information
 */

import { SupabaseClientService } from '../supabase-client-refactored/index.js';

async function updateGitOperationsServiceDatabase() {
  console.log('📝 Updating database with GitOperationsService information...');
  
  try {
    const supabase = await SupabaseClientService.getInstance().getClient();
    
    // First, check if the service already exists
    const { data: existingService, error: checkError } = await supabase
      .from('sys_shared_services')
      .select('*')
      .eq('service_name', 'GitOperationsService')
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw checkError;
    }
    
    const serviceData = {
      service_name: 'GitOperationsService',
      service_type: 'Infrastructure',
      base_class: 'SingletonService',
      file_path: 'packages/shared/services/git-operations/GitOperationsService.ts',
      description: 'Singleton service for git operations including worktrees, branches, commits, and merges with caching and health monitoring',
      dependencies: ['Logger (optional)'],
      dependency_injection: false,
      singleton_pattern: true,
      health_checks: true,
      metrics_tracking: true,
      caching: true,
      error_handling: true,
      logging: true,
      status: 'active',
      usage_locations: 0, // Will be updated when services start using it
      last_updated: new Date().toISOString(),
      notes: 'Migrated from standalone class to SingletonService. Provides comprehensive git operations with caching, metrics, and health monitoring. Handles worktrees, branches, commits, status checks, and merge operations.',
      breaking_changes: true,
      migration_required: true,
      api_stable: true
    };
    
    if (existingService) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('sys_shared_services')
        .update(serviceData)
        .eq('service_name', 'GitOperationsService');
      
      if (updateError) {
        throw updateError;
      }
      
      console.log('✅ Updated existing GitOperationsService record in database');
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('sys_shared_services')
        .insert(serviceData);
      
      if (insertError) {
        throw insertError;
      }
      
      console.log('✅ Inserted new GitOperationsService record in database');
    }
    
    // Verify the record was created/updated
    const { data: verifyData, error: verifyError } = await supabase
      .from('sys_shared_services')
      .select('*')
      .eq('service_name', 'GitOperationsService')
      .single();
    
    if (verifyError) {
      throw verifyError;
    }
    
    console.log('📊 GitOperationsService database record:');
    console.log('   Service Name:', verifyData.service_name);
    console.log('   Service Type:', verifyData.service_type);
    console.log('   Base Class:', verifyData.base_class);
    console.log('   Singleton Pattern:', verifyData.singleton_pattern);
    console.log('   Health Checks:', verifyData.health_checks);
    console.log('   Metrics Tracking:', verifyData.metrics_tracking);
    console.log('   Caching:', verifyData.caching);
    console.log('   Status:', verifyData.status);
    console.log('   Last Updated:', verifyData.last_updated);
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to update database:', error);
    return false;
  }
}

// Run the update if called directly
if (require.main === module) {
  updateGitOperationsServiceDatabase()
    .then((success) => {
      if (success) {
        console.log('🎉 Database update completed successfully');
        process.exit(0);
      } else {
        console.error('💥 Database update failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Database update failed:', error);
      process.exit(1);
    });
}

export { updateGitOperationsServiceDatabase };