import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import { GitOperationsProxy } from '../servers/git-operations/GitOperationsProxy';

describe('GitOperationsProxy Unit Tests', () => {
  let proxy: GitOperationsProxy;
  const PORT = 19879; // Use different port to avoid conflicts
  const BASE_URL = `http://localhost:${PORT}`;
  
  beforeAll(async () => {
    // Create and start proxy directly
    proxy = new GitOperationsProxy({ port: PORT });
    await proxy.start();
    // Give it a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    // Stop the proxy
    if (proxy) {
      await proxy.stop();
    }
  });
  
  describe('Health Check', () => {
    it('should return 200 from health endpoint', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('service', 'git-operations');
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