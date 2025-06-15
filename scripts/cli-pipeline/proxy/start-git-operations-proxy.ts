#!/usr/bin/env ts-node

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { execSync } from 'child_process';

const app = express();
const PORT = 9879;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Git Operations Proxy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

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

// Worktrees
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

// Start server
app.listen(PORT, () => {
  console.log(`[git-operations-proxy] Server started on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[git-operations-proxy] Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[git-operations-proxy] Shutting down server...');
  process.exit(0);
});