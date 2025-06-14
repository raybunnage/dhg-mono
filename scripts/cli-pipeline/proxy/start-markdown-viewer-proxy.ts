#!/usr/bin/env ts-node

import { MarkdownViewerProxy } from '../../../packages/proxy-servers';

async function main() {
  console.log('Starting Markdown Viewer Proxy Server...');
  
  try {
    const proxy = new MarkdownViewerProxy();
    await proxy.start();
    
    console.log(`
Markdown Viewer Proxy is running on http://localhost:9885

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Markdown Viewer Proxy:', error);
    process.exit(1);
  }
}

main();