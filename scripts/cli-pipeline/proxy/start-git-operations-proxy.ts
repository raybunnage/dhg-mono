#!/usr/bin/env ts-node

import { GitOperationsProxy } from '../../../packages/proxy-servers';

/**
 * Start the Git Operations proxy server
 * This proxy provides git worktree and branch management
 */

async function main() {
  console.log('Starting Git Operations Proxy Server...');
  
  try {
    const proxy = new GitOperationsProxy();
    await proxy.start();
    
    console.log(`
Git Operations Proxy is running on http://localhost:9879

Available endpoints:
- GET /api/git/worktrees - Get all worktrees with status
- POST /api/git/worktree-commits - Get commits for a worktree
- GET /api/git/branches - Get all branches with info
- DELETE /api/git/branches/:name - Delete a branch
- POST /api/git/cleanup-branches - Cleanup multiple branches
- POST /api/git/execute - Execute whitelisted git commands
- GET /health - Health check

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Git Operations Proxy:', error);
    process.exit(1);
  }
}

main();