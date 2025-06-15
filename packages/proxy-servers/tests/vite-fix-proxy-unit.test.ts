import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import { ViteFixProxy } from '../servers/vite-fix-proxy/ViteFixProxy';

describe('ViteFixProxy Unit Tests', () => {
  let proxy: ViteFixProxy;
  const PORT = 19876; // Use different port to avoid conflicts
  const BASE_URL = `http://localhost:${PORT}`;
  
  beforeAll(async () => {
    // Create and start proxy directly
    proxy = new ViteFixProxy({ port: PORT });
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
      expect(response.data).toHaveProperty('service', 'vite-fix-proxy');
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
    it('should reject request without appName', async () => {
      try {
        await axios.post(`${BASE_URL}/fix`, {
          action: 'fix'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data?.error).toContain('Missing appName');
      }
    });
    
    it('should reject request without action', async () => {
      try {
        await axios.post(`${BASE_URL}/fix`, {
          appName: 'dhg-service-test'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data?.error).toContain('Missing appName or action');
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