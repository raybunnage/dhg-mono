#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const UNUSED_SERVICES = [
  'SupabaseCache',
  'supabase-helpers',
  'SupabaseHelpers'
];

async function main() {
  console.log('🧹 Removing Unused Supabase Services');
  console.log('====================================\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First, verify these services have zero usage
  console.log('Verifying services have zero usage...');
  
  for (const service of UNUSED_SERVICES) {
    const { data, error } = await supabase
      .from('sys_shared_services')
      .select('service_name, usage_count')
      .eq('service_name', service)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error(`❌ Error checking ${service}:`, error.message);
      continue;
    }
    
    if (data) {
      console.log(`  ${service}: ${data.usage_count || 0} references`);
      
      if (data.usage_count > 0) {
        console.log(`  ⚠️  Skipping ${service} - has ${data.usage_count} references`);
        continue;
      }
      
      // Delete the service
      const { error: deleteError } = await supabase
        .from('sys_shared_services')
        .delete()
        .eq('service_name', service);
        
      if (deleteError) {
        console.error(`  ❌ Failed to delete ${service}:`, deleteError.message);
      } else {
        console.log(`  ✅ Deleted ${service}`);
      }
    } else {
      console.log(`  ℹ️  ${service} not found in database`);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
}

main().catch(error => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});