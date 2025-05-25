import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../../../packages/shared/services/auth-service';

// Mock the Supabase client
vi.mock('../../../../packages/shared/services/supabase-client', () => ({
  SupabaseClientService: {
    getInstance: () => ({
      getClient: () => ({
        auth: {
          signInWithPassword: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
          signInWithOtp: vi.fn(),
          getSession: vi.fn(),
          getUser: vi.fn(),
          updateUser: vi.fn(),
          onAuthStateChange: vi.fn(),
          refreshSession: vi.fn(),
        },
        from: vi.fn(),
      }),
    }),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Authentication', () => {
    it('should be a singleton instance', () => {
      const instance1 = authService;
      const instance2 = authService;
      expect(instance1).toBe(instance2);
    });

    it('should handle sign in with email and password', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signIn('test@example.com', 'password123');
      
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle sign in errors', async () => {
      const mockError = { message: 'Invalid credentials', status: 400 };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError,
      });

      const result = await authService.signIn('test@example.com', 'wrong-password');
      
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle sign up with email and password', async () => {
      const mockUser = { id: '123', email: 'new@example.com' };
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signUp('new@example.com', 'password123');
      
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle sign out', async () => {
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
        error: null,
      });

      await expect(authService.signOut()).resolves.not.toThrow();
    });
  });

  describe('Magic Link Authentication', () => {
    it('should send magic link email', async () => {
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      const result = await authService.sendMagicLink({ email: 'test@example.com' });
      
      expect(result.error).toBeNull();
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('localhost'),
        },
      });
    });

    it('should handle magic link errors', async () => {
      const mockError = { message: 'Email not allowed', status: 400 };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError,
      });

      const result = await authService.sendMagicLink({ email: 'invalid@example.com' });
      
      expect(result.error).toEqual(mockError);
    });
  });

  describe('User Management', () => {
    it('should get current user', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const user = await authService.getCurrentUser();
      
      expect(user).toEqual(mockUser);
    });

    it('should update user profile', async () => {
      const mockUser = { 
        id: '123', 
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' }
      };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const updatedUser = await authService.updateUserProfile({ full_name: 'Test User' });
      
      expect(updatedUser).toEqual(mockUser);
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        data: { full_name: 'Test User' },
      });
    });
  });

  describe('Session Management', () => {
    it('should get current session', async () => {
      const mockSession = { 
        access_token: 'token', 
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000 
      };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const session = await authService.getSession();
      
      expect(session).toEqual(mockSession);
    });

    it('should refresh session', async () => {
      const mockSession = { 
        access_token: 'new-token', 
        refresh_token: 'new-refresh',
        expires_at: Date.now() + 3600000 
      };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.refreshSession).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const session = await authService.refreshSession();
      
      expect(session).toEqual(mockSession);
    });

    it('should check if session is expired', async () => {
      // Test with valid session
      const validSession = { 
        access_token: 'token', 
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000 // 1 hour from now
      };
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: validSession },
        error: null,
      });

      const isExpired = await authService.isSessionExpired();
      expect(isExpired).toBe(false);

      // Test with expired session
      const expiredSession = { 
        access_token: 'token', 
        refresh_token: 'refresh',
        expires_at: Date.now() - 3600000 // 1 hour ago
      };
      
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: expiredSession },
        error: null,
      });

      const isExpired2 = await authService.isSessionExpired();
      expect(isExpired2).toBe(true);
    });
  });

  describe('Permission and Role Management', () => {
    it('should check user permissions', async () => {
      // Mock the database query for permissions
      const mockPermissions = {
        data: [{ permission: 'admin:access' }],
        error: null,
      };
      
      const supabase = authService['supabase'];
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockPermissions),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(fromMock);

      // Mock current user
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: { id: '123', email: 'test@example.com' } },
        error: null,
      });

      const hasPermission = await authService.hasPermission('admin:access');
      expect(hasPermission).toBe(true);

      const hasNoPermission = await authService.hasPermission('super:admin');
      expect(hasNoPermission).toBe(false);
    });

    it('should get user roles', async () => {
      const mockRoles = {
        data: [
          { role: 'admin' },
          { role: 'editor' },
        ],
        error: null,
      };
      
      const supabase = authService['supabase'];
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockRoles),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(fromMock);

      // Mock current user
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: { id: '123', email: 'test@example.com' } },
        error: null,
      });

      const roles = await authService.getUserRoles();
      expect(roles).toEqual(['admin', 'editor']);
    });
  });

  describe('Auth State Change Listener', () => {
    it('should subscribe to auth state changes', () => {
      const callback = vi.fn();
      const unsubscribeMock = vi.fn();
      
      const supabase = authService['supabase'];
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValueOnce({
        data: { subscription: { unsubscribe: unsubscribeMock } },
      });

      const subscription = authService.onAuthStateChange(callback);
      
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
      expect(subscription.unsubscribe).toBe(unsubscribeMock);
    });
  });
});