import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configuration from CLAUDE.md
const PROXY_SERVERS = [
  { name: 'vite-fix-proxy', port: 9876, script: 'start-vite-fix-proxy.ts' },
  { name: 'continuous-monitoring-proxy', port: 9877, script: 'start-continuous-monitoring-proxy.ts' },
  { name: 'proxy-manager-proxy', port: 9878, script: 'start-proxy-manager-proxy.ts' },
  { name: 'git-operations-proxy', port: 9879, script: 'start-git-operations-proxy.ts' },
  { name: 'file-browser-proxy', port: 9880, script: 'start-file-browser-proxy.ts' },
  { name: 'continuous-docs-proxy', port: 9882, script: 'start-continuous-docs-proxy.ts' },
  { name: 'audio-streaming-proxy', port: 9883, script: 'start-audio-streaming-proxy.ts' },
  { name: 'script-viewer-proxy', port: 9884, script: 'start-script-viewer-proxy.ts' },
  { name: 'markdown-viewer-proxy', port: 9885, script: 'start-markdown-viewer-proxy.ts' },
  { name: 'docs-archive-proxy', port: 9886, script: 'start-docs-archive-proxy.ts' },
  { name: 'worktree-switcher-proxy', port: 9887, script: 'start-worktree-switcher-proxy.ts' },
  { name: 'cli-test-runner-proxy', port: 9890, script: 'start-cli-test-runner-proxy.ts' },
  { name: 'test-runner-proxy', port: 9891, script: 'start-test-runner-proxy.ts' }
];

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

describe('Proxy Server Health Checks', () => {
  const processes: Map<string, ChildProcess> = new Map();

  afterAll(async () => {
    // Clean up all spawned processes
    for (const [name, proc] of processes) {
      console.log(`Stopping ${name}...`);
      proc.kill('SIGTERM');
    }
    // Wait a bit for processes to clean up
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  PROXY_SERVERS.forEach(({ name, port, script }) => {
    it(`should start ${name} on port ${port} and respond to health check`, async () => {
      const scriptPath = path.join(__dirname, '../../../scripts/cli-pipeline/proxy', script);
      
      console.log(`Starting ${name} from ${scriptPath}...`);
      
      const proc = spawn('ts-node', ['--esm', scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      processes.set(name, proc);

      // Capture output for debugging
      proc.stdout?.on('data', (data) => {
        console.log(`[${name}] stdout:`, data.toString());
      });

      proc.stderr?.on('data', (data) => {
        console.error(`[${name}] stderr:`, data.toString());
      });

      proc.on('error', (error) => {
        console.error(`[${name}] Process error:`, error);
      });

      // Wait for server to start
      const isReady = await waitForServer(port);
      expect(isReady).toBe(true);

      // Test health endpoint
      const response = await axios.get(`http://localhost:${port}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'ok',
        service: name,
        port: port
      });
    }, 60000); // 60 second timeout per test
  });
});