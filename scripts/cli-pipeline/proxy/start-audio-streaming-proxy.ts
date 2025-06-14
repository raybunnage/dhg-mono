#!/usr/bin/env ts-node

import { AudioStreamingProxy } from '../../../packages/proxy-servers';

/**
 * Start the Audio Streaming proxy server
 * This proxy handles audio streaming from Google Drive with local file support
 */

async function main() {
  console.log('Starting Audio Streaming Proxy Server...');
  
  try {
    const proxy = new AudioStreamingProxy();
    await proxy.start();
    
    console.log(`
Audio Streaming Proxy is running on http://localhost:9883

Available endpoints:
- GET /api/audio/:fileId     - Stream audio file from Google Drive
- GET /api/audio-status      - Get service configuration status
- GET /health                - Health check

Features:
- Google Drive API streaming
- Local Google Drive file support (if configured)
- Range request support for audio seeking
- Automatic MIME type detection
- Fallback between local and API access

Press Ctrl+C to stop the server.
    `);
  } catch (error) {
    console.error('Failed to start Audio Streaming Proxy:', error);
    process.exit(1);
  }
}

main();