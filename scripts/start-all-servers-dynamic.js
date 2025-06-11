#!/usr/bin/env node

/**
 * Enhanced Server Manager with Dynamic Port Allocation
 * 
 * This script starts all servers with dynamic port allocation and
 * registers them in the sys_server_ports_registry for frontend discovery.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env.development') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Server configuration with service registry mapping
const SERVERS = [
  {
    service_name: 'md-server',
    name: 'Markdown Server',
    defaultPort: 3001,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/simple-md-server.js'],
    cwd: process.cwd(),
    envVar: 'MD_SERVER_PORT',
    healthEndpoint: '/health',
    description: 'Serves markdown files for all apps'
  },
  {
    service_name: 'script-server',
    name: 'Script Server',
    defaultPort: 3002,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/simple-script-server.js'],
    cwd: process.cwd(),
    envVar: 'SCRIPT_SERVER_PORT',
    healthEndpoint: '/health',
    description: 'Serves script files (.sh, .js, .ts, .py)'
  },
  {
    service_name: 'docs-archive-server',
    name: 'Docs Archive Server',
    defaultPort: 3003,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/docs-archive-server.js'],
    cwd: process.cwd(),
    envVar: 'DOCS_ARCHIVE_SERVER_PORT',
    healthEndpoint: '/health',
    description: 'Document archiving and retrieval'
  },
  {
    service_name: 'git-server',
    name: 'Git Server',
    defaultPort: 3005,
    command: 'node',
    args: ['git-server.cjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-admin-code'),
    envVar: 'GIT_SERVER_PORT',
    healthEndpoint: '/api/git/health',
    description: 'Git worktree management'
  },
  {
    service_name: 'continuous-docs-server',
    name: 'Continuous Docs Server',
    defaultPort: 3008,
    command: 'node',
    args: ['continuous-docs-server.cjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-admin-code'),
    envVar: 'CONTINUOUS_DOCS_PORT',
    healthEndpoint: '/health',
    description: 'Continuous documentation tracking'
  },
  {
    service_name: 'git-api-server',
    name: 'Git API Server',
    defaultPort: 3009,
    command: 'node',
    args: ['git-api-server.cjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-admin-code'),
    envVar: 'GIT_API_SERVER_PORT',
    healthEndpoint: '/health',
    description: 'Git branch management API'
  },
  {
    service_name: 'audio-proxy-server',
    name: 'Audio Proxy Server',
    defaultPort: 3006,
    command: 'node',
    args: ['server.js'],
    cwd: path.join(process.cwd(), 'apps/dhg-audio'),
    envVar: 'AUDIO_PROXY_PORT',
    healthEndpoint: '/health',
    description: 'Local Google Drive audio streaming'
  }
];

// Port allocation range
const PORT_RANGE = { start: 3000, end: 3100 };
const allocatedPorts = new Set();

// Function to find an available port
async function findAvailablePort(preferredPort) {
  if (preferredPort && await isPortAvailable(preferredPort)) {
    return preferredPort;
  }
  
  for (let port = PORT_RANGE.start; port <= PORT_RANGE.end; port++) {
    if (!allocatedPorts.has(port) && await isPortAvailable(port)) {
      allocatedPorts.add(port);
      return port;
    }
  }
  
  throw new Error('No available ports in range');
}

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

// Function to register server in database
async function registerServer(config, port) {
  try {
    const { error } = await supabase
      .from('sys_server_ports_registry')
      .upsert({
        service_name: config.service_name,
        display_name: config.name,
        description: config.description,
        port: port,
        protocol: 'http',
        host: 'localhost',
        base_path: '',
        environment: process.env.NODE_ENV || 'development',
        status: 'active',
        health_check_endpoint: config.healthEndpoint,
        last_health_check: new Date().toISOString(),
        last_health_status: 'unknown',
        metadata: {
          command: config.command,
          args: config.args,
          cwd: config.cwd
        }
      }, {
        onConflict: 'service_name'
      });

    if (error) {
      console.error(`Failed to register ${config.name}:`, error);
    } else {
      console.log(`✅ Registered ${config.name} in service registry`);
    }
  } catch (err) {
    console.error(`Error registering ${config.name}:`, err);
  }
}

// Function to check server health
async function checkServerHealth(config, port) {
  try {
    const healthUrl = `http://localhost:${port}${config.healthEndpoint}`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    const isHealthy = response.ok;
    
    // Update health status in database
    await supabase
      .from('sys_server_ports_registry')
      .update({
        last_health_check: new Date().toISOString(),
        last_health_status: isHealthy ? 'healthy' : 'unhealthy'
      })
      .eq('service_name', config.service_name);
    
    return isHealthy;
  } catch (error) {
    // Server not responding yet
    return false;
  }
}

// Enhanced server start function
async function startServer(serverConfig) {
  console.log(`\n🚀 Starting ${serverConfig.name}...`);
  
  // Check if the command file exists
  const commandPath = path.join(serverConfig.cwd, ...serverConfig.args);
  if (!fs.existsSync(commandPath)) {
    console.warn(`⚠️  ${serverConfig.name}: File not found at ${commandPath}`);
    console.log(`   Skipping ${serverConfig.name}\n`);
    return null;
  }
  
  // Find available port
  const port = await findAvailablePort(serverConfig.defaultPort);
  console.log(`📍 Allocated port ${port} for ${serverConfig.name}`);
  
  // Register in database first
  await registerServer(serverConfig, port);
  
  // Set up environment with dynamic port
  const env = { 
    ...process.env,
    [serverConfig.envVar]: port.toString(),
    PORT: port.toString() // Some servers use generic PORT
  };
  
  // Suppress warnings for known issues
  if (serverConfig.name === 'Audio Proxy Server') {
    env.NODE_NO_WARNINGS = '1';
  }
  
  const child = spawn(serverConfig.command, serverConfig.args, {
    cwd: serverConfig.cwd,
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Prefix output with server name and port
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`[${serverConfig.name}:${port}] ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      // Filter out common warnings
      if (!line.includes('DeprecationWarning') && !line.includes('punycode')) {
        console.error(`[${serverConfig.name}:${port}] ERROR: ${line}`);
      }
    });
  });

  child.on('close', async (code) => {
    console.log(`[${serverConfig.name}] Process exited with code ${code}`);
    
    // Update status in database
    await supabase
      .from('sys_server_ports_registry')
      .update({ 
        status: 'inactive',
        last_health_status: 'unhealthy'
      })
      .eq('service_name', serverConfig.service_name);
    
    // Remove from allocated ports
    allocatedPorts.delete(port);
    
    // Remove from running servers list
    const index = runningServers.findIndex(s => s.port === port);
    if (index !== -1) {
      runningServers.splice(index, 1);
    }
  });

  // Start health monitoring after a delay
  setTimeout(async () => {
    const isHealthy = await checkServerHealth(serverConfig, port);
    console.log(`🏥 ${serverConfig.name} health check: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    // Set up periodic health checks
    setInterval(async () => {
      await checkServerHealth(serverConfig, port);
    }, 30000); // Check every 30 seconds
  }, 5000); // Initial delay of 5 seconds

  return { ...serverConfig, port, process: child };
}

// Main execution
const runningServers = [];

console.log('🚀 Dynamic Server Manager\n');
console.log('This system allocates ports dynamically and registers them for frontend discovery.');
console.log('================================================================================\n');

(async () => {
  // Clear any stale entries first
  await supabase
    .from('sys_server_ports_registry')
    .update({ status: 'inactive' })
    .eq('environment', process.env.NODE_ENV || 'development');

  // Start all servers
  for (const server of SERVERS) {
    const runningServer = await startServer(server);
    if (runningServer) {
      runningServers.push(runningServer);
    }
    
    // Small delay between starts
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ All available servers started!');
  console.log('\n📊 Server Registry Status:');
  console.log('==========================');
  
  for (const server of runningServers) {
    console.log(`${server.name}: http://localhost:${server.port}`);
  }
  
  console.log('\n🔍 Frontend apps will automatically discover these ports');
  console.log('Press Ctrl+C to stop all servers.\n');
})();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down all servers...');
  
  // Update all servers to inactive
  await supabase
    .from('sys_server_ports_registry')
    .update({ status: 'inactive' })
    .eq('environment', process.env.NODE_ENV || 'development');
  
  // Kill all processes
  runningServers.forEach(({ name, process }) => {
    console.log(`Stopping ${name}...`);
    process.kill('SIGTERM');
  });
  
  process.exit(0);
});