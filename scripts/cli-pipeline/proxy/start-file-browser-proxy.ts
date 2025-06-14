#!/usr/bin/env ts-node

import { FileBrowserProxy } from '../../../packages/proxy-servers';

async function main() {
  console.log('Starting File Browser Proxy Server...');
  
  const proxy = new FileBrowserProxy();
  
  try {
    await proxy.start();
    console.log('File Browser Proxy is running on port 9880');
    console.log('Open http://localhost:9880/file-browser.html in your browser');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      await proxy.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start proxy:', error);
    process.exit(1);
  }
}

main();