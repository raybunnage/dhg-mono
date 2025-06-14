#!/usr/bin/env ts-node

import { ContinuousMonitoringProxy } from '../../../packages/proxy-servers';

/**
 * Start the Continuous Monitoring proxy server
 * This proxy provides system health monitoring
 */

async function main() {
  console.log('Starting Continuous Monitoring Proxy Server...');
  
  try {
    const proxy = new ContinuousMonitoringProxy();
    await proxy.start();
    
    console.log(`
Continuous Monitoring Proxy is running on http://localhost:9877

Available endpoints:
- GET /api/health/system - Get system health metrics
- GET /api/health/services - Get services health status
- GET /api/health/disk - Get disk usage information
- GET /api/health/database - Get database connection status
- GET /health - Health check

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Continuous Monitoring Proxy:', error);
    process.exit(1);
  }
}

main();