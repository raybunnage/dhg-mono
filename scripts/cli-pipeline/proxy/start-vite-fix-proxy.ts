#!/usr/bin/env ts-node

import { ViteFixProxy } from '../../../packages/proxy-servers';

/**
 * Start the Vite Fix proxy server
 * This proxy handles Vite environment fixes
 */

async function main() {
  console.log('Starting Vite Fix Proxy Server...');
  
  try {
    const proxy = new ViteFixProxy();
    await proxy.start();
    
    console.log(`
Vite Fix Proxy is running on http://localhost:9876

Available endpoints:
- POST /fix - Execute fix for specified app
- GET /health - Check server health
- GET /apps - List available apps

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Vite Fix Proxy:', error);
    process.exit(1);
  }
}

main();