#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');

async function listServers() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    const { data: servers, error } = await supabase
      .from('sys_server_ports_registry')
      .select('*')
      .order('service_name');
      
    if (error) {
      console.error('Error listing servers:', error);
      process.exit(1);
    }
    
    if (!servers || servers.length === 0) {
      console.log('No servers registered yet.');
      return;
    }
    
    console.log('\n📋 Registered Servers:\n');
    servers.forEach((server: any) => {
      console.log(`${server.service_name} (${server.display_name})`);
      console.log(`  Port: ${server.port}`);
      console.log(`  Status: ${server.status}`);
      console.log(`  Description: ${server.description}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

listServers();