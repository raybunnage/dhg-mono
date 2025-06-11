#!/usr/bin/env node

/**
 * Audio Server Selector
 * 
 * This script selects which audio server to run based on environment variables
 * or command line arguments.
 * 
 * Usage:
 *   node server-selector.js          # Uses AUDIO_SERVER_MODE env var
 *   node server-selector.js local    # Force local mode (server-enhanced.js)
 *   node server-selector.js web      # Force web mode (server.js)
 */

const { spawn } = require('child_process');
const path = require('path');

// Get mode from command line args or environment
const mode = process.argv[2] || process.env.AUDIO_SERVER_MODE || 'local';

// Determine which server to run
let serverFile;
let serverName;

switch (mode.toLowerCase()) {
  case 'local':
  case 'enhanced':
    serverFile = 'server-enhanced.js';
    serverName = 'Enhanced Audio Server (Local Google Drive + Web API)';
    break;
  
  case 'web':
  case 'api':
  case 'basic':
    serverFile = 'server.js';
    serverName = 'Basic Audio Server (Web API only)';
    break;
  
  default:
    console.error(`Unknown server mode: ${mode}`);
    console.error('Valid modes: local, web');
    process.exit(1);
}

console.log(`Starting ${serverName}...`);
console.log(`Mode: ${mode}`);
console.log(`Server file: ${serverFile}`);

// Start the selected server
const serverPath = path.join(__dirname, serverFile);
const child = spawn('node', [serverPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env }
});

// Forward signals to child process
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

// Exit when child exits
child.on('exit', (code) => {
  process.exit(code);
});