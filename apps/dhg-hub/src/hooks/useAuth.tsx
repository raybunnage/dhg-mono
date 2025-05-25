import { useState, useEffect, useCallback } from 'react';
import { dhgHubAuthService, AuthUser, ProfileFormData } from '../services/dhg-hub-auth-service';

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  needsProfile: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  completeProfile: (profileData: ProfileFormData) => Promise<void>;
  registerWithProfile: (email: string, profileData: ProfileFormData) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = dhgHubAuthService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setNeedsProfile(!currentUser.profile);
      } else {
        setUser(null);
        setNeedsProfile(false);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Failed to check authentication status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dhg_hub_auth_user') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkAuth]);

  const login = async (email: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { user: authUser, error: loginError } = await dhgHubAuthService.loginWithEmail(email);
      
      if (loginError) {
        throw loginError;
      }
      
      if (!authUser) {
        throw new Error('Login failed - no user returned');
      }
      
      if (!authUser.profile) {
        setNeedsProfile(true);
      }
      
      dhgHubAuthService.saveUser(authUser);
      setUser(authUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await dhgHubAuthService.logout();
      setUser(null);
      setNeedsProfile(false);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async (profileData: ProfileFormData) => {
    if (!user) {
      throw new Error('No user to complete profile for');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dhgHubAuthService.completeProfile(user.id, profileData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete profile');
      }
      
      if (result.user) {
        // The auth service already returns the properly formatted user
        const updatedUser = {
          id: result.user.id,
          email: result.user.email || user.email,
          role: (result.user as any).role || 'user',
          created_at: result.user.created_at,
          last_login_at: (result.user as any).last_login_at || null,
          user_profile_id: (result.user as any).user_profile_id,
          profile: (result.user as any).profile || null
        };
        
        dhgHubAuthService.saveUser(updatedUser);
        setUser(updatedUser);
        setNeedsProfile(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete profile';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithProfile = async (email: string, profileData: ProfileFormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const { user: newUser, error: registerError } = await dhgHubAuthService.registerWithProfile(
        email,
        profileData
      );
      
      if (registerError) {
        throw registerError;
      }
      
      if (!newUser) {
        throw new Error('Registration failed - no user returned');
      }
      
      dhgHubAuthService.saveUser(newUser);
      setUser(newUser);
      setNeedsProfile(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    needsProfile,
    login,
    logout,
    completeProfile,
    registerWithProfile
  };
}