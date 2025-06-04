#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
    name: 'Audio Proxy Server (dhg-audio)',
    port: 3006,
    command: 'node',
    args: ['server.js'],
    cwd: path.join(process.cwd(), 'apps/dhg-audio'),
    env: { PORT: '3006' },
    description: 'Google Drive proxy for audio files'
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
  }
];

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
function startServer(serverConfig) {
  console.log(`Starting ${serverConfig.name} on port ${serverConfig.port}...`);
  
  // Check if the command file exists
  const commandPath = path.join(serverConfig.cwd, ...serverConfig.args);
  if (!fs.existsSync(commandPath)) {
    console.warn(`⚠️  ${serverConfig.name}: File not found at ${commandPath}`);
    console.log(`   Skipping ${serverConfig.name}\n`);
    return null;
  }

  const env = { ...process.env, ...(serverConfig.env || {}) };
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
  });

  return child;
}

// Start all servers
SERVERS.forEach(server => {
  const child = startServer(server);
  if (child) {
    runningServers.push({ ...server, process: child });
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down all servers...');
  runningServers.forEach(({ name, process }) => {
    console.log(`Stopping ${name}...`);
    process.kill('SIGTERM');
  });
  process.exit(0);
});

console.log('\n✅ All available servers started!');
console.log('Press Ctrl+C to stop all servers.\n');