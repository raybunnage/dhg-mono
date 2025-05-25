import { useState, useEffect, useCallback } from 'react';
import { dhgHubAuthService, AuthUser, ProfileData } from '../services/dhg-hub-auth-service';
import { profileService } from '../services/profile-service';

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  needsProfile: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  completeProfile: (profileData: ProfileData) => Promise<void>;
  registerWithProfile: (email: string, profileData: ProfileData) => Promise<void>;
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

  const completeProfile = async (profileData: ProfileData) => {
    if (!user) {
      throw new Error('No user to complete profile for');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { profile, error: profileError } = await profileService.createProfile(
        user.id,
        user.email,
        profileData
      );
      
      if (profileError) {
        throw profileError;
      }
      
      if (!profile) {
        throw new Error('Failed to create profile');
      }
      
      const updatedUser = {
        ...user,
        user_profile_id: profile.id,
        profile: profile
      };
      
      dhgHubAuthService.saveUser(updatedUser);
      setUser(updatedUser);
      setNeedsProfile(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete profile';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithProfile = async (email: string, profileData: ProfileData) => {
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