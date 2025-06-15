#!/usr/bin/env ts-node

/**
 * Consolidated System Management Proxy Server
 * Combines functionality from:
 * - vite-fix-proxy (Vite environment fixes)
 * - continuous-monitoring-proxy (System monitoring - placeholder)
 * - proxy-manager-proxy (Proxy control - placeholder)
 * - git-operations-proxy (Git operations)
 * - worktree-switcher-proxy (Worktree management - merged with git)
 */

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const app = express();
const PORT = 9878; // Using proxy-manager-proxy's port as it's central

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'System Management Proxy (Consolidated)',
    port: PORT,
    capabilities: ['vite-fixes', 'git-operations', 'monitoring', 'proxy-management', 'worktree-management'],
    consolidatedFrom: [
      'vite-fix-proxy (9876)',
      'continuous-monitoring-proxy (9877)',
      'proxy-manager-proxy (9878)',
      'git-operations-proxy (9879)',
      'worktree-switcher-proxy (9887)'
    ],
    timestamp: new Date().toISOString()
  });
});

// Basic info endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'System Management Proxy',
    description: 'Consolidated proxy for system administration and development workflow',
    port: PORT,
    status: 'running',
    endpoints: {
      general: ['/health', '/'],
      viteFix: ['/apps', '/fix'],
      git: ['/git/status', '/git/branches', '/worktrees'],
      monitoring: ['/monitoring/status', '/monitoring/health-check'],
      proxyManager: ['/proxies/list', '/proxies/status']
    }
  });
});

// ============ VITE FIX ENDPOINTS (from vite-fix-proxy) ============

// List available apps
app.get('/apps', (_req: Request, res: Response) => {
  try {
    const appsDir = join(process.cwd(), 'apps');
    if (!existsSync(appsDir)) {
      res.json({ apps: [] });
      return;
    }
    
    const apps = execSync(`find ${appsDir} -maxdepth 1 -type d`, { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean)
      .filter(path => path !== appsDir)
      .map(path => ({
        name: path.split('/').pop(),
        path: path.trim()
      }));
    
    res.json({ apps });
  } catch (error) {
    res.json({ apps: [] });
  }
});

// Fix endpoint
app.post('/fix', (req: Request, res: Response) => {
  const { appName, action } = req.body;
  
  if (!appName || !action) {
    res.status(400).json({
      success: false,
      error: 'Missing appName or action'
    });
    return;
  }

  res.json({
    success: true,
    message: `Would execute ${action} for ${appName}`,
    appName,
    action
  });
});

// ============ GIT OPERATIONS ENDPOINTS (from git-operations-proxy) ============

// Git status
app.get('/git/status', (_req: Request, res: Response) => {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: process.cwd() });
    const branch = execSync('git branch --show-current', { encoding: 'utf-8', cwd: process.cwd() }).trim();
    
    const modifiedFiles = status.split('\n').filter(Boolean).map(line => {
      const statusCode = line.substring(0, 2);
      const filename = line.substring(3);
      return { status: statusCode.trim(), filename };
    });

    res.json({
      branch,
      isClean: modifiedFiles.length === 0,
      modifiedFiles
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get git status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Git branches
app.get('/git/branches', (_req: Request, res: Response) => {
  try {
    const current = execSync('git branch --show-current', { encoding: 'utf-8', cwd: process.cwd() }).trim();
    const local = execSync('git branch', { encoding: 'utf-8', cwd: process.cwd() })
      .split('\n')
      .filter(Boolean)
      .map(branch => branch.replace(/^\*?\s*/, ''));

    res.json({ current, local });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get branches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Worktrees (combines git-operations and worktree-switcher functionality)
app.get('/worktrees', (_req: Request, res: Response) => {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf-8', cwd: process.cwd() });
    const worktrees = [];
    
    const lines = output.split('\n');
    let current: any = {};
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.HEAD = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      }
    }
    
    if (current.path) worktrees.push(current);

    res.json({ worktrees });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get worktrees',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============ MONITORING ENDPOINTS (placeholder for continuous-monitoring-proxy) ============

// System monitoring status
app.get('/monitoring/status', (_req: Request, res: Response) => {
  res.json({
    status: 'placeholder',
    message: 'Monitoring functionality to be implemented',
    timestamp: new Date().toISOString()
  });
});

// Health check all systems
app.get('/monitoring/health-check', (_req: Request, res: Response) => {
  res.json({
    status: 'placeholder',
    message: 'System health check functionality to be implemented',
    timestamp: new Date().toISOString()
  });
});

// ============ PROXY MANAGER ENDPOINTS (placeholder for proxy-manager-proxy) ============

// List all proxies
app.get('/proxies/list', (_req: Request, res: Response) => {
  res.json({
    status: 'placeholder',
    message: 'Proxy listing functionality to be implemented',
    proxies: []
  });
});

// Get proxy status
app.get('/proxies/status', (_req: Request, res: Response) => {
  res.json({
    status: 'placeholder',
    message: 'Proxy status functionality to be implemented'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎛️  System Management Proxy Server (Consolidated) running on http://localhost:${PORT}`);
  console.log(`📍 This server combines functionality from:`);
  console.log(`   - vite-fix-proxy (Vite environment fixes)`);
  console.log(`   - continuous-monitoring-proxy (System monitoring)`);
  console.log(`   - proxy-manager-proxy (Proxy control)`);
  console.log(`   - git-operations-proxy (Git operations)`);
  console.log(`   - worktree-switcher-proxy (Worktree management)`);
  console.log(`\n🛠️  Vite Fix Endpoints:`);
  console.log(`   GET    /apps                     - List available apps`);
  console.log(`   POST   /fix                      - Fix Vite issues`);
  console.log(`\n🐙 Git Operations Endpoints:`);
  console.log(`   GET    /git/status               - Git repository status`);
  console.log(`   GET    /git/branches             - List git branches`);
  console.log(`   GET    /worktrees                - List git worktrees`);
  console.log(`\n📊 Monitoring Endpoints (placeholders):`);
  console.log(`   GET    /monitoring/status        - System monitoring status`);
  console.log(`   GET    /monitoring/health-check  - Check all systems health`);
  console.log(`\n🔧 Proxy Manager Endpoints (placeholders):`);
  console.log(`   GET    /proxies/list             - List all proxy servers`);
  console.log(`   GET    /proxies/status           - Get proxy server status`);
  console.log(`\n🏥 General Endpoints:`);
  console.log(`   GET    /health                   - Health check`);
  console.log(`   GET    /                         - Server info and endpoints`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down System Management Proxy Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down System Management Proxy Server...');
  process.exit(0);
});