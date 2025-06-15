/**
 * SupabaseAdapterService Tests
 * 
 * Tests the Supabase adapter service that handles environment-specific
 * client creation for both browser and Node.js environments with
 * proper credential management and configuration validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseAdapterService, SupabaseAdapterConfig } from '../SupabaseAdapterService';
import { createClient } from '@supabase/supabase-js';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null })
  }))
}));

describe('SupabaseAdapterService', () => {
  let service: SupabaseAdapterService;
  let originalWindow: any;
  let originalProcessEnv: NodeJS.ProcessEnv;

  // Test environment configurations
  const browserEnv = {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
  };

  const nodeEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original environment
    originalWindow = global.window;
    originalProcessEnv = { ...process.env };
    
    // Clear process.env
    Object.keys(process.env).forEach(key => {
      if (key.includes('SUPABASE')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original environment
    global.window = originalWindow;
    process.env = originalProcessEnv;
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      // Simulate browser environment
      global.window = {} as any;
    });

    it('should create adapter in browser with environment variables', () => {
      const config: SupabaseAdapterConfig = {
        env: browserEnv
      };

      expect(() => {
        service = new SupabaseAdapterService(config);
      }).not.toThrow();
    });

    it('should require env config in browser environment', () => {
      expect(() => {
        service = new SupabaseAdapterService({});
      }).toThrow('Environment variables must be provided for browser usage');
    });

    it('should validate missing URL in browser', () => {
      const config: SupabaseAdapterConfig = {
        env: {
          VITE_SUPABASE_ANON_KEY: 'test-key'
        }
      };

      service = new SupabaseAdapterService(config);
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL'
      );
    });

    it('should validate missing anon key in browser', () => {
      const config: SupabaseAdapterConfig = {
        env: {
          VITE_SUPABASE_URL: 'https://test.supabase.co'
        }
      };

      service = new SupabaseAdapterService(config);
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY'
      );
    });

    it('should validate missing service role key when requested', () => {
      const config: SupabaseAdapterConfig = {
        env: {
          VITE_SUPABASE_URL: 'https://test.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'test-anon-key'
        },
        useServiceRole: true
      };

      service = new SupabaseAdapterService(config);
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY'
      );
    });

    it('should create client with anon key by default', () => {
      const config: SupabaseAdapterConfig = {
        env: browserEnv
      };

      service = new SupabaseAdapterService(config);
      const client = service.getClient();

      expect(createClient).toHaveBeenCalledWith(
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

    it('should create client with service role key when requested', () => {
      const config: SupabaseAdapterConfig = {
        env: browserEnv,
        useServiceRole: true
      };

      service = new SupabaseAdapterService(config);
      const client = service.getClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false
          })
        })
      );
    });

    it('should use custom auth configuration', () => {
      const config: SupabaseAdapterConfig = {
        env: browserEnv,
        authConfig: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          storageKey: 'custom-storage-key'
        }
      };

      service = new SupabaseAdapterService(config);
      const client = service.getClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
            storageKey: 'custom-storage-key'
          })
        })
      );
    });

    it('should fallback to non-VITE environment variables', () => {
      const config: SupabaseAdapterConfig = {
        env: {
          SUPABASE_URL: 'https://fallback.supabase.co',
          SUPABASE_ANON_KEY: 'fallback-anon-key'
        }
      };

      service = new SupabaseAdapterService(config);
      const client = service.getClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://fallback.supabase.co',
        'fallback-anon-key',
        expect.any(Object)
      );
    });
  });

  describe('Node.js Environment', () => {
    beforeEach(() => {
      // Simulate Node.js environment
      delete (global as any).window;
      
      // Set up process.env
      Object.assign(process.env, nodeEnv);
    });

    it('should create adapter in Node.js with process.env', () => {
      expect(() => {
        service = new SupabaseAdapterService({});
      }).not.toThrow();
    });

    it('should validate missing URL in Node.js', () => {
      delete process.env.SUPABASE_URL;

      service = new SupabaseAdapterService({});
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: SUPABASE_URL'
      );
    });

    it('should validate missing anon key in Node.js', () => {
      delete process.env.SUPABASE_ANON_KEY;

      service = new SupabaseAdapterService({});
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: SUPABASE_ANON_KEY'
      );
    });

    it('should validate missing service role key when requested', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      service = new SupabaseAdapterService({ useServiceRole: true });
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY'
      );
    });

    it('should create client with anon key by default', () => {
      service = new SupabaseAdapterService({});
      const client = service.getClient();

      expect(createClient).toHaveBeenCalledWith(
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

    it('should create client with service role key when requested', () => {
      service = new SupabaseAdapterService({ useServiceRole: true });
      const client = service.getClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false
          })
        })
      );
    });
  });

  describe('Client Lifecycle', () => {
    beforeEach(() => {
      Object.assign(process.env, nodeEnv);
    });

    it('should return the same client instance on multiple calls', () => {
      service = new SupabaseAdapterService({});
      
      const client1 = service.getClient();
      const client2 = service.getClient();
      
      expect(client1).toBe(client2);
      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it('should recreate client after reset', () => {
      service = new SupabaseAdapterService({});
      
      const client1 = service.getClient();
      service.reset();
      const client2 = service.getClient();
      
      expect(client1).not.toBe(client2);
      expect(createClient).toHaveBeenCalledTimes(2);
    });

    it('should update configuration and recreate client', () => {
      service = new SupabaseAdapterService({});
      
      const client1 = service.getClient();
      
      service.updateConfig({ useServiceRole: true });
      const client2 = service.getClient();
      
      expect(client1).not.toBe(client2);
      expect(createClient).toHaveBeenCalledTimes(2);
      
      // Second call should use service role key
      expect(createClient).toHaveBeenLastCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        expect.any(Object)
      );
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      Object.assign(process.env, nodeEnv);
    });

    it('should perform health check successfully', async () => {
      service = new SupabaseAdapterService({});
      service.getClient(); // Initialize client
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.serviceName).toBe('SupabaseAdapterService');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toMatchObject({
        hasClient: true,
        environment: 'nodejs',
        useServiceRole: false,
        connected: true
      });
    });

    it('should report unhealthy when client creation fails', async () => {
      delete process.env.SUPABASE_URL;
      
      service = new SupabaseAdapterService({});
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details?.hasClient).toBe(false);
      expect(health.error).toContain('Missing required environment variable');
    });

    it('should detect connection issues', async () => {
      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: null, 
          error: new Error('Connection failed') 
        })
      };
      
      (createClient as any).mockReturnValue(mockClient);
      
      service = new SupabaseAdapterService({});
      service.getClient();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details?.connected).toBe(false);
      expect(health.error).toBe('Connection failed');
    });
  });

  describe('Configuration Options', () => {
    beforeEach(() => {
      Object.assign(process.env, nodeEnv);
    });

    it('should apply custom fetch options', () => {
      const customFetch = vi.fn();
      
      service = new SupabaseAdapterService({
        authConfig: {
          persistSession: false
        }
      });
      
      const client = service.getClient();
      
      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false
          })
        })
      );
    });

    it('should use debug mode when configured', () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      
      service = new SupabaseAdapterService({}, logger);
      service.getClient();
      
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Creating Supabase client')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle createClient errors gracefully', () => {
      (createClient as any).mockImplementation(() => {
        throw new Error('Failed to create client');
      });
      
      Object.assign(process.env, nodeEnv);
      service = new SupabaseAdapterService({});
      
      expect(() => service.getClient()).toThrow('Failed to create client');
    });

    it('should provide helpful error messages for missing credentials', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      
      service = new SupabaseAdapterService({});
      
      expect(() => service.getClient()).toThrow(
        'Missing required environment variable: SUPABASE_URL'
      );
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for client operations', () => {
      Object.assign(process.env, nodeEnv);
      
      service = new SupabaseAdapterService({});
      const client = service.getClient();
      
      // Verify client has expected methods
      expect(client.from).toBeDefined();
      expect(client.auth).toBeDefined();
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      Object.assign(process.env, nodeEnv);
    });

    it('should cache client creation for performance', () => {
      service = new SupabaseAdapterService({});
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        service.getClient();
      }
      const duration = Date.now() - startTime;
      
      // Should be very fast due to caching
      expect(duration).toBeLessThan(50);
      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid configuration updates', () => {
      service = new SupabaseAdapterService({});
      
      // Rapid updates
      for (let i = 0; i < 10; i++) {
        service.updateConfig({ 
          useServiceRole: i % 2 === 0 
        });
        service.getClient();
      }
      
      // Should have created a client for each unique config
      expect(createClient).toHaveBeenCalledTimes(10);
    });
  });
});