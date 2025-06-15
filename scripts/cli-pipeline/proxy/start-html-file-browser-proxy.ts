#!/usr/bin/env ts-node

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'HTML File Browser Proxy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Basic info endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'HTML File Browser Proxy',
    port: PORT,
    status: 'running',
    endpoints: ['/health', '/']
  });
});

// Start server
app.listen(PORT, () => {
  console.log('[html-file-browser-proxy] Server started on http://localhost:' + PORT);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[html-file-browser-proxy] Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[html-file-browser-proxy] Shutting down server...');
  process.exit(0);
});