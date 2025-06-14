#!/usr/bin/env ts-node

import { WorktreeSwitcherProxy } from '../../../packages/proxy-servers';

async function main() {
  console.log('Starting Worktree Switcher Proxy Server...');
  
  try {
    const proxy = new WorktreeSwitcherProxy();
    await proxy.start();
    
    console.log(`
Worktree Switcher Proxy is running on http://localhost:9887

Open http://localhost:9887 in your browser to use the visual worktree switcher.

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Worktree Switcher Proxy:', error);
    process.exit(1);
  }
}

main();