import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleAuthService } from '../GoogleAuthService';
import * as fs from 'fs';
import * as path from 'path';
import { JWT } from 'google-auth-library';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('google-auth-library');
vi.mock('dotenv');

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    GoogleAuthService['instance'] = undefined;
    
    // Mock file system
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      type: 'service_account',
      client_email: 'test@service.account',
      private_key: 'mock-private-key'
    }));
    
    // Mock path
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    vi.mocked(path.resolve).mockImplementation((p) => p);
    
    service = GoogleAuthService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = GoogleAuthService.getInstance();
      const instance2 = GoogleAuthService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept config on first getInstance', () => {
      GoogleAuthService['instance'] = undefined;
      const config = {
        scopes: ['https://www.googleapis.com/auth/drive'],
        serviceAccountPath: '/custom/path.json'
      };
      
      const instance = GoogleAuthService.getInstance(config);
      expect(instance['config'].scopes).toEqual(config.scopes);
    });
  });

  describe('getAuthClient', () => {
    it('should return service account client when available', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        email: 'test@service.account'
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      const client = await service.getAuthClient();
      
      expect(client).toBeDefined();
      expect(mockJWT.authorize).toHaveBeenCalled();
    });

    it('should handle missing service account gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await service['ensureInitialized']();
      const client = await service.getAuthClient();
      
      // Should return null or throw depending on implementation
      expect(client).toBeDefined();
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from service account', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        getAccessToken: vi.fn().mockResolvedValue({
          token: 'mock-access-token',
          res: {}
        })
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      const token = await service.getAccessToken();
      
      expect(token).toBe('mock-access-token');
    });

    it('should handle token refresh', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        getAccessToken: vi.fn()
          .mockResolvedValueOnce({ token: 'token1' })
          .mockResolvedValueOnce({ token: 'token2' })
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      
      const token1 = await service.getAccessToken();
      const token2 = await service.getAccessToken();
      
      expect(token1).toBe('token1');
      expect(token2).toBe('token2');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when authenticated', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        email: 'test@service.account'
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      const isAuth = await service.isAuthenticated();
      
      expect(isAuth).toBe(true);
    });

    it('should return false when not authenticated', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await service['ensureInitialized']();
      const isAuth = await service.isAuthenticated();
      
      expect(isAuth).toBe(false);
    });
  });

  describe('validateScopes', () => {
    it('should validate requested scopes', async () => {
      const requestedScopes = ['https://www.googleapis.com/auth/drive.readonly'];
      
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        scopes: ['https://www.googleapis.com/auth/drive']
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      const hasScopes = await service.validateScopes(requestedScopes);
      
      expect(hasScopes).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when authenticated', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        email: 'test@service.account'
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        authenticated: true,
        authMethod: 'service_account'
      });
    });

    it('should return unhealthy when not authenticated', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await service['ensureInitialized']();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.authenticated).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        refreshAccessToken: vi.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000
          }
        })
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      await service.refreshToken();
      
      expect(mockJWT.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('getCredentials', () => {
    it('should return current credentials', async () => {
      const mockCreds = {
        access_token: 'mock-token',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000
      };
      
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        credentials: mockCreds
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      const creds = await service.getCredentials();
      
      expect(creds).toMatchObject(mockCreds);
    });
  });

  describe('error handling', () => {
    it('should handle service account file read errors', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });
      
      await service['ensureInitialized']();
      
      // Should not throw, but log error
      expect(service['serviceAccountJWT']).toBeUndefined();
    });

    it('should handle authorization errors', async () => {
      const mockJWT = {
        authorize: vi.fn().mockRejectedValue(new Error('Auth failed'))
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      
      await expect(service.getAccessToken()).rejects.toThrow();
    });
  });

  describe('metrics', () => {
    it('should track authentication attempts', async () => {
      const mockJWT = {
        authorize: vi.fn().mockResolvedValue(undefined),
        getAccessToken: vi.fn().mockResolvedValue({ token: 'token' })
      };
      
      vi.mocked(JWT).mockImplementation(() => mockJWT as any);
      
      await service['ensureInitialized']();
      
      // Make some requests
      await service.getAccessToken();
      await service.getAccessToken();
      
      const metrics = service.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
    });
  });
});