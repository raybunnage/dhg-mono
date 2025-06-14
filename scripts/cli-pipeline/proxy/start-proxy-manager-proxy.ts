#!/usr/bin/env ts-node

import { ProxyManagerProxy } from '../../../packages/proxy-servers';

/**
 * Start the Proxy Manager proxy server
 * This proxy manages other proxy servers
 */

async function main() {
  console.log('Starting Proxy Manager Proxy Server...');
  
  try {
    const proxy = new ProxyManagerProxy();
    await proxy.start();
    
    console.log(`
Proxy Manager Proxy is running on http://localhost:9878

Available endpoints:
- GET /api/proxies - List all proxy servers
- POST /api/proxies/:name/start - Start a proxy server
- POST /api/proxies/:name/stop - Stop a proxy server
- GET /api/proxies/:name/status - Get proxy status
- GET /health - Health check

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Proxy Manager Proxy:', error);
    process.exit(1);
  }
}

main();