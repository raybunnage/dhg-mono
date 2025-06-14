#!/usr/bin/env ts-node

import { DocsArchiveProxy } from '../../../packages/proxy-servers';

async function main() {
  console.log('Starting Docs Archive Proxy Server...');
  
  try {
    const proxy = new DocsArchiveProxy();
    await proxy.start();
    
    console.log(`
Docs Archive Proxy is running on http://localhost:9886

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Docs Archive Proxy:', error);
    process.exit(1);
  }
}

main();