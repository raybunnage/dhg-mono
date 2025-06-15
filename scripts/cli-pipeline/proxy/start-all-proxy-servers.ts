#!/usr/bin/env ts-node

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ProxyServer {
  name: string;
  port: number;
  scriptPath: string;
  process?: ChildProcess;
  status: 'starting' | 'running' | 'failed' | 'stopped';
  healthEndpoint: string;
  lastHealthCheck?: Date;
  lastHealthStatus?: boolean;
}

const PROXY_SERVERS: ProxyServer[] = [
  {
    name: 'Vite Fix Proxy',
    port: 9876,
    scriptPath: 'start-vite-fix-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Continuous Monitoring',
    port: 9877,
    scriptPath: 'start-continuous-monitoring-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Proxy Manager',
    port: 9878,
    scriptPath: 'start-proxy-manager-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Git Operations',
    port: 9879,
    scriptPath: 'start-git-operations-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'File Browser',
    port: 9880,
    scriptPath: 'start-file-browser-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Continuous Docs',
    port: 9882,
    scriptPath: 'start-continuous-docs-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Audio Streaming',
    port: 9883,
    scriptPath: 'start-audio-streaming-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Script Viewer',
    port: 9884,
    scriptPath: 'start-script-viewer-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Markdown Viewer',
    port: 9885,
    scriptPath: 'start-markdown-viewer-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Docs Archive',
    port: 9886,
    scriptPath: 'start-docs-archive-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Worktree Switcher',
    port: 9887,
    scriptPath: 'start-worktree-switcher-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'HTML File Browser',
    port: 8080,
    scriptPath: 'start-html-file-browser-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'CLI Test Runner',
    port: 9890,
    scriptPath: 'start-cli-test-runner-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  },
  {
    name: 'Test Runner',
    port: 9891,
    scriptPath: 'start-test-runner-proxy.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  }
];

async function checkHealth(server: ProxyServer): Promise<boolean> {
  try {
    const response = await axios.get(`http://localhost:${server.port}${server.healthEndpoint}`, {
      timeout: 2000
    });
    server.lastHealthCheck = new Date();
    server.lastHealthStatus = response.status === 200;
    return server.lastHealthStatus;
  } catch (error) {
    server.lastHealthCheck = new Date();
    server.lastHealthStatus = false;
    return false;
  }
}

function startProxyServer(server: ProxyServer): void {
  console.log(`🚀 Starting ${server.name} on port ${server.port}...`);
  server.status = 'starting';

  const scriptPath = path.join(__dirname, server.scriptPath);
  const tsNode = 'ts-node'; // Use global ts-node instead of local path
  
  // Check if it's a shell script or TypeScript file
  if (server.scriptPath.endsWith('.sh')) {
    server.process = spawn('bash', [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    server.process = spawn(tsNode, [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  server.process.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('Starting') && !output.includes('Press Ctrl+C')) {
      console.log(`[${server.name}] ${output}`);
    }
  });

  server.process.stderr?.on('data', (data) => {
    console.error(`[${server.name}] ERROR: ${data.toString().trim()}`);
    server.status = 'failed';
  });

  server.process.on('error', (error) => {
    console.error(`[${server.name}] Failed to start: ${error.message}`);
    server.status = 'failed';
  });

  server.process.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${server.name}] Process exited with code ${code}`);
      server.status = 'failed';
    } else {
      server.status = 'stopped';
    }
  });

  // Wait a bit for the server to start, then check health
  setTimeout(async () => {
    const isHealthy = await checkHealth(server);
    if (isHealthy) {
      server.status = 'running';
      console.log(`✅ ${server.name} is running and healthy`);
    } else {
      console.warn(`⚠️  ${server.name} started but health check failed`);
    }
  }, 3000);
}

async function displayStatus(): Promise<void> {
  console.log('\n📊 Proxy Server Status:');
  console.log('━'.repeat(80));
  console.log('Name'.padEnd(25) + 'Port'.padEnd(10) + 'Status'.padEnd(15) + 'Health'.padEnd(10) + 'Last Check');
  console.log('━'.repeat(80));

  for (const server of PROXY_SERVERS) {
    const statusEmoji = {
      'running': '🟢',
      'starting': '🟡',
      'failed': '🔴',
      'stopped': '⚫'
    }[server.status] || '❓';

    const healthEmoji = server.lastHealthStatus === true ? '✅' : 
                        server.lastHealthStatus === false ? '❌' : '⏳';

    const lastCheck = server.lastHealthCheck ? 
      new Date().getTime() - server.lastHealthCheck.getTime() < 60000 ?
        'Just now' : server.lastHealthCheck.toLocaleTimeString()
      : 'Never';

    console.log(
      `${server.name.padEnd(25)}${server.port.toString().padEnd(10)}${statusEmoji} ${server.status.padEnd(12)}${healthEmoji.padEnd(10)}${lastCheck}`
    );
  }
  console.log('━'.repeat(80));
}

async function monitorHealth(): Promise<void> {
  setInterval(async () => {
    for (const server of PROXY_SERVERS) {
      if (server.status === 'running') {
        await checkHealth(server);
      }
    }
  }, 30000); // Check every 30 seconds
}

async function main(): Promise<void> {
  console.log('🚀 Starting All Proxy Servers...\n');
  console.log('This will start the following proxy servers:');
  PROXY_SERVERS.forEach(server => {
    console.log(`  - ${server.name} (port ${server.port})`);
  });
  console.log();

  // Start all servers
  for (const server of PROXY_SERVERS) {
    startProxyServer(server);
    // Stagger starts to avoid resource contention
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Wait for servers to stabilize
  console.log('\n⏳ Waiting for servers to start...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Display initial status
  await displayStatus();

  // Start health monitoring
  monitorHealth();

  console.log('\n✅ All proxy servers started!');
  console.log('Press Ctrl+C to stop all servers.\n');

  // Refresh status display every minute
  setInterval(displayStatus, 60000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down all proxy servers...');
  
  PROXY_SERVERS.forEach(server => {
    if (server.process && server.status !== 'stopped') {
      console.log(`Stopping ${server.name}...`);
      server.process.kill('SIGTERM');
    }
  });

  setTimeout(() => {
    console.log('Force killing remaining processes...');
    PROXY_SERVERS.forEach(server => {
      if (server.process) {
        server.process.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
});

// Run the main function
main().catch(error => {
  console.error('Failed to start proxy servers:', error);
  process.exit(1);
});