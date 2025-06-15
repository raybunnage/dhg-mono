#!/usr/bin/env ts-node

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const app = express();
const PORT = 9876;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Vite Fix Proxy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

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

// Start server
app.listen(PORT, () => {
  console.log(`[vite-fix-proxy] Server started on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[vite-fix-proxy] Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[vite-fix-proxy] Shutting down server...');
  process.exit(0);
});