#!/usr/bin/env ts-node

/**
 * Check for duplicate services in the registry
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate services in registry...\n');
  
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
  
  // Group by service name to find duplicates
  const grouped: { [key: string]: any[] } = {};
  data.forEach((service: any) => {
    const name = service.service_name;
    if (!grouped[name]) {
      grouped[name] = [];
    }
    grouped[name].push(service);
  });
  
  // Find duplicates
  const duplicates = Object.entries(grouped).filter(([name, services]) => services.length > 1);
  
  console.log(`📊 Total services: ${data.length}`);
  console.log(`🔀 Duplicate groups: ${duplicates.length}\n`);
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicate services found!');
    return;
  }
  
  console.log('❌ Found duplicate services:');
  duplicates.forEach(([name, services]) => {
    console.log(`\n**${name}** (${services.length} entries):`);
    services.forEach((service, index) => {
      const apps = service.used_by_apps ? service.used_by_apps.length : 0;
      console.log(`  ${index + 1}. ID: ${service.id} | Apps: ${apps} | Created: ${new Date(service.created_at).toLocaleDateString()}`);
    });
  });
  
  // Show removal summary
  console.log('\n📋 Services to remove (based on SERVICE_CLEANUP_SUMMARY.md):');
  const toRemove = [
    'GoogleDriveService', 'GoogleDriveExplorer', 'GoogleSyncService', // Keep GoogleDrive
    'LightAuthEnhancedService', // Keep LightAuthService
    'PdfProcessor', 'PDFProcessorService', // Keep PdfProcessorService
    'PromptManagementService' // Keep PromptService
  ];
  
  toRemove.forEach(serviceName => {
    const service = data.find((s: any) => s.service_name === serviceName);
    if (service) {
      console.log(`  - ${serviceName} (ID: ${service.id})`);
    } else {
      console.log(`  ✅ ${serviceName} (already removed)`);
    }
  });
}

checkDuplicates().catch(console.error);