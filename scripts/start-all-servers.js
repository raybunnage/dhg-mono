#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// Server configuration with dedicated ports
const SERVERS = [
  {
    name: 'Markdown Server',
    port: 3001,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/simple-md-server.js'],
    cwd: process.cwd(),
    description: 'Serves markdown files for all apps'
  },
  {
    name: 'Script Server',
    port: 3002,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/simple-script-server.js'],
    cwd: process.cwd(),
    description: 'Serves script files (.sh, .js, .ts, .py)'
  },
  {
    name: 'Docs Archive Server',
    port: 3003,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/docs-archive-server.js'],
    cwd: process.cwd(),
    description: 'Document archiving and retrieval'
  },
  {
    name: 'File Browser Server',
    port: 3004,
    command: 'node',
    args: ['html/server.js'],
    cwd: process.cwd(),
    env: { FILE_BROWSER_PORT: '3004' },
    description: 'File browser API'
  },
  {
    name: 'Git Server (dhg-admin-code)',
    port: 3005,
    command: 'node',
    args: ['git-server.cjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-admin-code'),
    description: 'Git worktree management'
  },
  {
    name: 'Enhanced Audio Server (dhg-audio)',
    port: 3006,
    command: 'node',
    args: ['server-enhanced.js'],
    cwd: path.join(process.cwd(), 'apps/dhg-audio'),
    env: { PORT: '3006' },
    description: 'Local Google Drive + API audio server with 10-100x performance boost'
  },
  {
    name: 'Experts Markdown Server',
    port: 3007,
    command: 'node',
    args: ['md-server.mjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-improve-experts'),
    description: 'Markdown server for dhg-improve-experts'
  },
  {
    name: 'Continuous Docs Server',
    port: 3008,
    command: 'node',
    args: ['continuous-docs-server.cjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-admin-code'),
    description: 'Continuous documentation tracking'
  },
  {
    name: 'Git API Server (dhg-admin-code)',
    port: 3009,
    command: 'node',
    args: ['git-api-server.cjs'],
    cwd: path.join(process.cwd(), 'apps/dhg-admin-code'),
    env: { GIT_API_PORT: '3009' },
    description: 'Git branch management API'
  },
  {
    name: 'Worktree Switcher',
    port: 3010,
    command: 'node',
    args: ['scripts/cli-pipeline/viewers/worktree-switcher-server.js'],
    cwd: process.cwd(),
    env: { WORKTREE_SWITCHER_PORT: '3010' },
    description: 'Visual worktree switcher for Cursor instances'
  }
];

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

// Function to kill process on a specific port
function killPortProcess(port) {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    } else if (process.platform === 'win32') {
      execSync(`netstat -ano | findstr :${port} | findstr LISTENING | awk '{print $5}' | xargs kill -9 2>/dev/null || true`);
    }
  } catch (e) {
    // Ignore errors - port might already be free
  }
}

console.log('🚀 Starting all development servers...\n');
console.log('Port assignments:');
console.log('================');
SERVERS.forEach(server => {
  console.log(`Port ${server.port}: ${server.name}`);
  console.log(`  └─ ${server.description}`);
});
console.log('================\n');

const runningServers = [];

// Function to start a server
async function startServer(serverConfig) {
  console.log(`Starting ${serverConfig.name} on port ${serverConfig.port}...`);
  
  // Check if the command file exists
  const commandPath = path.join(serverConfig.cwd, ...serverConfig.args);
  if (!fs.existsSync(commandPath)) {
    console.warn(`⚠️  ${serverConfig.name}: File not found at ${commandPath}`);
    console.log(`   Skipping ${serverConfig.name}\n`);
    return null;
  }
  
  // Check if port is available
  const portAvailable = await isPortAvailable(serverConfig.port);
  if (!portAvailable) {
    console.warn(`⚠️  Port ${serverConfig.port} is already in use. Attempting to free it...`);
    killPortProcess(serverConfig.port);
    
    // Wait a bit for the port to be freed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check again
    const stillInUse = !(await isPortAvailable(serverConfig.port));
    if (stillInUse) {
      console.error(`❌ Failed to free port ${serverConfig.port} for ${serverConfig.name}`);
      return null;
    }
    console.log(`✅ Port ${serverConfig.port} freed successfully`);
  }

  // Add NODE_NO_WARNINGS for specific servers that have known warnings
  const env = { ...process.env, ...(serverConfig.env || {}) };
  
  // Suppress punycode deprecation warning for audio proxy server
  if (serverConfig.name === 'Audio Proxy Server (dhg-audio)') {
    env.NODE_NO_WARNINGS = '1';
  }
  
  const child = spawn(serverConfig.command, serverConfig.args, {
    cwd: serverConfig.cwd,
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Prefix output with server name
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`[${serverConfig.name}] ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.error(`[${serverConfig.name}] ERROR: ${line}`);
    });
  });

  child.on('close', (code) => {
    console.log(`[${serverConfig.name}] Process exited with code ${code}`);
    
    // Remove from running servers list
    const index = runningServers.findIndex(s => s.port === serverConfig.port);
    if (index !== -1) {
      runningServers.splice(index, 1);
    }
    
    // Log error if unexpected exit
    if (code !== 0 && code !== null) {
      console.error(`❌ ${serverConfig.name} crashed with exit code ${code}`);
    }
  });

  return child;
}

// Start all servers
(async () => {
  for (const server of SERVERS) {
    const child = await startServer(server);
    if (child) {
      runningServers.push({ ...server, process: child });
    }
  }
  
  console.log('\n✅ All available servers started!');
  console.log('Press Ctrl+C to stop all servers.\n');
})();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down all servers...');
  runningServers.forEach(({ name, process }) => {
    console.log(`Stopping ${name}...`);
    process.kill('SIGTERM');
  });
  process.exit(0);
});