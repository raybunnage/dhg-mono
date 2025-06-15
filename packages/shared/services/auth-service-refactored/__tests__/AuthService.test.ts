import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { AuthService } from '../AuthService';
import { SupabaseClient, User, Session, AuthError, AuthApiError } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../supabase-client';
import { Logger } from '../../base-classes/BaseService';
import {
  AppUser,
  AuthSession,
  AuthResult,
  MagicLinkOptions,
  OAuthOptions,
  SignUpOptions,
  AccessRequest,
  AllowedEmail
} from '../types';

// Mock SupabaseClientService
vi.mock('../../supabase-client', () => ({
  SupabaseClientService: {
    getInstance: vi.fn()
  }
}));

// Mock Node.js modules for CLI environment tests
vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mocked-hash')
    }))
  }
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn()
  }
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/test')
  }
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/'))
  }
}));

// Mock Supabase client factory
const createMockSupabase = () => {
  const mockAuth = {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    getUser: vi.fn(),
    signInWithOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    onAuthStateChange: vi.fn(),
    admin: {
      listUsers: vi.fn()
    }
  };

  const mockFrom = vi.fn();

  return {
    auth: mockAuth,
    from: mockFrom
  } as unknown as SupabaseClient;
};

// Mock data fixtures
const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockSession = (overrides?: Partial<Session>): Session => ({
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: createMockUser(),
  ...overrides
});

const createMockAuthError = (message: string, status?: number): AuthApiError => ({
  message,
  status: status || 400,
  __isAuthError: true,
  name: 'AuthApiError',
  stack: ''
});

