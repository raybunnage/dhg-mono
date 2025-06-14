#!/usr/bin/env ts-node

import { ContinuousDocsProxy } from '../../../packages/proxy-servers';

/**
 * Start the Continuous Docs proxy server
 * This proxy manages documentation tracking for continuously updated files
 */

async function main() {
  console.log('Starting Continuous Docs Proxy Server...');
  
  try {
    const proxy = new ContinuousDocsProxy();
    await proxy.start();
    
    console.log(`
Continuous Docs Proxy is running on http://localhost:9882

Available endpoints:
- GET    /api/continuous-docs                    - Get all tracked documents
- GET    /api/continuous-docs/category/:category - Get documents by category
- GET    /api/continuous-docs/needs-update       - Get documents needing update
- PATCH  /api/continuous-docs/:path/frequency    - Update document frequency
- POST   /api/continuous-docs/:path/update       - Manually trigger update
- POST   /api/continuous-docs                    - Add new document to tracking
- DELETE /api/continuous-docs/:path              - Remove document from tracking
- GET    /health                                 - Health check

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Continuous Docs Proxy:', error);
    process.exit(1);
  }
}

main();