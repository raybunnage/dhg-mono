#!/usr/bin/env ts-node

import { HtmlFileBrowserProxy } from '../../../packages/proxy-servers';

/**
 * Start the HTML File Browser proxy server
 * This proxy provides a web-based file browser interface
 */

async function main() {
  console.log('Starting HTML File Browser Proxy Server...');
  
  try {
    const proxy = new HtmlFileBrowserProxy();
    await proxy.start();
    
    console.log(`
HTML File Browser Proxy is running on http://localhost:8080

Available endpoints:
- GET  /file-browser.html        - Web-based file browser UI
- POST /api/list-directory       - List directory contents
- POST /api/read-file           - Read file content
- POST /api/search-files        - Search for files
- POST /api/file-stats          - Get file statistics
- GET  /api/info                - API information
- GET  /health                  - Health check

Features:
- Web-based UI for browsing files
- Directory navigation with breadcrumbs
- File content viewing
- File search functionality
- Sorting by modification time
- Security: Path validation prevents access outside project

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start HTML File Browser Proxy:', error);
    process.exit(1);
  }
}

main();