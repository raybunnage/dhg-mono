#!/usr/bin/env ts-node

import { execSync } from 'child_process';

console.log('🛑 Killing all development servers...\n');

// Server ports to check
const serverPorts = [
  { port: 3001, name: 'Markdown Server' },
  { port: 3002, name: 'Script Server' },
  { port: 3003, name: 'Docs Archive Server' },
  { port: 3004, name: 'File Browser Server' },
  { port: 3005, name: 'Git Server' },
  { port: 3006, name: 'Web Audio Server' },
  { port: 3007, name: 'Local Audio Server' },
  { port: 3008, name: 'Living Docs Server' },
  { port: 3009, name: 'Git API Server' },
  { port: 3010, name: 'Worktree Switcher' },
  { port: 3011, name: 'Git History Server' },
  { port: 3012, name: 'Test Runner Server' }
];

// Kill processes on each port
serverPorts.forEach(({ port, name }) => {
  try {
    // Check if port is in use
    execSync(`lsof -ti:${port}`, { stdio: 'pipe' });
    console.log(`  Killing ${name} on port ${port}...`);
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'pipe' });
  } catch (error) {
    console.log(`  ${name} (port ${port}) - not running`);
  }
});

// Kill by process name patterns
console.log('\n🔍 Checking for lingering node processes...');

const processPatterns = [
  'simple-md-server.js',
  'simple-script-server.js',
  'docs-archive-server.js',
  'git-server.cjs',
  'living-docs-server.cjs',
  'continuous-docs-server.cjs',
  'git-api-server.cjs',
  'server-enhanced.js',
  'server-selector.js',
  'worktree-switcher-server.js',
  'git-history-server.js',
  'test-runner-server.cjs',
  'start-all-servers.js',
  'start-all-servers-dynamic.js'
];

processPatterns.forEach(pattern => {
  try {
    execSync(`pkill -f "${pattern}"`, { stdio: 'pipe' });
  } catch (error) {
    // Process not found, that's OK
  }
});

console.log('\n✅ All servers have been killed');
console.log('\nTo start servers again, run:');
console.log('  pnpm servers');
console.log('\nTo check if any servers are still running:');
console.log('  lsof -i :3001-3012');