#!/usr/bin/env ts-node

/**
 * Check status of services mentioned in SERVICE_CLEANUP_SUMMARY.md
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

async function checkCleanupStatus() {
  console.log('🔍 Checking cleanup status based on SERVICE_CLEANUP_SUMMARY.md...\n');
  
  const { data, error } = await supabase
    .from('sys_shared_services')
    .select('service_name, id, used_by_apps, created_at')
    .order('service_name');
  
  if (error) {
    console.error('Error fetching services:', error);
    return;
  }
  
  if (!data) {
    console.log('No services found');
    return;
  }
  
  // Services that should be KEPT according to cleanup summary
  const shouldKeep = [
    'GoogleDrive',
    'GoogleDriveExplorer', 
    'GoogleSyncService',
    'LightAuthService',
    'PdfProcessorService',
    'PromptService',
    'SupabaseClient',
    'SupabaseAdapter'
  ];
  
  // Services that should be REMOVED according to cleanup summary
  const shouldRemove = [
    'GoogleDriveService',
    'LightAuthEnhancedService', 
    'PdfProcessor',
    'PDFProcessorService',
    'PromptManagementService'
  ];
  
  console.log('✅ Services that SHOULD be kept:');
  shouldKeep.forEach(serviceName => {
    const service = data.find((s: any) => s.service_name === serviceName);
    if (service) {
      const apps = service.used_by_apps ? service.used_by_apps.length : 0;
      console.log(`  ✅ ${serviceName} (ID: ${service.id}, Apps: ${apps})`);
    } else {
      console.log(`  ❌ ${serviceName} (MISSING - should exist!)`);
    }
  });
  
  console.log('\n❌ Services that SHOULD be removed:');
  shouldRemove.forEach(serviceName => {
    const service = data.find((s: any) => s.service_name === serviceName);
    if (service) {
      const apps = service.used_by_apps ? service.used_by_apps.length : 0;
      console.log(`  ❌ ${serviceName} (ID: ${service.id}, Apps: ${apps}) - STILL EXISTS`);
    } else {
      console.log(`  ✅ ${serviceName} (correctly removed)`);
    }
  });
  
  // Check for any remaining Google/PDF/Auth/Prompt duplicates
  console.log('\n🔍 Checking for pattern-based duplicates:');
  
  const patterns = [
    { pattern: 'Google', services: data.filter((s: any) => s.service_name.includes('Google')) },
    { pattern: 'PDF/Pdf', services: data.filter((s: any) => s.service_name.toLowerCase().includes('pdf')) },
    { pattern: 'Auth', services: data.filter((s: any) => s.service_name.includes('Auth')) },
    { pattern: 'Prompt', services: data.filter((s: any) => s.service_name.includes('Prompt')) },
    { pattern: 'Supabase', services: data.filter((s: any) => s.service_name.includes('Supabase')) }
  ];
  
  patterns.forEach(({ pattern, services }) => {
    if (services.length > 0) {
      console.log(`\n${pattern} services (${services.length}):`);
      services.forEach((service: any) => {
        const apps = service.used_by_apps ? service.used_by_apps.length : 0;
        console.log(`  - ${service.service_name} (Apps: ${apps})`);
      });
    }
  });
  
  console.log(`\n📊 Total services in registry: ${data.length}`);
}

checkCleanupStatus().catch(console.error);