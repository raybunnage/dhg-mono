import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseAdapterService, createSupabaseAdapter } from '../SupabaseAdapterService';
import { AdapterService } from '../../base-classes/AdapterService';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}));

const mockCreateClient = createClient as any;

describe('SupabaseAdapterService', () => {
  let originalWindow: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original values
    originalWindow = global.window;
    originalEnv = process.env;
    
    // Set up default mock
    mockCreateClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null, data: [] })
        })
      })
    });
  });

  afterEach(() => {
    // Restore original values
    global.window = originalWindow;
    process.env = originalEnv;
  });

  describe('inheritance', () => {
    it('should extend AdapterService', () => {
      const adapter = new SupabaseAdapterService();
      expect(adapter).toBeInstanceOf(AdapterService);
    });
  });

  describe('browser environment', () => {
    beforeEach(() => {
      // Simulate browser environment
      global.window = {} as any;
    });

    it('should require env in browser environment', async () => {
      const adapter = new SupabaseAdapterService();
      
      await expect(adapter.getSupabaseClient()).rejects.toThrow(
        'Environment variables must be provided for browser usage'
      );
    });

    it('should create client with browser env variables', async () => {
      const adapter = new SupabaseAdapterService({
        env: {
          VITE_SUPABASE_URL: 'https://test.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });

      await adapter.getSupabaseClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          })
        })
      );
    });

    it('should use service role key when specified', async () => {
      const adapter = new SupabaseAdapterService({
        useServiceRole: true,
        env: {
          VITE_SUPABASE_URL: 'https://test.supabase.co',
          VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
        }
      });

      await adapter.getSupabaseClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false
          })
        })
      );
    });

    it('should throw error for missing browser env variables', () => {
      expect(() => new SupabaseAdapterService({
        env: { VITE_SUPABASE_URL: 'https://test.supabase.co' }
      }).getSupabaseClient()).rejects.toThrow(
        'Missing required environment variable: VITE_SUPABASE_ANON_KEY'
      );
    });
  });

  describe('server environment', () => {
    beforeEach(() => {
      // Ensure we're in server environment
      delete (global as any).window;
      
      // Set up process.env
      process.env = {
        SUPABASE_URL: 'https://server.supabase.co',
        SUPABASE_ANON_KEY: 'server-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'server-service-key'
      };
    });

    it('should create client with server env variables', async () => {
      const adapter = new SupabaseAdapterService();
      
      await adapter.getSupabaseClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://server.supabase.co',
        'server-anon-key',
        expect.any(Object)
      );
    });

    it('should use service role in server environment', async () => {
      const adapter = new SupabaseAdapterService({ useServiceRole: true });
      
      await adapter.getSupabaseClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://server.supabase.co',
        'server-service-key',
        expect.any(Object)
      );
    });

    it('should throw error for missing server env variables', async () => {
      delete process.env.SUPABASE_URL;
      
      const adapter = new SupabaseAdapterService();
      
      await expect(adapter.getSupabaseClient()).rejects.toThrow(
        'Missing required environment variable: SUPABASE_URL'
      );
    });
  });

  describe('custom auth configuration', () => {
    beforeEach(() => {
      delete (global as any).window;
      process.env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };
    });

    it('should merge custom auth config', async () => {
      const adapter = new SupabaseAdapterService({
        authConfig: {
          storageKey: 'custom-storage-key',
          autoRefreshToken: false
        }
      });

      await adapter.getSupabaseClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            storageKey: 'custom-storage-key',
            autoRefreshToken: false,
            persistSession: true
          })
        })
      );
    });
  });

  describe('health check', () => {
    beforeEach(() => {
      delete (global as any).window;
      process.env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };
    });

    it('should report healthy when connected', async () => {
      const adapter = new SupabaseAdapterService();
      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toEqual({
        status: 'connected',
        environment: 'server',
        useServiceRole: false
      });
    });

    it('should report unhealthy on query error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ 
              error: { message: 'Connection failed' }, 
              data: null 
            })
          })
        })
      });

      const adapter = new SupabaseAdapterService();
      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details?.error).toBe('Connection failed');
      expect(health.details?.environment).toBe('server');
    });
  });

  describe('query execution', () => {
    beforeEach(() => {
      delete (global as any).window;
      process.env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };
    });

    it('should execute queries with retry', async () => {
      let attempts = 0;
      const mockQuery = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw { status: 500, message: 'Server error' };
        }
        return { data: 'success' };
      });

      const adapter = new SupabaseAdapterService();
      const result = await adapter.executeQuery(mockQuery);

      expect(result).toEqual({ data: 'success' });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      const mockQuery = vi.fn().mockRejectedValue({ 
        status: 400, 
        message: 'Bad request' 
      });

      const adapter = new SupabaseAdapterService();
      
      await expect(adapter.executeQuery(mockQuery)).rejects.toThrow('Bad request');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('utility methods', () => {
    it('should report correct environment', () => {
      // Server environment
      delete (global as any).window;
      const serverAdapter = new SupabaseAdapterService();
      expect(serverAdapter.getEnvironment()).toBe('server');

      // Browser environment
      global.window = {} as any;
      const browserAdapter = new SupabaseAdapterService({ env: {} });
      expect(browserAdapter.getEnvironment()).toBe('browser');
    });

    it('should report service role usage', () => {
      const regularAdapter = new SupabaseAdapterService();
      expect(regularAdapter.isUsingServiceRole()).toBe(false);

      const serviceRoleAdapter = new SupabaseAdapterService({ useServiceRole: true });
      expect(serviceRoleAdapter.isUsingServiceRole()).toBe(true);
    });
  });

  describe('factory function', () => {
    it('should create adapter using factory function', () => {
      delete (global as any).window;
      process.env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };

      const adapter = createSupabaseAdapter();
      
      expect(adapter).toBeInstanceOf(SupabaseAdapterService);
      expect(adapter.getEnvironment()).toBe('server');
    });
  });

  describe('metadata', () => {
    it('should return correct metadata', () => {
      const adapter = new SupabaseAdapterService();
      const metadata = adapter.getMetadata();

      expect(metadata).toEqual({
        name: 'SupabaseAdapterService',
        initialized: false,
        type: 'SupabaseAdapterService',
        version: '1.0.0'
      });
    });
  });
});