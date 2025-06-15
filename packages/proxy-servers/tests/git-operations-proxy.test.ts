import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

describe('GitOperationsProxy', () => {
  let serverProcess: ChildProcess;
  const PORT = 9879;
  const BASE_URL = `http://localhost:${PORT}`;
  
  beforeAll(async () => {
    console.log('Starting Git Operations Proxy for tests...');
    // Start the proxy server
    const scriptPath = path.join(__dirname, '../../../../scripts/cli-pipeline/proxy/start-git-operations-proxy.ts');
    
    serverProcess = spawn('ts-node', [scriptPath], {
      cwd: path.join(__dirname, '../../../..'),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    // Capture output for debugging
    serverProcess.stdout?.on('data', (data) => {
      console.log(`[GitOpsProxy] ${data.toString()}`);
    });
    
    serverProcess.stderr?.on('data', (data) => {
      console.error(`[GitOpsProxy Error] ${data.toString()}`);
    });
    
    serverProcess.on('error', (error) => {
      console.error('Failed to start GitOpsProxy:', error);
    });
    
    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }, 15000);
  
  afterAll(async () => {
    // Stop the server
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  });
  
  describe('Health Check', () => {
    it('should return 200 from health endpoint', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('service', 'Git Operations Proxy');
    });
  });
  
  describe('Git Status', () => {
    it('should return git status', async () => {
      const response = await axios.get(`${BASE_URL}/git/status`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('branch');
      expect(response.data).toHaveProperty('isClean');
      expect(response.data).toHaveProperty('modifiedFiles');
    });
  });
  
  describe('Git Branches', () => {
    it('should list branches', async () => {
      const response = await axios.get(`${BASE_URL}/git/branches`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('current');
      expect(response.data).toHaveProperty('local');
      expect(Array.isArray(response.data.local)).toBe(true);
    });
  });
  
  describe('Worktrees', () => {
    it('should list worktrees', async () => {
      const response = await axios.get(`${BASE_URL}/worktrees`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('worktrees');
      expect(Array.isArray(response.data.worktrees)).toBe(true);
    });
    
    it('should return worktree details', async () => {
      const response = await axios.get(`${BASE_URL}/worktrees`);
      if (response.data.worktrees.length > 0) {
        const worktree = response.data.worktrees[0];
        expect(worktree).toHaveProperty('path');
        expect(worktree).toHaveProperty('branch');
        expect(worktree).toHaveProperty('HEAD');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid endpoints', async () => {
      try {
        await axios.get(`${BASE_URL}/invalid-endpoint`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });
  });
});