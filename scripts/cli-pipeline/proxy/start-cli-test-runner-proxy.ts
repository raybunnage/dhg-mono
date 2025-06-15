#!/usr/bin/env ts-node

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';

const app = express();
const PORT = 9890;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CLI Test Runner Proxy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Test status endpoints
app.get('/cli-tests/status-alpha', (_req: Request, res: Response) => {
  res.json({
    group: 'alpha',
    status: 'ready',
    tests: []
  });
});

app.get('/cli-tests/status-beta', (_req: Request, res: Response) => {
  res.json({
    group: 'beta', 
    status: 'ready',
    tests: []
  });
});

app.get('/cli-tests/status-gamma', (_req: Request, res: Response) => {
  res.json({
    group: 'gamma',
    status: 'ready', 
    tests: []
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[cli-test-runner-proxy] Server started on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[cli-test-runner-proxy] Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[cli-test-runner-proxy] Shutting down server...');
  process.exit(0);
});