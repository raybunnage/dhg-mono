import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleAuthService } from './GoogleAuthService';
import { GoogleAuthToken, TokenStorageAdapter } from './types';
import { Logger } from '../logger-service/LoggerService';
import * as fs from 'fs';

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  JWT: vi.fn().mockImplementation((email, keyId, key, scopes) => ({
    email,
    key,
    scopes,
    credentials: {},
    authorize: vi.fn().mockResolvedValue({ access_token: 'mock-service-account-token' })
  }))
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn()
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as unknown as Logger;

// Mock token
const mockToken: GoogleAuthToken = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  scope: 'https://www.googleapis.com/auth/drive.readonly',
  token_type: 'Bearer',
  expiry_date: Date.now() + 3600 * 1000 // 1 hour from now
};

// Mock storage adapter
class MockStorageAdapter implements TokenStorageAdapter {
  private token: GoogleAuthToken | null = null;

  async saveToken(token: GoogleAuthToken): Promise<boolean> {
    this.token = token;
    return true;
  }

  async loadToken(): Promise<GoogleAuthToken | null> {
    return this.token;
  }

  async clearToken(): Promise<boolean> {
    this.token = null;
    return true;
  }
}

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockStorage: MockStorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (GoogleAuthService as any).instance = null;
    mockStorage = new MockStorageAdapter();
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        logger: mockLogger
      };
      
      const instance1 = GoogleAuthService.getInstance(config, mockStorage);
      const instance2 = GoogleAuthService.getInstance(config, mockStorage);
      
      expect(instance1).toBe(instance2);
      service = instance1; // For cleanup
    });

    it('should accept configuration on first call', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['https://www.googleapis.com/auth/drive'],
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, mockStorage);
      expect(service).toBeInstanceOf(GoogleAuthService);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(() => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        logger: mockLogger
      };
      service = GoogleAuthService.getInstance(config, mockStorage);
    });

    it('should handle health check when healthy with OAuth', async () => {
      // Pre-save a token
      await mockStorage.saveToken(mockToken);
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details.authenticationMethod).toBe('oauth');
      expect(health.details.hasValidToken).toBe(true);
      expect(health.details.metrics).toBeDefined();
    });

    it('should handle health check when unhealthy', async () => {
      // No token saved
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.authenticationMethod).toBe('oauth');
      expect(health.details.hasValidToken).toBe(false);
    });
  });

  describe('OAuth Token Management', () => {
    beforeEach(() => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        logger: mockLogger
      };
      service = GoogleAuthService.getInstance(config, mockStorage);
    });

    describe('saveToken', () => {
      it('should save token to storage', async () => {
        const result = await service.saveToken(mockToken);
        
        expect(result).toBe(true);
        expect(await mockStorage.loadToken()).toEqual(mockToken);
        expect(mockLogger.debug).toHaveBeenCalledWith('GoogleAuthService: Token saved successfully');
      });
    });

    describe('loadToken', () => {
      it('should load token from storage', async () => {
        await mockStorage.saveToken(mockToken);
        
        const token = await service.loadToken();
        
        expect(token).toEqual(mockToken);
        expect(mockLogger.debug).toHaveBeenCalledWith('GoogleAuthService: Token loaded successfully');
      });

      it('should return null if no token exists', async () => {
        const token = await service.loadToken();
        
        expect(token).toBeNull();
      });
    });

    describe('clearToken', () => {
      it('should clear token from storage', async () => {
        await mockStorage.saveToken(mockToken);
        
        const result = await service.clearToken();
        
        expect(result).toBe(true);
        expect(await mockStorage.loadToken()).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith('GoogleAuthService: Token cleared successfully');
      });
    });

    describe('hasValidToken', () => {
      it('should return true for valid token', async () => {
        await service.saveToken(mockToken);
        
        const isValid = await service.hasValidToken();
        
        expect(isValid).toBe(true);
      });

      it('should return false for expired token', async () => {
        const expiredToken = {
          ...mockToken,
          expiry_date: Date.now() - 1000 // Expired
        };
        await service.saveToken(expiredToken);
        
        const isValid = await service.hasValidToken();
        
        expect(isValid).toBe(false);
      });

      it('should attempt to refresh expired token with refresh token', async () => {
        const expiredToken = {
          ...mockToken,
          expiry_date: Date.now() - 1000, // Expired
          refresh_token: 'valid-refresh-token'
        };
        await service.saveToken(expiredToken);
        
        const isValid = await service.hasValidToken();
        
        // Should succeed because refreshToken is mocked to return true
        expect(isValid).toBe(true);
      });
    });

    describe('getAccessToken', () => {
      it('should return access token when valid', async () => {
        await service.saveToken(mockToken);
        
        const accessToken = await service.getAccessToken();
        
        expect(accessToken).toBe('mock-access-token');
      });

      it('should return null when no token exists', async () => {
        const accessToken = await service.getAccessToken();
        
        expect(accessToken).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith('GoogleAuthService: No valid Google access token available');
      });

      it('should use environment variable as fallback', async () => {
        process.env.GOOGLE_ACCESS_TOKEN = 'env-access-token';
        
        const accessToken = await service.getAccessToken();
        
        expect(accessToken).toBe('env-access-token');
        expect(mockLogger.debug).toHaveBeenCalledWith('GoogleAuthService: Using token from environment variable');
        
        delete process.env.GOOGLE_ACCESS_TOKEN;
      });
    });
  });

  describe('Service Account Authentication', () => {
    it('should initialize with service account from config', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({
        client_email: 'test@example.iam.gserviceaccount.com',
        private_key: 'mock-private-key'
      }));

      const config = {
        serviceAccount: {
          keyFilePath: '/path/to/service-account.json',
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        },
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, mockStorage);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(service.isUsingServiceAccount()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GoogleAuthService: Service account authentication initialized successfully'
      );
    });

    it('should initialize with service account from environment', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/env/service-account.json';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({
        client_email: 'test@example.iam.gserviceaccount.com',
        private_key: 'mock-private-key'
      }));

      const config = {
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, mockStorage);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(service.isUsingServiceAccount()).toBe(true);
      
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });

    it('should handle invalid service account file', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json');

      const config = {
        serviceAccount: {
          keyFilePath: '/path/to/invalid.json',
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        },
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, mockStorage);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(service.isUsingServiceAccount()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should get access token from service account', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({
        client_email: 'test@example.iam.gserviceaccount.com',
        private_key: 'mock-private-key'
      }));

      const config = {
        serviceAccount: {
          keyFilePath: '/path/to/service-account.json',
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        },
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, mockStorage);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const accessToken = await service.getAccessToken();
      
      expect(accessToken).toBe('mock-service-account-token');
    });
  });

  describe('OAuth Flow', () => {
    beforeEach(() => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        logger: mockLogger
      };
      service = GoogleAuthService.getInstance(config, mockStorage);
    });

    describe('generateAuthUrl', () => {
      it('should generate OAuth URL', () => {
        const url = service.generateAuthUrl();
        
        expect(url).toContain('https://accounts.google.com/o/oauth2/auth');
        expect(url).toContain('client_id=test-client-id');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
        expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly');
        expect(url).toContain('response_type=code');
        expect(url).toContain('access_type=offline');
      });
    });

    describe('getTokenFromCode', () => {
      it('should exchange code for token', async () => {
        const token = await service.getTokenFromCode('auth-code');
        
        expect(token).toBeTruthy();
        expect(token?.access_token).toBe('mock_access_token');
        expect(token?.refresh_token).toBe('mock_refresh_token');
      });
    });

    describe('refreshToken', () => {
      it('should refresh OAuth token', async () => {
        await service.saveToken(mockToken);
        
        const refreshed = await service.refreshToken();
        
        expect(refreshed).toBe(true);
        const token = await service.loadToken();
        expect(token?.access_token).toContain('new_access_token_');
      });

      it('should handle missing refresh token', async () => {
        const tokenWithoutRefresh = {
          ...mockToken,
          refresh_token: undefined
        };
        await service.saveToken(tokenWithoutRefresh);
        
        const refreshed = await service.refreshToken();
        
        expect(refreshed).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('GoogleAuthService: No refresh token available');
      });
    });
  });

  describe('Token Expiration', () => {
    beforeEach(() => {
      const config = {
        clientId: 'test-client-id',
        logger: mockLogger
      };
      service = GoogleAuthService.getInstance(config, mockStorage);
    });

    it('should get token expiration time for valid token', async () => {
      await service.saveToken(mockToken);
      
      const expiration = service.getTokenExpirationTime();
      
      expect(expiration.isValid).toBe(true);
      expect(expiration.expiresIn).toBeGreaterThan(0);
      expect(expiration.formattedTime).toMatch(/\d+[hms]/);
    });

    it('should handle expired token', async () => {
      const expiredToken = {
        ...mockToken,
        expiry_date: Date.now() - 1000
      };
      await service.saveToken(expiredToken);
      
      const expiration = service.getTokenExpirationTime();
      
      expect(expiration.isValid).toBe(false);
      expect(expiration.expiresIn).toBe(0);
      expect(expiration.formattedTime).toBe('Token expired');
    });

    it('should handle missing token', () => {
      const expiration = service.getTokenExpirationTime();
      
      expect(expiration.isValid).toBe(false);
      expect(expiration.expiresIn).toBe(0);
      expect(expiration.formattedTime).toBe('Token not available');
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      const config = {
        clientId: 'test-client-id',
        logger: mockLogger
      };
      service = GoogleAuthService.getInstance(config, mockStorage);
    });

    it('should track metrics correctly', async () => {
      // Perform various operations
      await service.saveToken(mockToken);
      await service.loadToken();
      await service.getAccessToken();
      await service.refreshToken();
      
      const metrics = service.getMetrics();
      
      expect(metrics.storageOperations).toBeGreaterThan(0);
      expect(metrics.accessTokenRequests).toBe(1);
      expect(metrics.tokenRefreshes).toBe(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const config = {
        clientId: 'test-client-id',
        logger: mockLogger
      };
      service = GoogleAuthService.getInstance(config, mockStorage);
    });

    it('should handle storage errors gracefully', async () => {
      const errorStorage: TokenStorageAdapter = {
        saveToken: vi.fn().mockRejectedValue(new Error('Storage error')),
        loadToken: vi.fn().mockRejectedValue(new Error('Storage error')),
        clearToken: vi.fn().mockRejectedValue(new Error('Storage error'))
      };
      
      service.setStorageAdapter(errorStorage);
      
      const saveResult = await service.saveToken(mockToken);
      expect(saveResult).toBe(false);
      
      const loadResult = await service.loadToken();
      expect(loadResult).toBeNull();
      
      const clearResult = await service.clearToken();
      expect(clearResult).toBe(false);
      
      const metrics = service.getMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
    });
  });

  describe('Storage Adapters', () => {
    it('should work with different storage adapters', async () => {
      const customStorage: TokenStorageAdapter = {
        saveToken: vi.fn().mockResolvedValue(true),
        loadToken: vi.fn().mockResolvedValue(mockToken),
        clearToken: vi.fn().mockResolvedValue(true)
      };
      
      const config = {
        clientId: 'test-client-id',
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, customStorage);
      
      await service.saveToken(mockToken);
      expect(customStorage.saveToken).toHaveBeenCalledWith(mockToken);
      
      await service.loadToken();
      expect(customStorage.loadToken).toHaveBeenCalled();
      
      await service.clearToken();
      expect(customStorage.clearToken).toHaveBeenCalled();
    });

    it('should allow changing storage adapter', async () => {
      const config = {
        clientId: 'test-client-id',
        logger: mockLogger
      };
      
      service = GoogleAuthService.getInstance(config, mockStorage);
      
      const newStorage = new MockStorageAdapter();
      service.setStorageAdapter(newStorage);
      
      await service.saveToken(mockToken);
      const token = await newStorage.loadToken();
      
      expect(token).toEqual(mockToken);
      expect(mockLogger.debug).toHaveBeenCalledWith('GoogleAuthService: Storage adapter updated');
    });
  });
});