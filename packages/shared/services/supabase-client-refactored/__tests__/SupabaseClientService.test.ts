import { SupabaseClientService } from '../SupabaseClientService';
import { SingletonService } from '../../base-classes/SingletonService';

// Mock fs and path for Node.js environment
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

jest.mock('path', () => ({
  resolve: jest.fn((dir, file) => `${dir}/${file}`),
  dirname: jest.fn(dir => dir.split('/').slice(0, -1).join('/'))
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ error: null, data: [] }))
      }))
    })),
    removeAllChannels: jest.fn(() => Promise.resolve())
  }))
}));

describe('SupabaseClientService', () => {
  let mockFs: any;
  let mockPath: any;
  let mockCreateClient: jest.Mock;

  beforeEach(() => {
    // Clear singleton instances
    (SingletonService as any).instances.clear();
    
    // Reset mocks
    mockFs = require('fs');
    mockPath = require('path');
    mockCreateClient = require('@supabase/supabase-js').createClient;
    
    jest.clearAllMocks();
    
    // Mock env file reading
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`
SUPABASE_URL=https://test.supabase.co
SUPABASE_SERVICE_ROLE_KEY=test-service-key
SUPABASE_ANON_KEY=test-anon-key
    `);
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
      
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env.development'),
        'utf8'
      );
    });

    it('should throw error if credentials not found', async () => {
      mockFs.readFileSync.mockReturnValue('');
      
      const service = SupabaseClientService.getInstance();
      
      await expect(service.getClient()).rejects.toThrow(
        'Unable to find Supabase credentials'
      );
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
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ 
              error: { message: 'Table not found' }, 
              data: null 
            }))
          }))
        })),
        removeAllChannels: jest.fn()
      });
      
      const service = SupabaseClientService.getInstance();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details).toEqual({ error: 'Table not found' });
    });
  });

  describe('resource management', () => {
    it('should release resources on shutdown', async () => {
      const mockRemoveChannels = jest.fn();
      mockCreateClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ error: null, data: [] }))
          }))
        })),
        removeAllChannels: mockRemoveChannels
      });
      
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
      expect(result.success).toBe(true);
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