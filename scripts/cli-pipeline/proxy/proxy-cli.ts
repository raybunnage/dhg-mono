#!/usr/bin/env ts-node

import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// Define proxy server configurations
const PROXY_SERVERS = {
  'vite-fix': {
    name: 'Vite Fix Proxy',
    port: 9876,
    script: 'start-vite-fix-proxy.ts',
    description: 'Fix Vite environment issues'
  },
  'monitoring': {
    name: 'Continuous Monitoring Proxy',
    port: 9877,
    script: 'start-continuous-monitoring-proxy.ts',
    description: 'System health monitoring'
  },
  'manager': {
    name: 'Proxy Manager',
    port: 9878,
    script: 'start-proxy-manager-proxy.ts',
    description: 'Manage other proxy servers'
  },
  'git-operations': {
    name: 'Git Operations Proxy',
    port: 9879,
    script: 'start-git-operations-proxy.ts',
    description: 'Git operations interface'
  },
  'file-browser': {
    name: 'File Browser Proxy',
    port: 9880,
    script: 'start-file-browser-proxy.ts',
    description: 'File system browser'
  },
  'continuous-docs': {
    name: 'Continuous Docs Proxy',
    port: 9882,
    script: 'start-continuous-docs-proxy.ts',
    description: 'Live documentation viewer'
  },
  'audio-streaming': {
    name: 'Audio Streaming Proxy',
    port: 9883,
    script: 'start-audio-streaming-proxy.ts',
    description: 'Audio file streaming'
  },
  'script-viewer': {
    name: 'Script Viewer Proxy',
    port: 9884,
    script: 'start-script-viewer-proxy.ts',
    description: 'Script file viewer'
  },
  'markdown-viewer': {
    name: 'Markdown Viewer Proxy',
    port: 9885,
    script: 'start-markdown-viewer-proxy.ts',
    description: 'Markdown document viewer'
  },
  'docs-archive': {
    name: 'Docs Archive Proxy',
    port: 9886,
    script: 'start-docs-archive-proxy.ts',
    description: 'Archived documentation viewer'
  },
  'worktree-switcher': {
    name: 'Worktree Switcher Proxy',
    port: 9887,
    script: 'start-worktree-switcher-proxy.ts',
    description: 'Git worktree management'
  },
  'html-browser': {
    name: 'HTML File Browser',
    port: 8080,
    script: 'start-html-file-browser-proxy.ts',
    description: 'HTML-based file browser'
  }
};

program
  .name('proxy-cli')
  .description('CLI for managing proxy servers')
  .version('1.0.0');

// Start all command
program
  .command('start-all')
  .description('Start all proxy servers with health monitoring')
  .action(() => {
    console.log('🚀 Starting all proxy servers...');
    const scriptPath = path.join(__dirname, 'start-all-proxy-servers.ts');
    spawn('ts-node', [scriptPath], { stdio: 'inherit' });
  });

// Start specific proxy command
program
  .command('start <proxy>')
  .description('Start a specific proxy server')
  .action((proxy: string) => {
    const config = PROXY_SERVERS[proxy as keyof typeof PROXY_SERVERS];
    if (!config) {
      console.error(`❌ Unknown proxy: ${proxy}`);
      console.log('Available proxies:', Object.keys(PROXY_SERVERS).join(', '));
      process.exit(1);
    }
    
    console.log(`🚀 Starting ${config.name}...`);
    const scriptPath = path.join(__dirname, config.script);
    spawn('ts-node', [scriptPath], { stdio: 'inherit' });
  });

// List command
program
  .command('list')
  .description('List all available proxy servers')
  .action(() => {
    console.log('\n📋 Available Proxy Servers:\n');
    
    const categories = {
      infrastructure: ['vite-fix', 'monitoring', 'manager'],
      viewer: ['continuous-docs', 'script-viewer', 'markdown-viewer', 'docs-archive'],
      utility: ['git-operations', 'file-browser', 'audio-streaming', 'worktree-switcher'],
      management: ['html-browser']
    };
    
    for (const [category, proxies] of Object.entries(categories)) {
      console.log(`${category.charAt(0).toUpperCase() + category.slice(1)} Proxies:`);
      for (const proxyKey of proxies) {
        const config = PROXY_SERVERS[proxyKey as keyof typeof PROXY_SERVERS];
        console.log(`  - ${proxyKey.padEnd(20)} (port ${config.port}) - ${config.description}`);
      }
      console.log();
    }
  });

// Health check command
program
  .command('health-check')
  .description('Check health status of all running proxies')
  .action(async () => {
    console.log('\n🏥 Checking proxy server health...\n');
    
    for (const [key, config] of Object.entries(PROXY_SERVERS)) {
      try {
        const response = await fetch(`http://localhost:${config.port}/health`);
        if (response.ok) {
          console.log(`✅ ${config.name.padEnd(25)} (port ${config.port}) - Online`);
        } else {
          console.log(`❌ ${config.name.padEnd(25)} (port ${config.port}) - Offline`);
        }
      } catch (error) {
        console.log(`❌ ${config.name.padEnd(25)} (port ${config.port}) - Offline`);
      }
    }
    console.log();
  });

// Update registry command
program
  .command('update-registry')
  .description('Update sys_server_ports_registry database table')
  .action(() => {
    console.log('📝 Updating server registry...');
    const scriptPath = path.join(__dirname, 'update-server-registry.ts');
    spawn('ts-node', [scriptPath], { stdio: 'inherit' });
  });

// Dashboard command
program
  .command('dashboard')
  .description('Open the proxy server dashboard in dhg-service-test')
  .action(() => {
    console.log('🖥️  Opening proxy server dashboard...');
    console.log('Navigate to: http://localhost:5180 and click on "Proxy Dashboard"');
    console.log('\nIf the app is not running, start it with:');
    console.log('cd apps/dhg-service-test && pnpm dev');
  });

// Add autocomplete suggestions
program
  .command('start <proxy>')
  .addHelpText('after', `
Available proxies:
${Object.entries(PROXY_SERVERS).map(([key, config]) => 
  `  ${key.padEnd(20)} - ${config.description}`
).join('\n')}
`);

program.parse();