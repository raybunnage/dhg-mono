#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');
const { portsManager } = require('../../../../packages/shared/services/ports-management-service');

async function checkServerHealth() {
  console.log('🏥 Checking health of all registered servers...\n');
  
  const healthStatus = await portsManager.monitorAllServers();
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get server details
  const { data: servers } = await supabase
    .from('sys_server_ports_registry')
    .select('*')
    .eq('environment', process.env.NODE_ENV || 'development')
    .order('port');
    
  if (!servers || servers.length === 0) {
    console.log('No servers registered.');
    return;
  }
  
  let healthyCount = 0;
  let unhealthyCount = 0;
  
  for (const server of servers) {
    const isHealthy = healthStatus.get(server.service_name) || false;
    const status = isHealthy ? '✅ Healthy' : '❌ Unhealthy';
    const statusColor = isHealthy ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${statusColor}${status}\x1b[0m - ${server.display_name} (Port ${server.port})`);
    
    if (isHealthy) {
      healthyCount++;
    } else {
      unhealthyCount++;
    }
  }
  
  console.log('\n📊 Health Summary:');
  console.log(`✅ Healthy: ${healthyCount}`);
  console.log(`❌ Unhealthy: ${unhealthyCount}`);
  console.log(`📍 Total: ${servers.length}`);
  
  if (unhealthyCount > 0) {
    console.log('\n💡 Tip: Run "pnpm servers" to start unhealthy servers');
    process.exit(1);
  }
}

checkServerHealth();