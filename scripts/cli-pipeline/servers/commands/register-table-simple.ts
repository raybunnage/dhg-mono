#!/usr/bin/env ts-node

// Use require for CommonJS compatibility in CLI context
const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');

async function registerServerRegistryTable() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check if table exists
    const { data: tableTest } = await supabase
      .from('sys_server_ports_registry')
      .select('service_name')
      .limit(1);
      
    console.log('✅ sys_server_ports_registry table exists');
    
    // Check if in sys_table_definitions
    const { data: definition, error: fetchError } = await supabase
      .from('sys_table_definitions')
      .select('*')
      .eq('table_name', 'sys_server_ports_registry')
      .single();
      
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking definitions:', fetchError);
      process.exit(1);
    }
      
    if (definition) {
      console.log('✅ Already registered in sys_table_definitions');
    } else {
      console.log('📝 Registering in sys_table_definitions...');
      
      const { error: insertError } = await supabase
        .from('sys_table_definitions')
        .insert({
          table_schema: 'public',
          table_name: 'sys_server_ports_registry',
          description: 'Dynamic server port registry for frontend service discovery',
          purpose: 'Allows UI components to discover backend service ports at runtime instead of hardcoding them',
          created_date: '2025-06-10'
        });
        
      if (insertError) {
        console.error('Error adding to definitions:', insertError);
        process.exit(1);
      } else {
        console.log('✅ Successfully registered in sys_table_definitions');
      }
    }
    
    // Also check the view
    const { data: viewDef, error: viewError } = await supabase
      .from('sys_table_definitions')
      .select('*')  
      .eq('table_name', 'sys_active_servers_view')
      .single();
      
    if (viewError && viewError.code !== 'PGRST116') {
      console.error('Error checking view definition:', viewError);
    }
    
    if (!viewDef) {
      console.log('📝 Registering view in sys_table_definitions...');
      
      const { error: viewInsertError } = await supabase
        .from('sys_table_definitions')
        .insert({
          table_schema: 'public',
          table_name: 'sys_active_servers_view',
          description: 'Active servers view for frontend access',
          purpose: 'Provides simplified access to active servers for UI components',
          created_date: '2025-06-10'
        });
        
      if (viewInsertError) {
        console.error('Error adding view to definitions:', viewInsertError);
      } else {
        console.log('✅ Successfully registered sys_active_servers_view');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

registerServerRegistryTable();