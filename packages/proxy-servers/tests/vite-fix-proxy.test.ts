import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

describe('ViteFixProxy', () => {
  let serverProcess: ChildProcess;
  const PORT = 9876;
  const BASE_URL = `http://localhost:${PORT}`;
  
  beforeAll(async () => {
    console.log('Starting Vite Fix Proxy for tests...');
    // Start the proxy server
    const scriptPath = path.join(__dirname, '../../../../scripts/cli-pipeline/proxy/start-vite-fix-proxy.ts');
    
    serverProcess = spawn('ts-node', [scriptPath], {
      cwd: path.join(__dirname, '../../../..'),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    // Capture output for debugging
    serverProcess.stdout?.on('data', (data) => {
      console.log(`[ViteFixProxy] ${data.toString()}`);
    });
    
    serverProcess.stderr?.on('data', (data) => {
      console.error(`[ViteFixProxy Error] ${data.toString()}`);
    });
    
    serverProcess.on('error', (error) => {
      console.error('Failed to start ViteFixProxy:', error);
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
      expect(response.data).toHaveProperty('service', 'Vite Fix Proxy');
    });
  });
  
  describe('Apps Endpoint', () => {
    it('should list available apps', async () => {
      const response = await axios.get(`${BASE_URL}/apps`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('apps');
      expect(Array.isArray(response.data.apps)).toBe(true);
    });
    
    it('should include dhg-service-test in apps list', async () => {
      const response = await axios.get(`${BASE_URL}/apps`);
      const appNames = response.data.apps.map((app: any) => app.name);
      expect(appNames).toContain('dhg-service-test');
    });
  });
  
  describe('Fix Endpoint', () => {
    it('should accept fix command', async () => {
      const response = await axios.post(`${BASE_URL}/fix`, {
        appName: 'dhg-service-test',
        nuclear: false
      });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
    });
    
    it('should validate app name', async () => {
      try {
        await axios.post(`${BASE_URL}/fix`, {
          appName: 'non-existent-app',
          nuclear: false
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
      }
    });
  });
  
  describe('CORS', () => {
    it('should have CORS enabled', async () => {
      const response = await axios.get(`${BASE_URL}/health`, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      expect(response.headers['access-control-allow-origin']).toBeTruthy();
    });
  });
});