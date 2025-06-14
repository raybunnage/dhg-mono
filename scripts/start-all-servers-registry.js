#!/usr/bin/env node

/**
 * Server Manager that reads from sys_server_ports_registry
 * 
 * This script starts all servers configured in the database registry.
 * It reads server configurations from sys_server_ports_registry and launches them.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env.development') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Track running servers
const runningServers = [];

// Function to check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Function to update server status in database
async function updateServerStatus(serviceName, status, healthStatus = null) {
  try {
    const updateData = {
      status: status,
      last_health_check: new Date().toISOString()
    };
    
    if (healthStatus !== null) {
      updateData.last_health_status = healthStatus;
    }
    
    await supabase
      .from('sys_server_ports_registry')
      .update(updateData)
      .eq('service_name', serviceName);
  } catch (error) {
    console.error(`Failed to update status for ${serviceName}:`, error);
  }
}

// Function to check server health
async function checkServerHealth(server) {
  if (!server.health_check_endpoint) {
    return 'unknown';
  }
  
  try {
    const healthUrl = `${server.protocol || 'http'}://${server.host || 'localhost'}:${server.port}${server.health_check_endpoint}`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    return response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unhealthy';
  }
}

// Function to start a server from registry data
async function startServer(serverConfig) {
  console.log(`\n🚀 Starting ${serverConfig.display_name}...`);
  
  // Extract startup info from metadata
  const metadata = serverConfig.metadata || {};
  const scriptPath = metadata.script_path;
  const startupCommand = metadata.startup_command;
  
  if (!scriptPath && !startupCommand) {
    console.warn(`⚠️  ${serverConfig.display_name}: No startup configuration found`);
    return null;
  }
  
  // Check if port is available
  const isAvailable = await isPortAvailable(serverConfig.port);
  if (!isAvailable) {
    console.error(`❌ Port ${serverConfig.port} is already in use for ${serverConfig.display_name}`);
    await updateServerStatus(serverConfig.service_name, 'error', 'port_conflict');
    return null;
  }
  
  // Parse the command
  let command, args, cwd;
  
  if (startupCommand) {
    // Parse startup command (e.g., "AUDIO_PROXY_PORT=3007 node apps/dhg-audio/server-enhanced.js")
    const parts = startupCommand.split(' ');
    const envMatch = parts[0].match(/^([^=]+)=(.+)$/);
    
    if (envMatch) {
      // Has environment variable prefix
      process.env[envMatch[1]] = envMatch[2];
      command = parts[1];
      args = parts.slice(2);
    } else {
      command = parts[0];
      args = parts.slice(1);
    }
    
    // Determine working directory
    if (args[0] && args[0].includes('/')) {
      const fullPath = path.resolve(process.cwd(), args[0]);
      cwd = path.dirname(fullPath);
      args[0] = path.basename(args[0]);
    } else {
      cwd = process.cwd();
    }
  } else {
    // Use script_path
    const fullPath = path.resolve(process.cwd(), scriptPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  ${serverConfig.display_name}: File not found at ${fullPath}`);
      return null;
    }
    
    command = 'node';
    args = [path.basename(fullPath)];
    cwd = path.dirname(fullPath);
  }
  
  // Set up environment
  const env = { 
    ...process.env,
    PORT: serverConfig.port.toString()
  };
  
  // Add any environment variable from metadata
  if (metadata.env_var) {
    env[metadata.env_var] = serverConfig.port.toString();
  }
  
  console.log(`📍 Starting on port ${serverConfig.port}`);
  console.log(`📁 Working directory: ${cwd}`);
  console.log(`🔧 Command: ${command} ${args.join(' ')}`);
  
  // Update status to starting
  await updateServerStatus(serverConfig.service_name, 'starting');
  
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Prefix output with server name and port
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`[${serverConfig.display_name}:${serverConfig.port}] ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      // Filter out common warnings
      if (!line.includes('DeprecationWarning') && 
          !line.includes('punycode') && 
          !line.includes('NODE_NO_WARNINGS')) {
        console.error(`[${serverConfig.display_name}:${serverConfig.port}] ERROR: ${line}`);
      }
    });
  });

  child.on('close', async (code) => {
    console.log(`[${serverConfig.display_name}] Process exited with code ${code}`);
    
    // Update status in database
    await updateServerStatus(serverConfig.service_name, 'inactive', 'stopped');
    
    // Remove from running servers list
    const index = runningServers.findIndex(s => s.service_name === serverConfig.service_name);
    if (index !== -1) {
      runningServers.splice(index, 1);
    }
  });
  
  // Mark as active after successful start
  await updateServerStatus(serverConfig.service_name, 'active');

  // Start health monitoring after a delay
  setTimeout(async () => {
    const healthStatus = await checkServerHealth(serverConfig);
    await updateServerStatus(serverConfig.service_name, 'active', healthStatus);
    console.log(`🏥 ${serverConfig.display_name} health check: ${
      healthStatus === 'healthy' ? '✅ Healthy' : 
      healthStatus === 'unhealthy' ? '❌ Unhealthy' : 
      '❓ Unknown'
    }`);
    
    // Set up periodic health checks
    const healthInterval = setInterval(async () => {
      const status = await checkServerHealth(serverConfig);
      await updateServerStatus(serverConfig.service_name, 'active', status);
    }, 30000); // Check every 30 seconds
    
    serverConfig.healthInterval = healthInterval;
  }, 5000); // Initial delay of 5 seconds

  return { ...serverConfig, process: child };
}

// Main execution
async function main() {
  console.log('🚀 Registry-Based Server Manager\n');
  console.log('Reading server configurations from sys_server_ports_registry...');
  console.log('================================================================================\n');

  try {
    // Fetch all active servers from registry
    const { data: servers, error } = await supabase
      .from('sys_server_ports_registry')
      .select('*')
      .eq('status', 'active')
      .eq('environment', process.env.NODE_ENV || 'development')
      .order('port');
    
    if (error) {
      console.error('Failed to fetch server registry:', error);
      process.exit(1);
    }
    
    if (!servers || servers.length === 0) {
      console.log('No active servers found in registry.');
      console.log('Run "./scripts/cli-pipeline/servers/servers-cli.sh register" to add servers.');
      process.exit(0);
    }
    
    console.log(`Found ${servers.length} server(s) in registry.\n`);
    
    // Reset all servers to inactive first
    await supabase
      .from('sys_server_ports_registry')
      .update({ status: 'inactive', last_health_status: 'stopped' })
      .eq('environment', process.env.NODE_ENV || 'development');
    
    // Start each server
    for (const server of servers) {
      const runningServer = await startServer(server);
      if (runningServer) {
        runningServers.push(runningServer);
      }
      
      // Small delay between starts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (runningServers.length === 0) {
      console.log('\n❌ No servers could be started.');
      process.exit(1);
    }
    
    console.log('\n✅ Server startup complete!');
    console.log('\n📊 Running Servers:');
    console.log('==================');
    
    for (const server of runningServers) {
      const url = `${server.protocol || 'http'}://${server.host || 'localhost'}:${server.port}`;
      console.log(`${server.display_name}: ${url}`);
    }
    
    console.log('\n🔍 Frontend apps will automatically discover these servers');
    console.log('Press Ctrl+C to stop all servers.\n');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down all servers...');
  
  // Clear health check intervals
  runningServers.forEach(server => {
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
    }
  });
  
  // Update all servers to inactive
  await supabase
    .from('sys_server_ports_registry')
    .update({ status: 'inactive', last_health_status: 'stopped' })
    .eq('environment', process.env.NODE_ENV || 'development');
  
  // Kill all processes
  runningServers.forEach(({ display_name, process }) => {
    console.log(`Stopping ${display_name}...`);
    process.kill('SIGTERM');
  });
  
  // Give processes time to shut down gracefully
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Start the server manager
main();