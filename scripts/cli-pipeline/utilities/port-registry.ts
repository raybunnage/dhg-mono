#!/usr/bin/env ts-node

/**
 * Port Registry CLI
 * Simple tool to check port usage and availability
 */

import { execSync } from 'child_process';
import * as net from 'net';

// Port registry from CLAUDE.md
const PORT_REGISTRY = {
  'Vite Apps': {
    'dhg-research': 5005,
    'dhg-hub-lovable': 5173,
    'dhg-hub': 5174,
    'dhg-admin-suite': 5175,
    'dhg-admin-google': 5176,
    'dhg-admin-code': 5177,
    'dhg-a': 5178,
    'dhg-b': 5179,
    'dhg-service-test': 5180,
    'dhg-audio': 5194,
  },
  'Proxy Servers': {
    'vite-fix-proxy': 9876,
    'reserved-proxy-1': 9877,
    'reserved-proxy-2': 9878,
  },
  'Other Services': {
    'file-browser': 8080,
    'reserved-service-1': 8081,
    'reserved-service-2': 8082,
  }
};

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false); // Port is in use
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true); // Port is available
    });
    
    server.listen(port);
  });
}

async function getProcessUsingPort(port: number): Promise<string | null> {
  try {
    const result = execSync(`lsof -i :${port} -P -n | grep LISTEN || true`, { encoding: 'utf-8' });
    if (result.trim()) {
      const lines = result.trim().split('\n');
      const parts = lines[0].split(/\s+/);
      return `${parts[0]} (PID: ${parts[1]})`;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function listPorts() {
  console.log('\n📋 Port Registry Status\n');
  
  for (const [category, ports] of Object.entries(PORT_REGISTRY)) {
    console.log(`\n${category}:`);
    console.log('─'.repeat(50));
    
    for (const [name, port] of Object.entries(ports)) {
      const isAvailable = await checkPort(port);
      const process = isAvailable ? null : await getProcessUsingPort(port);
      
      const status = isAvailable ? '✅ Available' : `🔴 In use${process ? ` by ${process}` : ''}`;
      const isReserved = name.startsWith('reserved-');
      
      console.log(`  ${name.padEnd(20)} ${String(port).padEnd(6)} ${status} ${isReserved ? '(reserved)' : ''}`);
    }
  }
  
  console.log('\n');
}

async function checkSpecificPort(port: number) {
  const isAvailable = await checkPort(port);
  const process = isAvailable ? null : await getProcessUsingPort(port);
  
  // Find which service uses this port
  let serviceName = 'Unknown';
  for (const [category, ports] of Object.entries(PORT_REGISTRY)) {
    for (const [name, p] of Object.entries(ports)) {
      if (p === port) {
        serviceName = `${name} (${category})`;
        break;
      }
    }
  }
  
  console.log(`\nPort ${port} - ${serviceName}`);
  console.log('─'.repeat(30));
  console.log(`Status: ${isAvailable ? '✅ Available' : '🔴 In use'}`);
  if (process) {
    console.log(`Used by: ${process}`);
  }
  console.log('');
}

async function suggestPort(start: number = 9900) {
  console.log(`\n🔍 Finding available port starting from ${start}...\n`);
  
  for (let port = start; port < start + 100; port++) {
    if (await checkPort(port)) {
      console.log(`✅ Port ${port} is available!`);
      console.log(`\nTo reserve this port, add it to CLAUDE.md in the Port Registry section.\n`);
      return;
    }
  }
  
  console.log(`❌ No available ports found in range ${start}-${start + 99}\n`);
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    await listPorts();
    break;
    
  case 'check':
    const port = parseInt(args[1]);
    if (isNaN(port)) {
      console.error('Usage: port-registry check <port>');
      process.exit(1);
    }
    await checkSpecificPort(port);
    break;
    
  case 'suggest':
    const startPort = args[1] ? parseInt(args[1]) : 9900;
    await suggestPort(startPort);
    break;
    
  default:
    console.log(`
Port Registry CLI
─────────────────

Usage:
  ts-node port-registry.ts list              List all registered ports and their status
  ts-node port-registry.ts check <port>      Check if a specific port is available
  ts-node port-registry.ts suggest [start]   Suggest an available port (default: 9900)

Examples:
  ts-node port-registry.ts list
  ts-node port-registry.ts check 5173
  ts-node port-registry.ts suggest 8000

Note: Port registry is maintained in CLAUDE.md
    `);
}