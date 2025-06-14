#!/usr/bin/env ts-node

/**
 * Apply the service cleanup directly to remove duplicate services
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

async function applyServiceCleanup() {
  console.log('🧹 Applying service cleanup to remove duplicates...\n');
  
  // Services to remove based on SERVICE_CLEANUP_SUMMARY.md
  const servicesToRemove = [
    'GoogleDriveService',           // Keep GoogleDrive instead
    'LightAuthEnhancedService',     // Keep LightAuthService instead  
    'PDFProcessorService',          // Keep PdfProcessorService instead
    'PromptManagementService',      // Keep PromptService instead
    'GoogleDriveExplorerService',   // Keep GoogleDriveExplorer instead
    'GoogleDriveBrowserService',    // Keep GoogleDrive instead
    'GoogleDriveSyncService',       // Keep GoogleSyncService instead
    'SupabaseClientService',        // Keep SupabaseClient instead
    'SupabaseClientAdapter',        // Keep SupabaseAdapter instead
    'SupabaseService',              // Keep SupabaseClient instead
    'getBrowserAuthService'         // Keep AuthService instead
  ];
  
  console.log(`🎯 Target services to remove (${servicesToRemove.length}):`);
  servicesToRemove.forEach(service => console.log(`  - ${service}`));
  console.log('');
  
  // Check which services actually exist
  const { data: existing, error: fetchError } = await supabase
    .from('sys_shared_services')
    .select('service_name, id')
    .in('service_name', servicesToRemove);
  
  if (fetchError) {
    console.error('❌ Error fetching services:', fetchError);
    return;
  }
  
  if (!existing || existing.length === 0) {
    console.log('✅ All target services have already been removed!');
    return;
  }
  
  console.log(`📋 Found ${existing.length} services to remove:`);
  existing.forEach((service: any) => {
    console.log(`  - ${service.service_name} (ID: ${service.id})`);
  });
  console.log('');
  
  // Remove the services
  const { error: deleteError } = await supabase
    .from('sys_shared_services')
    .delete()
    .in('service_name', servicesToRemove);
  
  if (deleteError) {
    console.error('❌ Error removing services:', deleteError);
    return;
  }
  
  console.log(`✅ Successfully removed ${existing.length} duplicate services`);
  
  // Log the change
  const { error: logError } = await supabase
    .from('sys_database_change_events')
    .insert({
      event_type: 'cleanup',
      table_name: 'sys_shared_services',
      description: 'Completed service cleanup removing duplicate services',
      change_details: {
        removed_services: servicesToRemove,
        removed_count: existing.length,
        reason: 'Remove duplicates as specified in SERVICE_CLEANUP_SUMMARY.md'
      }
    });
  
  if (logError) {
    console.warn('⚠️ Warning: Could not log change event:', logError.message);
  } else {
    console.log('📝 Change logged to database');
  }
  
  // Show final count
  const { data: finalCount, error: countError } = await supabase
    .from('sys_shared_services')
    .select('service_name', { count: 'exact', head: true });
  
  if (!countError) {
    console.log(`\n📊 Total services remaining: ${finalCount?.length || 'unknown'}`);
  }
}

applyServiceCleanup().catch(console.error);