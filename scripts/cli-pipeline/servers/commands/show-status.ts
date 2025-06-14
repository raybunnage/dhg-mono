#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');
const { Table } = require('console-table-printer');

async function showServerStatus() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    const { data: servers, error } = await supabase
      .from('sys_server_ports_registry')
      .select('*')
      .eq('environment', process.env.NODE_ENV || 'development')
      .order('port');
      
    if (error) {
      console.error('Error fetching server status:', error);
      process.exit(1);
    }
    
    if (!servers || servers.length === 0) {
      console.log('No servers registered. Run "pnpm servers" to start servers.');
      return;
    }
    
    const table = new Table({
      columns: [
        { name: 'service', title: 'Service', alignment: 'left' },
        { name: 'port', title: 'Port', alignment: 'center' },
        { name: 'status', title: 'Status', alignment: 'center' },
        { name: 'health', title: 'Health', alignment: 'center' },
        { name: 'url', title: 'URL', alignment: 'left' },
        { name: 'last_check', title: 'Last Check', alignment: 'left' }
      ]
    });
    
    servers.forEach((server: any) => {
      const statusColor = server.status === 'active' ? 'green' : 'red';
      const healthColor = server.last_health_status === 'healthy' ? 'green' : 
                         server.last_health_status === 'unhealthy' ? 'red' : 'yellow';
      
      table.addRow({
        service: server.display_name || server.service_name,
        port: server.port,
        status: server.status,
        health: server.last_health_status || 'unknown',
        url: `${server.protocol}://${server.host}:${server.port}${server.base_path}`,
        last_check: server.last_health_check ? 
          new Date(server.last_health_check).toLocaleTimeString() : 'Never'
      }, {
        color: server.status === 'active' ? 'green' : 'red'
      });
    });
    
    table.printTable();
    
    // Summary
    const activeCount = servers.filter((s: any) => s.status === 'active').length;
    const healthyCount = servers.filter((s: any) => s.last_health_status === 'healthy').length;
    
    console.log(`\n📊 Summary: ${activeCount}/${servers.length} active, ${healthyCount}/${activeCount} healthy`);
    
    if (activeCount < servers.length) {
      console.log('\n💡 Tip: Run "pnpm servers" to start all servers');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

showServerStatus();