describe('AuthService', () => {
  let service: AuthService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockSupabaseClientService: any;
  
  // Store original global window
  const originalWindow = global.window;

  beforeAll(() => {
    // Setup for all tests
  });

  afterAll(() => {
    // Restore original window
    global.window = originalWindow;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the singleton instance
    (AuthService as any).instance = null;
    
    mockSupabase = createMockSupabase();
    mockSupabaseClientService = {
      getClient: vi.fn().mockReturnValue(mockSupabase)
    };
    
    (SupabaseClientService.getInstance as any).mockReturnValue(mockSupabaseClientService);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AuthService);
    });

    it('should accept configuration options', () => {
      service = AuthService.getInstance({
        environment: 'cli',
        enableAuditLogging: false,
        sessionRefreshInterval: 10000,
        cliTokenExpiryDays: 30
      });
      
      expect(service).toBeInstanceOf(AuthService);
    });

    it('should auto-detect web environment', () => {
      global.window = {} as any;
      service = AuthService.getInstance({ environment: 'auto' });
      
      expect(service).toBeInstanceOf(AuthService);
    });

    it('should auto-detect CLI environment', () => {
      delete (global as any).window;
      service = AuthService.getInstance({ environment: 'auto' });
      
      expect(service).toBeInstanceOf(AuthService);
    });

    it('should initialize web session on startup', async () => {
      global.window = {} as any;
      const mockSession = createMockSession();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      service = AuthService.getInstance({ environment: 'web' });
      await service.startup();

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('should set up session refresh timer', async () => {
      vi.useFakeTimers();
      
      service = AuthService.getInstance({ 
        sessionRefreshInterval: 5000 
      });
      await service.startup();

      const refreshSpy = vi.spyOn(service, 'refreshSession').mockResolvedValue(null);

      vi.advanceTimersByTime(5000);
      
      expect(refreshSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      service = AuthService.getInstance();
    });

    it('should report healthy when Supabase is accessible', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() },
        error: null
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.supabaseConnection).toBe(true);
      expect(health.details.currentSession).toBe(true);
      expect(health.details.environment).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should report unhealthy when Supabase is not accessible', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: createMockAuthError('Connection failed')
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.supabaseConnection).toBe(false);
    });

    it('should include metrics in health check', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const health = await service.healthCheck();
      
      expect(health.details.metrics).toBeDefined();
      expect(health.details.metrics).toHaveProperty('totalSessions');
      expect(health.details.metrics).toHaveProperty('activeSessions');
      expect(health.details.metrics).toHaveProperty('totalSignIns');
    });

    it('should handle exceptions during health check', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Unexpected error'));

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Unexpected error');
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should sign in successfully with email and password', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe('test-user-id');
      expect(result.session).toBeDefined();
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should handle sign in failure', async () => {
      const error = createMockAuthError('Invalid credentials');
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error
      });

      const result = await service.signIn('test@example.com', 'wrongpassword');

      expect(result.error).toBe(error);
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });

    it('should log audit event on successful sign in', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabase.from.mockImplementation(mockFrom);

      const result = await service.signIn('test@example.com', 'password123');

      expect(mockFrom).toHaveBeenCalledWith('auth_audit_log');
      expect(result.error).toBeNull();
    });

    it('should log failed sign in attempt', async () => {
      const error = createMockAuthError('Invalid credentials');
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabase.from.mockImplementation(mockFrom);

      await service.signIn('test@example.com', 'wrongpassword');

      const insertCall = mockFrom.mock.results[0].value.insert.mock.calls[0];
      expect(insertCall[0].event_type).toBe('login_failed');
      expect(insertCall[0].user_id).toBeNull();
    });

    it('should update metrics after sign in', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      await service.signIn('test@example.com', 'password123');
      const metrics = service.getMetrics();

      expect(metrics.totalSignIns).toBe(1);
      expect(metrics.totalSessions).toBe(1);
      expect(metrics.activeSessions).toBe(1);
      expect(metrics.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle exceptions during sign in', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.error).toBeDefined();
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });
  });

  describe('signUp', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should sign up successfully', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await service.signUp('new@example.com', 'password123');

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {}
        }
      });
    });

    it('should sign up with additional options', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const options: SignUpOptions = {
        emailRedirectTo: 'https://example.com/welcome',
        data: { name: 'Test User' }
      };

      const result = await service.signUp('new@example.com', 'password123', options);

      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: { name: 'Test User' },
          emailRedirectTo: 'https://example.com/welcome'
        }
      });
    });

    it('should handle sign up failure', async () => {
      const error = createMockAuthError('Email already exists');
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error
      });

      const result = await service.signUp('existing@example.com', 'password123');

      expect(result.error).toBe(error);
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });

    it('should update metrics after sign up', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      await service.signUp('new@example.com', 'password123');
      const metrics = service.getMetrics();

      expect(metrics.totalSignUps).toBe(1);
      expect(metrics.totalSessions).toBe(1);
      expect(metrics.activeSessions).toBe(1);
    });
  });

  describe('signOut', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should sign out successfully', async () => {
      // First sign in
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      
      await service.signIn('test@example.com', 'password123');

      // Then sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await service.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out failure', async () => {
      const error = createMockAuthError('Sign out failed');
      mockSupabase.auth.signOut.mockResolvedValue({ error });

      await expect(service.signOut()).rejects.toThrow('Sign out failed');
    });

    it('should log audit event on sign out', async () => {
      // Sign in first
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      
      await service.signIn('test@example.com', 'password123');

      // Setup audit log mock
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabase.from.mockImplementation(mockFrom);

      // Sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await service.signOut();

      const insertCall = mockFrom.mock.results[0].value.insert.mock.calls[0];
      expect(insertCall[0].event_type).toBe('logout');
      expect(insertCall[0].user_id).toBe('test-user-id');
    });

    it('should update metrics after sign out', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await service.signOut();
      const metrics = service.getMetrics();

      expect(metrics.totalSignOuts).toBe(1);
      expect(metrics.activeSessions).toBe(0);
    });

    it('should clear current session on sign out', async () => {
      // Sign in first
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      
      await service.signIn('test@example.com', 'password123');
      
      // Verify session exists
      let session = await service.getSession();
      expect(session).toBeDefined();

      // Sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await service.signOut();

      // Verify session is cleared
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      session = await service.getSession();
      expect(session).toBeNull();
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should get current session', async () => {
      const mockSession = createMockSession();
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const session = await service.getSession();

      expect(session).toBeDefined();
      expect(session?.access_token).toBe('test-access-token');
      expect(session?.user.id).toBe('test-user-id');
    });

    it('should return null when no session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const session = await service.getSession();

      expect(session).toBeNull();
    });

    it('should handle session retrieval errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: createMockAuthError('Session error')
      });

      const session = await service.getSession();

      expect(session).toBeNull();
    });

    it('should refresh session', async () => {
      const newSession = createMockSession({
        access_token: 'new-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 7200
      });
      
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: newSession, user: newSession.user },
        error: null
      });

      const refreshed = await service.refreshSession();

      expect(refreshed).toBeDefined();
      expect(refreshed?.access_token).toBe('new-access-token');
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should handle refresh session failure', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: createMockAuthError('Refresh failed')
      });

      const refreshed = await service.refreshSession();

      expect(refreshed).toBeNull();
    });

    it('should validate session expiry', async () => {
      // Set up expired session
      const expiredSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      });
      
      // First, sign in to set current session
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: expiredSession.user, session: expiredSession },
        error: null
      });
      
      await service.signIn('test@example.com', 'password123');

      // Mock getUser to fail for expired session
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: createMockAuthError('Session expired')
      });

      const isValid = await service.validateSession();

      expect(isValid).toBe(false);
    });

    it('should validate active session', async () => {
      const activeSession = createMockSession();
      
      // Sign in first
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: activeSession.user, session: activeSession },
        error: null
      });
      
      await service.signIn('test@example.com', 'password123');

      // Mock successful user retrieval
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: activeSession.user },
        error: null
      });

      const isValid = await service.validateSession();

      expect(isValid).toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should return current user from session', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const user = await service.getCurrentUser();

      expect(user).toBeDefined();
      expect(user?.id).toBe('test-user-id');
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null when no user is signed in', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const user = await service.getCurrentUser();

      expect(user).toBeNull();
    });

    it('should transform user with extended properties', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const user = await service.getCurrentUser();

      expect(user).toHaveProperty('profile');
      expect(user).toHaveProperty('roles');
      expect(user).toHaveProperty('permissions');
    });
  });

  describe('Magic Link Authentication', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should send magic link successfully', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: { user: null, session: null },
        error: null
      });

      const options: MagicLinkOptions = {
        email: 'test@example.com',
        redirectTo: 'https://example.com/auth/callback'
      };

      const result = await service.sendMagicLink(options);

      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'https://example.com/auth/callback'
        }
      });
    });

    it('should handle magic link failure', async () => {
      const error = createMockAuthError('Invalid email');
      
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: { user: null, session: null },
        error
      });

      const options: MagicLinkOptions = {
        email: 'invalid-email'
      };

      const result = await service.sendMagicLink(options);

      expect(result.error).toBe(error);
    });
  });

  describe('OAuth Authentication', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should initiate OAuth sign in', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: 'https://accounts.google.com/...' },
        error: null
      });

      const options: OAuthOptions = {
        provider: 'google',
        redirectTo: 'https://example.com/auth/callback',
        scopes: 'email profile'
      };

      const result = await service.signInWithOAuth(options);

      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://example.com/auth/callback',
          scopes: 'email profile'
        }
      });
    });

    it('should handle OAuth failure', async () => {
      const error = createMockAuthError('OAuth provider error');
      
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: null,
        error
      });

      const options: OAuthOptions = {
        provider: 'github'
      };

      const result = await service.signInWithOAuth(options);

      expect(result.error).toBe(error);
    });
  });

  describe('Auth State Changes', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should subscribe to auth state changes', () => {
      const mockSubscription = { unsubscribe: vi.fn() };
      const callback = vi.fn();
      
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: mockSubscription }
      });

      const subscription = service.onAuthStateChange(callback);

      expect(subscription).toBe(mockSubscription);
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('should handle auth state change events', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      const callback = vi.fn();
      
      let authCallback: any;
      mockSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      service.onAuthStateChange(callback);

      // Simulate sign in event
      await authCallback('SIGNED_IN', mockSession);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-user-id',
        email: 'test@example.com'
      }));
    });

    it('should log auth state change events', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      let authCallback: any;
      mockSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabase.from.mockImplementation(mockFrom);

      service.onAuthStateChange(vi.fn());

      // Simulate various events
      await authCallback('SIGNED_IN', mockSession);
      await authCallback('TOKEN_REFRESHED', mockSession);
      await authCallback('SIGNED_OUT', null);

      // Check audit logs were created
      const insertCalls = mockFrom.mock.results
        .filter(r => r.value.insert)
        .map(r => r.value.insert.mock.calls[0][0]);
      
      expect(insertCalls.some(call => call.event_type === 'login')).toBe(true);
      expect(insertCalls.some(call => call.event_type === 'session_refreshed')).toBe(true);
      expect(insertCalls.some(call => call.event_type === 'logout')).toBe(true);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should clean up resources on shutdown', async () => {
      vi.useFakeTimers();
      
      // Set up session refresh timer
      const mockSubscription = { unsubscribe: vi.fn() };
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: mockSubscription }
      });

      service.onAuthStateChange(vi.fn());

      // Shutdown
      await service.shutdown();

      // Verify cleanup
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should handle errors during resource release', async () => {
      const mockSubscription = { 
        unsubscribe: vi.fn().mockImplementation(() => {
          throw new Error('Unsubscribe failed');
        })
      };
      
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: mockSubscription }
      });

      service.onAuthStateChange(vi.fn());

      // Should not throw
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should track all authentication operations', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      // Sign up
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      await service.signUp('new@example.com', 'password123');

      // Sign in
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      await service.signIn('test@example.com', 'password123');

      // Sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await service.signOut();

      const metrics = service.getMetrics();

      expect(metrics.totalSignUps).toBe(1);
      expect(metrics.totalSignIns).toBe(1);
      expect(metrics.totalSignOuts).toBe(1);
      expect(metrics.totalSessions).toBe(2);
      expect(metrics.lastActivity).toBeInstanceOf(Date);
    });

    it('should return copy of metrics to prevent external modification', () => {
      const metrics1 = service.getMetrics();
      metrics1.totalSignIns = 999;

      const metrics2 = service.getMetrics();
      
      expect(metrics2.totalSignIns).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should handle network errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Network error');
    });

    it('should handle unexpected errors in all methods', async () => {
      // Test each method with unexpected errors
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Unexpected'));
      const signInResult = await service.signIn('test@example.com', 'password123');
      expect(signInResult.error).toBeDefined();

      mockSupabase.auth.signUp.mockRejectedValue(new Error('Unexpected'));
      const signUpResult = await service.signUp('new@example.com', 'password123');
      expect(signUpResult.error).toBeDefined();

      mockSupabase.auth.getSession.mockRejectedValue(new Error('Unexpected'));
      const session = await service.getSession();
      expect(session).toBeNull();

      mockSupabase.auth.refreshSession.mockRejectedValue(new Error('Unexpected'));
      const refreshed = await service.refreshSession();
      expect(refreshed).toBeNull();

      mockSupabase.auth.getUser.mockRejectedValue(new Error('Unexpected'));
      const isValid = await service.validateSession();
      expect(isValid).toBe(false);
    });
  });

  describe('Service Not Initialized', () => {
    it('should throw error when using service before initialization', async () => {
      service = AuthService.getInstance();
      // Don't call startup()

      await expect(service.signIn('test@example.com', 'password')).rejects.toThrow();
      await expect(service.signUp('test@example.com', 'password')).rejects.toThrow();
      await expect(service.signOut()).rejects.toThrow();
      await expect(service.getSession()).rejects.toThrow();
    });
  });

  describe('CLI Environment Specific', () => {
    beforeEach(() => {
      delete (global as any).window;
      service = AuthService.getInstance({ environment: 'cli' });
    });

    it('should detect CLI environment correctly', () => {
      expect(service).toBeInstanceOf(AuthService);
      // Service is initialized with CLI environment
    });

    it('should throw error when accessing CLI token path in web environment', () => {
      global.window = {} as any;
      const webService = AuthService.getInstance({ environment: 'web' });
      
      expect(() => (webService as any).CLI_TOKEN_PATH).toThrow('CLI token path only available in CLI environment');
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      service = AuthService.getInstance();
      await service.startup();
    });

    it('should handle complete authentication flow', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      // Sign up
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null }, // Email confirmation required
        error: null
      });

      const signUpResult = await service.signUp('new@example.com', 'password123');
      expect(signUpResult.error).toBeNull();
      expect(signUpResult.session).toBeNull(); // No session until confirmed

      // Sign in after confirmation
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const signInResult = await service.signIn('new@example.com', 'password123');
      expect(signInResult.error).toBeNull();
      expect(signInResult.session).toBeDefined();

      // Get current user
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const currentUser = await service.getCurrentUser();
      expect(currentUser?.id).toBe('test-user-id');

      // Refresh session
      const newSession = createMockSession({
        access_token: 'refreshed-token',
        expires_at: Math.floor(Date.now() / 1000) + 7200
      });
      
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: newSession, user: mockUser },
        error: null
      });

      const refreshedSession = await service.refreshSession();
      expect(refreshedSession?.access_token).toBe('refreshed-token');

      // Sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await service.signOut();

      // Verify signed out
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const finalSession = await service.getSession();
      expect(finalSession).toBeNull();
    });

    it('should maintain session across multiple operations', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      // Sign in
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      await service.signIn('test@example.com', 'password123');

      // Mock successful session validation
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Perform multiple operations
      const isValid1 = await service.validateSession();
      const isValid2 = await service.validateSession();
      const currentUser1 = await service.getCurrentUser();
      const currentUser2 = await service.getCurrentUser();

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
      expect(currentUser1?.id).toBe('test-user-id');
      expect(currentUser2?.id).toBe('test-user-id');
    });
  });
});