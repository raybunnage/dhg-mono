import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Mock modules
vi.mock('fs');
vi.mock('path');
vi.mock('@supabase/supabase-js');

import { SupabaseClientService } from '../SupabaseClientService';
import { SingletonService } from '../../base-classes/SingletonService';

describe('SupabaseClientService', () => {
  const mockExistsSync = vi.mocked(fs.existsSync);
  const mockReadFileSync = vi.mocked(fs.readFileSync);
  const mockResolve = vi.mocked(path.resolve);
  const mockDirname = vi.mocked(path.dirname);
  const mockCreateClient = vi.mocked(createClient);

  beforeEach(() => {
    // Clear singleton instances
    (SingletonService as any).instances.clear();
    
    vi.clearAllMocks();
    
    // Setup default mocks
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(`
SUPABASE_URL=https://test.supabase.co
SUPABASE_SERVICE_ROLE_KEY=test-service-key
SUPABASE_ANON_KEY=test-anon-key
    `);
    mockResolve.mockImplementation((dir, file) => `${dir}/${file}`);
    mockDirname.mockImplementation(dir => dir.split('/').slice(0, -1).join('/'));
    
    // Mock Supabase client
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ error: null, data: [] }))
        }))
      })),
      removeAllChannels: vi.fn(() => Promise.resolve())
    } as any);
  });

  afterEach(() => {
    // Clean up
    (SingletonService as any).instances.clear();
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = SupabaseClientService.getInstance();
      const instance2 = SupabaseClientService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should extend SingletonService', () => {
      const instance = SupabaseClientService.getInstance();
      expect(instance).toBeInstanceOf(SingletonService);
    });
  });

  describe('initialization', () => {
    it('should initialize on first client request', async () => {
      const service = SupabaseClientService.getInstance();
      
      // Should not be initialized yet
      expect(mockCreateClient).not.toHaveBeenCalled();
      
      // Request client
      await service.getClient();
      
      // Should now be initialized
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key',
        expect.any(Object)
      );
    });

    it('should load credentials from .env.development', async () => {
      const service = SupabaseClientService.getInstance();
      await service.getClient();
      
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env.development'),
        'utf8'
      );
    });

    it('should throw error if credentials not found', async () => {
      // Mock empty env file - no credentials
      mockReadFileSync.mockReturnValue(`
# Empty env file
SOME_OTHER_VAR=value
      `);
      
      // Also ensure process.env doesn't have credentials
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SUPABASE_URL: undefined,
        VITE_SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        VITE_SUPABASE_SERVICE_ROLE_KEY: undefined,
        SUPABASE_ANON_KEY: undefined,
        VITE_SUPABASE_ANON_KEY: undefined
      };
      
      const service = SupabaseClientService.getInstance();
      
      try {
        await expect(service.getClient()).rejects.toThrow(
          'Unable to find Supabase credentials'
        );
      } finally {
        // Restore process.env
        process.env = originalEnv;
      }
    });

    it('should configure timeout for fetch operations', async () => {
      const service = SupabaseClientService.getInstance();
      await service.getClient();
      
      // Check that createClient was called with fetch override
      const [, , options] = mockCreateClient.mock.calls[0];
      expect(options.global).toBeDefined();
      expect(options.global.fetch).toBeDefined();
    });
  });

  describe('health check', () => {
    it('should report healthy when connected', async () => {
      const service = SupabaseClientService.getInstance();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.details).toEqual({ status: 'connected' });
    });

    it('should report unhealthy on query error', async () => {
      // Mock query error
      mockCreateClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ 
              error: { message: 'Table not found' }, 
              data: null 
            }))
          }))
        })),
        removeAllChannels: vi.fn()
      } as any);
      
      const service = SupabaseClientService.getInstance();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details).toEqual({ error: 'Table not found' });
    });
  });

  describe('resource management', () => {
    it('should release resources on shutdown', async () => {
      const mockRemoveChannels = vi.fn();
      mockCreateClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ error: null, data: [] }))
          }))
        })),
        removeAllChannels: mockRemoveChannels
      } as any);
      
      const service = SupabaseClientService.getInstance();
      await service.getClient();
      
      // Shutdown
      await service.shutdown();
      
      expect(mockRemoveChannels).toHaveBeenCalled();
    });
  });

  describe('backwards compatibility', () => {
    it('should support testConnection method', async () => {
      const service = SupabaseClientService.getInstance();
      const result = await service.testConnection();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('details');
      expect(result.error).toBeUndefined();
    });
  });

  describe('metadata', () => {
    it('should return correct metadata', () => {
      const service = SupabaseClientService.getInstance();
      const metadata = service.getMetadata();
      
      expect(metadata).toEqual({
        name: 'SupabaseClientService',
        initialized: false,
        type: 'SupabaseClientService',
        version: '1.0.0'
      });
    });
  });
});