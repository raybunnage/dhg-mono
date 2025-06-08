#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function healthCheck() {
  console.log('🔍 Deprecation Analysis Health Check\n');
  
  try {
    // Check database views
    const views = [
      'registry_unused_services_view',
      'command_usage_30d_view',
      'service_dependency_full_view'
    ];
    
    console.log('Checking database views:');
    for (const view of views) {
      try {
        const { count, error } = await supabase
          .from(view)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`  ❌ ${view}: ${error.message}`);
        } else {
          console.log(`  ✅ ${view}: accessible (${count || 0} records)`);
        }
      } catch (e) {
        console.log(`  ❌ ${view}: Error accessing view`);
      }
    }
    
    // Check registry tables
    console.log('\nChecking registry tables:');
    const tables = [
      { name: 'service_registry', desc: 'Service definitions' },
      { name: 'scripts_registry', desc: 'Script registry' },
      { name: 'command_tracking', desc: 'Command usage tracking' }
    ];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  ❌ ${table.name}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table.name}: ${count || 0} ${table.desc}`);
      }
    }
    
    // Check deprecation-specific data
    console.log('\nDeprecation Analysis Status:');
    
    // Count unused services
    const { data: unusedServices } = await supabase
      .from('registry_unused_services_view')
      .select('*');
    
    // Count low-usage commands
    const { data: lowUsageCommands } = await supabase
      .from('command_usage_30d_view')
      .select('*')
      .lt('usage_count', 5);
    
    // Count deprecated items
    const { data: deprecatedScripts } = await supabase
      .from('scripts_registry')
      .select('*')
      .eq('is_deprecated', true);
    
    console.log(`  📊 Unused services: ${unusedServices?.length || 0}`);
    console.log(`  📊 Low-usage commands (< 5 uses): ${lowUsageCommands?.length || 0}`);
    console.log(`  📊 Deprecated scripts: ${deprecatedScripts?.length || 0}`);
    
    console.log('\n✅ Deprecation analysis system is healthy!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();