/**
 * EnvConfigService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvConfigService } from './EnvConfigService';

describe('EnvConfigService', () => {
  let service: EnvConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original env
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env = {
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key-1234567890',
      CLAUDE_API_KEY: 'test-claude-key',
      APP_NAME: 'test-app',
      APP_ENV: 'test',
      FEATURE_FLAGS: 'feature1,feature2,feature3',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@serviceaccount.com'
    };
  });

  afterEach(async () => {
    // Restore original env
    process.env = originalEnv;
    
    // Reset singleton instance for tests
    if (service) {
      await service.shutdown();
    }
    (EnvConfigService as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = EnvConfigService.getInstance();
      const instance2 = EnvConfigService.getInstance();
      expect(instance1).toBe(instance2);
      service = instance1; // For cleanup
    });

    it('should prevent instantiation in browser environment', () => {
      // Mock browser environment
      (global as any).window = { document: {} };
      
      expect(() => {
        EnvConfigService.getInstance();
      }).toThrow('EnvConfigService should not be used in browser environments');
      
      // Clean up
      delete (global as any).window;
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with valid environment', async () => {
      service = EnvConfigService.getInstance();
      
      // Initialize is called internally
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should warn about missing required variables during initialization', async () => {
      // Remove required variables
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      
      service = EnvConfigService.getInstance();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.missingRequired).toContain('SUPABASE_URL');
      expect(health.details.missingRequired).toContain('SUPABASE_ANON_KEY');
    });

    it('should cleanup sensitive data on shutdown', async () => {
      service = EnvConfigService.getInstance();
      
      // Verify config is loaded
      expect(service.get('SUPABASE_URL')).toBe('https://test.supabase.co');
      
      // Cleanup
      await service['cleanup']();
      
      // Config should be cleared
      expect(service.getAll()).toEqual({});
    });
  });

  describe('Environment Variable Access', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should get environment variable values', () => {
      expect(service.get('SUPABASE_URL')).toBe('https://test.supabase.co');
      expect(service.get('APP_NAME')).toBe('test-app');
      expect(service.get('CLAUDE_API_KEY')).toBe('test-claude-key');
    });

    it('should return undefined for missing variables', () => {
      expect(service.get('MISSING_VAR' as any)).toBeUndefined();
    });

    it('should get required variables or throw', () => {
      expect(service.getRequired('SUPABASE_URL')).toBe('https://test.supabase.co');
      
      expect(() => {
        service.getRequired('MISSING_REQUIRED' as any);
      }).toThrow('Missing required environment variable: MISSING_REQUIRED');
    });

    it('should check if variables exist', () => {
      expect(service.has('SUPABASE_URL')).toBe(true);
      expect(service.has('MISSING_VAR' as any)).toBe(false);
    });

    it('should get all environment variables', () => {
      const all = service.getAll();
      expect(all).toHaveProperty('SUPABASE_URL');
      expect(all).toHaveProperty('APP_NAME');
      expect(all).toHaveProperty('CLAUDE_API_KEY');
    });
  });

  describe('Environment Detection', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should detect environment type', () => {
      expect(service.getEnvironment()).toBe('test');
      expect(service.isTest()).toBe(true);
      expect(service.isDevelopment()).toBe(false);
      expect(service.isProduction()).toBe(false);
    });

    it('should fall back to NODE_ENV if APP_ENV not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.APP_ENV;
      
      // Need to reload config
      service.reload();
      
      expect(service.getEnvironment()).toBe('development');
      expect(service.isDevelopment()).toBe(true);
    });
  });

  describe('Feature Flags', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should parse feature flags correctly', () => {
      const flags = service.getFeatureFlags();
      expect(flags).toEqual(['feature1', 'feature2', 'feature3']);
    });

    it('should check individual feature flags', () => {
      expect(service.hasFeatureFlag('feature1')).toBe(true);
      expect(service.hasFeatureFlag('feature2')).toBe(true);
      expect(service.hasFeatureFlag('nonexistent')).toBe(false);
    });

    it('should handle missing feature flags', () => {
      delete process.env.FEATURE_FLAGS;
      service.reload();
      
      expect(service.getFeatureFlags()).toEqual([]);
      expect(service.hasFeatureFlag('any')).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should validate valid API keys', () => {
      const result = service.validateApiKey('valid_api_key_1234567890');
      expect(result.valid).toBe(true);
      expect(result.message).toBe('Key appears valid');
    });

    it('should reject missing keys', () => {
      const result = service.validateApiKey(undefined);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Key is missing');
    });

    it('should reject short keys', () => {
      const result = service.validateApiKey('short_key');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Key is too short');
    });

    it('should reject invalid format', () => {
      const result = service.validateApiKey('invalidkeyformatwithoutseparator');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Key has invalid format');
    });

    it('should reject placeholder keys', () => {
      const result = service.validateApiKey('your-api-key-here-1234567890');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Key appears to be a placeholder');
    });
  });

  describe('Diagnostics', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should provide comprehensive diagnostics', () => {
      const diagnostics = service.getDiagnostics();
      
      expect(diagnostics).toEqual({
        environment: 'test',
        isBrowser: false,
        hasSupabaseConfig: true,
        hasClaudeConfig: true,
        hasGoogleConfig: true,
        missingRequired: []
      });
    });

    it('should detect missing required configuration', () => {
      delete process.env.SUPABASE_URL;
      service.reload();
      
      const diagnostics = service.getDiagnostics();
      expect(diagnostics.hasSupabaseConfig).toBe(false);
      expect(diagnostics.missingRequired).toContain('SUPABASE_URL');
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should return healthy when all required vars present', async () => {
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.missingRequired).toEqual([]);
      expect(health.details.configuredKeys).toBeGreaterThan(0);
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy when required vars missing', async () => {
      delete process.env.SUPABASE_URL;
      service.reload();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.missingRequired).toContain('SUPABASE_URL');
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should track get operations', () => {
      service.get('SUPABASE_URL');
      service.get('APP_NAME');
      service.getAll();
      
      const metrics = service.getMetrics();
      expect(metrics.totalGets).toBe(3);
      expect(metrics.lastAccessTime).toBeInstanceOf(Date);
    });

    it('should track validation operations', () => {
      service.validateApiKey('test-key');
      service.validateApiKey('another-key');
      
      const metrics = service.getMetrics();
      expect(metrics.totalValidations).toBe(2);
    });

    it('should track missing keys', () => {
      service.get('MISSING_KEY_1' as any);
      service.get('MISSING_KEY_2' as any);
      service.get('MISSING_KEY_1' as any); // Duplicate
      
      const metrics = service.getMetrics();
      expect(metrics.missingKeys).toContain('MISSING_KEY_1');
      expect(metrics.missingKeys).toContain('MISSING_KEY_2');
      expect(metrics.missingKeys.length).toBe(2); // No duplicates
    });
  });

  describe('Dynamic Configuration', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should allow setting custom values in non-production', () => {
      service.set('CUSTOM_VAR', 'custom-value');
      expect(service.get('CUSTOM_VAR' as any)).toBe('custom-value');
    });

    it('should allow unsetting values', () => {
      service.set('APP_NAME', undefined);
      expect(service.has('APP_NAME')).toBe(false);
    });

    it('should reload configuration from process.env', () => {
      service.set('CUSTOM_VAR', 'custom-value');
      
      // Change process.env
      process.env.NEW_VAR = 'new-value';
      
      service.reload();
      
      // Custom var should be gone
      expect(service.get('CUSTOM_VAR' as any)).toBeUndefined();
      // New var should be loaded
      expect(service.get('NEW_VAR' as any)).toBe('new-value');
    });
  });

  describe('Resource Management', () => {
    beforeEach(() => {
      service = EnvConfigService.getInstance();
    });

    it('should release resources properly', async () => {
      // Load some config
      expect(service.get('SUPABASE_URL')).toBeDefined();
      
      // Release resources
      await service['releaseResources']();
      
      // Config should be cleared
      expect(service.getAll()).toEqual({});
      expect(service.getMetrics().missingKeys).toEqual([]);
    });
  });
});