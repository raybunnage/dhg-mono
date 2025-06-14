/**
 * AuthService Tests
 * Comprehensive test suite for the refactored AuthService
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { AuthService } from './AuthService';
import type { SupabaseClient, Session, User, AuthError } from '@supabase/supabase-js';

// Mock the SupabaseClientService
vi.mock('../supabase-client', () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => mockSupabaseClient)
    }))
  }
}));

// Mock Node.js modules for testing
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(),
    digest: vi.fn(() => 'mock-hash-value')
  }))
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...paths) => paths.join('/'))
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home')
}));

// Create comprehensive mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn(),
    updateUser: vi.fn(),
    setSession: vi.fn(),
    signInWithOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    }))
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn()
  }))
} as unknown as SupabaseClient;

// Test data
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  email_confirmed_at: '2023-01-01T00:00:00Z',
  phone_confirmed_at: null,
  last_sign_in_at: '2023-01-01T00:00:00Z',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  user_metadata: { name: 'Test User' },
  app_metadata: { role: 'user' },
  aud: 'authenticated',
  role: 'authenticated'
};

const mockSession: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset singleton instance
    (AuthService as any).instance = undefined;
    
    // Default mock responses
    (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });
    
    (mockSupabaseClient.auth.getUser as Mock).mockResolvedValue({
      data: { user: null },
      error: null
    });
  });

  afterEach(async () => {
    if (authService) {
      await authService.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      const config = {
        environment: 'cli' as const,
        enableAuditLogging: false,
        sessionRefreshInterval: 60000
      };
      
      const instance = AuthService.getInstance(config);
      expect(instance).toBeInstanceOf(AuthService);
    });

    it('should ignore configuration on subsequent calls', () => {
      const instance1 = AuthService.getInstance({ environment: 'cli' });
      const instance2 = AuthService.getInstance({ environment: 'web' });
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(() => {
      authService = AuthService.getInstance();
    });

    it('should initialize successfully', async () => {
      await expect(authService.initialize()).resolves.not.toThrow();
      expect(authService.isInitialized()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      (mockSupabaseClient.auth.getSession as Mock).mockRejectedValue(
        new Error('Initialization failed')
      );

      await expect(authService.initialize()).rejects.toThrow('Initialization failed');
    });

    it('should shutdown cleanly', async () => {
      await authService.initialize();
      await expect(authService.shutdown()).resolves.not.toThrow();
      expect(authService.isInitialized()).toBe(false);
    });

    it('should prevent operations when not initialized', async () => {
      await expect(authService.signIn('test@example.com', 'password'))
        .rejects.toThrow('Service not initialized');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    it('should return healthy status when Supabase is accessible', async () => {
      (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const health = await authService.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.details.supabaseConnection).toBe(true);
      expect(health.details.environment).toBeDefined();
      expect(health.details.metrics).toBeDefined();
    });

    it('should return unhealthy status when Supabase is not accessible', async () => {
      (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
        data: { session: null },
        error: new Error('Connection failed')
      });

      const health = await authService.checkHealth();
      expect(health.healthy).toBe(false);
      expect(health.details.supabaseConnection).toBe(false);
    });
  });

  describe('Authentication Methods', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    describe('signIn', () => {
      it('should sign in successfully with valid credentials', async () => {
        (mockSupabaseClient.auth.signInWithPassword as Mock).mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null
        });

        const result = await authService.signIn('test@example.com', 'password');
        
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.session).toBeDefined();
        expect(result.error).toBeNull();
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
          options: { captchaToken: undefined }
        });
      });

      it('should handle sign in failure', async () => {
        const authError = new Error('Invalid credentials') as AuthError;
        (mockSupabaseClient.auth.signInWithPassword as Mock).mockResolvedValue({
          data: { user: null, session: null },
          error: authError
        });

        const result = await authService.signIn('test@example.com', 'wrong-password');
        
        expect(result.success).toBe(false);
        expect(result.user).toBeNull();
        expect(result.session).toBeNull();
        expect(result.error).toBe('Invalid credentials');
      });

      it('should handle sign in with options', async () => {
        (mockSupabaseClient.auth.signInWithPassword as Mock).mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null
        });

        const options = {
          captchaToken: 'captcha-token',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent'
        };

        const result = await authService.signIn('test@example.com', 'password', options);
        
        expect(result.success).toBe(true);
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
          options: { captchaToken: 'captcha-token' }
        });
      });
    });

    describe('signUp', () => {
      it('should sign up successfully with valid data', async () => {
        (mockSupabaseClient.auth.signUp as Mock).mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null
        });

        const result = await authService.signUp('test@example.com', 'password');
        
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.session).toBeDefined();
        expect(result.error).toBeNull();
      });

      it('should handle sign up failure', async () => {
        const authError = new Error('User already exists') as AuthError;
        (mockSupabaseClient.auth.signUp as Mock).mockResolvedValue({
          data: { user: null, session: null },
          error: authError
        });

        const result = await authService.signUp('test@example.com', 'password');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('User already exists');
      });

      it('should handle sign up with options', async () => {
        (mockSupabaseClient.auth.signUp as Mock).mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null
        });

        const options = {
          redirectTo: 'https://example.com/welcome',
          userData: { firstName: 'Test', lastName: 'User' }
        };

        const result = await authService.signUp('test@example.com', 'password', options);
        
        expect(result.success).toBe(true);
        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
          options: {
            captchaToken: undefined,
            data: { firstName: 'Test', lastName: 'User' },
            emailRedirectTo: 'https://example.com/welcome'
          }
        });
      });
    });

    describe('signOut', () => {
      it('should sign out successfully', async () => {
        // Set up current session
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });
        
        await authService.getSession(); // Set current session

        (mockSupabaseClient.auth.signOut as Mock).mockResolvedValue({
          error: null
        });

        await expect(authService.signOut()).resolves.not.toThrow();
        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      });

      it('should handle sign out failure', async () => {
        (mockSupabaseClient.auth.signOut as Mock).mockResolvedValue({
          error: new Error('Sign out failed')
        });

        await expect(authService.signOut()).rejects.toThrow('Sign out failed');
      });
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    describe('getSession', () => {
      it('should return current session when valid', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        const session = await authService.getSession();
        
        expect(session).toBeDefined();
        expect(session?.accessToken).toBe('test-access-token');
        expect(session?.user.id).toBe('test-user-id');
      });

      it('should return null when no session exists', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: null },
          error: null
        });

        const session = await authService.getSession();
        expect(session).toBeNull();
      });

      it('should handle session errors gracefully', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: null },
          error: new Error('Session error')
        });

        const session = await authService.getSession();
        expect(session).toBeNull();
      });
    });

    describe('refreshSession', () => {
      it('should refresh session successfully', async () => {
        (mockSupabaseClient.auth.refreshSession as Mock).mockResolvedValue({
          data: { session: mockSession, user: mockUser },
          error: null
        });

        const session = await authService.refreshSession();
        
        expect(session).toBeDefined();
        expect(session?.accessToken).toBe('test-access-token');
        expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();
      });

      it('should handle refresh failure', async () => {
        (mockSupabaseClient.auth.refreshSession as Mock).mockResolvedValue({
          data: { session: null, user: null },
          error: new Error('Refresh failed')
        });

        const session = await authService.refreshSession();
        expect(session).toBeNull();
      });
    });

    describe('validateSession', () => {
      it('should validate active session', async () => {
        // Set up current session
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });
        
        await authService.getSession();

        (mockSupabaseClient.auth.getUser as Mock).mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        const isValid = await authService.validateSession();
        expect(isValid).toBe(true);
      });

      it('should invalidate expired session', async () => {
        // Create expired session
        const expiredSession = {
          ...mockSession,
          expires_at: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        };

        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: expiredSession },
          error: null
        });
        
        await authService.getSession();

        const isValid = await authService.validateSession();
        expect(isValid).toBe(false);
      });

      it('should invalidate session when user fetch fails', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });
        
        await authService.getSession();

        (mockSupabaseClient.auth.getUser as Mock).mockResolvedValue({
          data: { user: null },
          error: new Error('User not found')
        });

        const isValid = await authService.validateSession();
        expect(isValid).toBe(false);
      });
    });
  });

  describe('User Management', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    describe('getCurrentUser', () => {
      it('should return current user when session exists', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        const user = await authService.getCurrentUser();
        
        expect(user).toBeDefined();
        expect(user?.id).toBe('test-user-id');
        expect(user?.email).toBe('test@example.com');
      });

      it('should return null when no session exists', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: null },
          error: null
        });

        const user = await authService.getCurrentUser();
        expect(user).toBeNull();
      });
    });

    describe('updateUserProfile', () => {
      beforeEach(() => {
        // Set up authenticated user
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });
      });

      it('should update user profile successfully', async () => {
        const updatedUser = { ...mockUser, email: 'updated@example.com' };
        
        (mockSupabaseClient.auth.updateUser as Mock).mockResolvedValue({
          data: { user: updatedUser },
          error: null
        });

        const result = await authService.updateUserProfile({
          email: 'updated@example.com'
        });
        
        expect(result.email).toBe('updated@example.com');
        expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
          email: 'updated@example.com'
        });
      });

      it('should handle update failure', async () => {
        (mockSupabaseClient.auth.updateUser as Mock).mockResolvedValue({
          data: { user: null },
          error: new Error('Update failed')
        });

        await expect(authService.updateUserProfile({
          email: 'updated@example.com'
        })).rejects.toThrow('Update failed');
      });

      it('should throw error when no authenticated user', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: null },
          error: null
        });

        await expect(authService.updateUserProfile({
          email: 'updated@example.com'
        })).rejects.toThrow('No authenticated user found');
      });
    });
  });

  describe('Magic Link Authentication', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    it('should send magic link successfully', async () => {
      (mockSupabaseClient.auth.signInWithOtp as Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: null
      });

      const result = await authService.sendMagicLink({
        email: 'test@example.com',
        redirectTo: 'https://example.com/auth'
      });
      
      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'https://example.com/auth',
          captchaToken: undefined
        }
      });
    });

    it('should handle magic link failure', async () => {
      (mockSupabaseClient.auth.signInWithOtp as Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Magic link failed')
      });

      const result = await authService.sendMagicLink({
        email: 'test@example.com'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Magic link failed');
    });
  });

  describe('OAuth Authentication', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    it('should initiate OAuth sign in successfully', async () => {
      (mockSupabaseClient.auth.signInWithOAuth as Mock).mockResolvedValue({
        data: { provider: 'google', url: 'https://oauth.url' },
        error: null
      });

      const result = await authService.signInWithOAuth({
        provider: 'google',
        redirectTo: 'https://example.com/auth'
      });
      
      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://example.com/auth',
          scopes: undefined,
          queryParams: undefined
        }
      });
    });

    it('should handle OAuth failure', async () => {
      (mockSupabaseClient.auth.signInWithOAuth as Mock).mockResolvedValue({
        data: null,
        error: new Error('OAuth failed')
      });

      const result = await authService.signInWithOAuth({
        provider: 'google'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth failed');
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    it('should track sign in metrics', async () => {
      (mockSupabaseClient.auth.signInWithPassword as Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const initialMetrics = authService.getMetrics();
      
      await authService.signIn('test@example.com', 'password');
      
      const updatedMetrics = authService.getMetrics();
      expect(updatedMetrics.totalSignIns).toBe(initialMetrics.totalSignIns + 1);
      expect(updatedMetrics.totalSessions).toBe(initialMetrics.totalSessions + 1);
      expect(updatedMetrics.activeSessions).toBe(1);
      expect(updatedMetrics.lastActivity).toBeDefined();
    });

    it('should track sign up metrics', async () => {
      (mockSupabaseClient.auth.signUp as Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const initialMetrics = authService.getMetrics();
      
      await authService.signUp('test@example.com', 'password');
      
      const updatedMetrics = authService.getMetrics();
      expect(updatedMetrics.totalSignUps).toBe(initialMetrics.totalSignUps + 1);
    });

    it('should track sign out metrics', async () => {
      // First sign in
      (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      await authService.getSession();

      (mockSupabaseClient.auth.signOut as Mock).mockResolvedValue({
        error: null
      });

      const initialMetrics = authService.getMetrics();
      
      await authService.signOut();
      
      const updatedMetrics = authService.getMetrics();
      expect(updatedMetrics.totalSignOuts).toBe(initialMetrics.totalSignOuts + 1);
      expect(updatedMetrics.activeSessions).toBe(0);
    });
  });

  describe('CLI Token Management', () => {
    let cliAuthService: AuthService;

    beforeEach(async () => {
      // Create CLI environment service
      cliAuthService = AuthService.getInstance({ environment: 'cli' });
      await cliAuthService.initialize();
    });

    afterEach(async () => {
      if (cliAuthService) {
        await cliAuthService.shutdown();
      }
    });

    describe('createCLIToken', () => {
      it('should create CLI token successfully', async () => {
        // Set up authenticated user
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        // Mock database insert
        const mockInsert = vi.fn().mockResolvedValue({
          data: { id: 'token-id', token_name: 'test-token' },
          error: null
        });

        (mockSupabaseClient.from as Mock).mockReturnValue({
          insert: mockInsert,
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'token-id', token_name: 'test-token' },
            error: null
          })
        });

        const token = await cliAuthService.createCLIToken('test-token', 30);
        
        expect(token).toBe('mock-hash-value');
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: 'test-user-id',
          token_name: 'test-token',
          token_hash: 'mock-hash-value',
          expires_at: expect.any(String),
          created_at: expect.any(String)
        });
      });

      it('should throw error when not authenticated', async () => {
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: null },
          error: null
        });

        await expect(cliAuthService.createCLIToken('test-token'))
          .rejects.toThrow('Must be authenticated to create CLI token');
      });

      it('should throw error in web environment', async () => {
        const webAuthService = AuthService.getInstance({ environment: 'web' });
        await webAuthService.initialize();

        await expect(webAuthService.createCLIToken('test-token'))
          .rejects.toThrow('CLI token creation only available in CLI environment');
      });
    });

    describe('listCLITokens', () => {
      it('should list CLI tokens successfully', async () => {
        // Set up authenticated user
        (mockSupabaseClient.auth.getSession as Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        const mockTokens = [
          {
            id: 'token-1',
            token_name: 'Token 1',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
            revoked_at: null,
            last_used_at: null
          }
        ];

        (mockSupabaseClient.from as Mock).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockTokens,
            error: null
          })
        });

        const tokens = await cliAuthService.listCLITokens();
        
        expect(tokens).toHaveLength(1);
        expect(tokens[0].name).toBe('Token 1');
        expect(tokens[0].isExpired).toBe(false);
        expect(tokens[0].isRevoked).toBe(false);
      });
    });
  });

  describe('Environment Detection', () => {
    it('should detect CLI environment correctly', () => {
      // Mock Node.js environment
      const originalWindow = global.window;
      const originalProcess = global.process;
      
      delete (global as any).window;
      global.process = { env: {} } as any;

      const cliService = AuthService.getInstance({ environment: 'auto' });
      expect(cliService).toBeInstanceOf(AuthService);

      // Restore globals
      if (originalWindow) global.window = originalWindow;
      if (originalProcess) global.process = originalProcess;
    });

    it('should detect web environment correctly', () => {
      // Mock browser environment
      const originalProcess = global.process;
      
      delete (global as any).process;
      global.window = {} as any;

      const webService = AuthService.getInstance({ environment: 'auto' });
      expect(webService).toBeInstanceOf(AuthService);

      // Restore globals
      if (originalProcess) global.process = originalProcess;
      delete (global as any).window;
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      authService = AuthService.getInstance();
      await authService.initialize();
    });

    it('should handle network errors gracefully', async () => {
      (mockSupabaseClient.auth.signInWithPassword as Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await authService.signIn('test@example.com', 'password');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unexpected errors in async methods', async () => {
      (mockSupabaseClient.auth.getSession as Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const session = await authService.getSession();
      expect(session).toBeNull();
    });
  });
});