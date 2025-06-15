#!/usr/bin/env ts-node

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';

const app = express();
const PORT = 9884;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Script Viewer Proxy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Basic info endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Script Viewer Proxy',
    port: PORT,
    status: 'running',
    endpoints: ['/health', '/']
  });
});

// Start server
app.listen(PORT, () => {
  console.log('[script-viewer-proxy] Server started on http://localhost:' + PORT);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[script-viewer-proxy] Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[script-viewer-proxy] Shutting down server...');
  process.exit(0);
});