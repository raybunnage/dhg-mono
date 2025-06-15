import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function waitForServer(port: number, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`http://localhost:${port}/health`);
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

describe('Proxy Server Endpoint Tests', () => {
  let gitOpsProcess: ChildProcess;
  let viteFixProcess: ChildProcess;
  let cliTestProcess: ChildProcess;

  beforeAll(async () => {
    // Start Git Operations Proxy
    const gitOpsPath = path.join(__dirname, '../../../scripts/cli-pipeline/proxy/start-git-operations-proxy.ts');
    gitOpsProcess = spawn('ts-node', ['--esm', gitOpsPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Start Vite Fix Proxy
    const viteFixPath = path.join(__dirname, '../../../scripts/cli-pipeline/proxy/start-vite-fix-proxy.ts');
    viteFixProcess = spawn('ts-node', ['--esm', viteFixPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Start CLI Test Runner Proxy
    const cliTestPath = path.join(__dirname, '../../../scripts/cli-pipeline/proxy/start-cli-test-runner-proxy.ts');
    cliTestProcess = spawn('ts-node', ['--esm', cliTestPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for all servers to start
    const [gitOpsReady, viteFixReady, cliTestReady] = await Promise.all([
      waitForServer(9879),
      waitForServer(9876),
      waitForServer(9890)
    ]);

    expect(gitOpsReady).toBe(true);
    expect(viteFixReady).toBe(true);
    expect(cliTestReady).toBe(true);
  }, 60000);

  afterAll(async () => {
    // Clean up processes
    gitOpsProcess?.kill('SIGTERM');
    viteFixProcess?.kill('SIGTERM');
    cliTestProcess?.kill('SIGTERM');
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Git Operations Proxy (9879)', () => {
    it('should return git status', async () => {
      const response = await axios.get('http://localhost:9879/api/git/status');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('branch');
      expect(response.data).toHaveProperty('files');
    });

    it('should return git branches', async () => {
      const response = await axios.get('http://localhost:9879/api/git/branches');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('branches');
      expect(Array.isArray(response.data.branches)).toBe(true);
    });

    it('should return worktrees', async () => {
      const response = await axios.get('http://localhost:9879/api/git/worktrees');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('worktrees');
      expect(Array.isArray(response.data.worktrees)).toBe(true);
    });
  });

  describe('Vite Fix Proxy (9876)', () => {
    it('should return apps list', async () => {
      const response = await axios.get('http://localhost:9876/api/apps');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('apps');
      expect(Array.isArray(response.data.apps)).toBe(true);
    });

    it('should handle fix request', async () => {
      const response = await axios.post('http://localhost:9876/api/fix', {
        app: 'dhg-hub',
        nuclear: false
      });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
    });
  });

  describe('CLI Test Runner Proxy (9890)', () => {
    it('should return test groups', async () => {
      const response = await axios.get('http://localhost:9890/api/test-groups');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('groups');
      expect(Array.isArray(response.data.groups)).toBe(true);
    });

    it('should return test status', async () => {
      const response = await axios.get('http://localhost:9890/api/test-status');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('running');
      expect(response.data).toHaveProperty('results');
    });
  });
});