#!/usr/bin/env ts-node

import { ScriptViewerProxy } from '../../../packages/proxy-servers';

/**
 * Start the Script Viewer proxy server
 * This proxy manages script files
 */

async function main() {
  console.log('Starting Script Viewer Proxy Server...');
  
  try {
    const proxy = new ScriptViewerProxy();
    await proxy.start();
    
    console.log(`
Script Viewer Proxy is running on http://localhost:9884

Available endpoints:
- GET /api/script-file?path=<path> - Get script file content
- GET /api/script-files - List all script files
- POST /api/script-file/archive - Archive a script file
- DELETE /api/script-file - Delete a script file permanently
- GET /health - Health check

Supported extensions: .sh, .js, .ts, .py

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Script Viewer Proxy:', error);
    process.exit(1);
  }
}

main();