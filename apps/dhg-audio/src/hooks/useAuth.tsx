/**
 * React Authentication Hook for DHG Audio
 * 
 * Provides light authentication state and methods for React components
 * Uses email whitelist authentication
 */

import { useState, useEffect, useCallback } from 'react';
import { dhgAudioLightAuth, LightAuthUser, LightAuthResult } from '../services/light-auth-service-simple';

/**
 * Authentication hook state
 */
interface AuthState {
  user: LightAuthUser | null;
  loading: boolean;
  error: Error | null;
  needsProfile: boolean;
  profileCompleteness?: number;
}

/**
 * Authentication hook return type
 */
interface UseAuthReturn extends AuthState {
  login: (email: string) => Promise<LightAuthResult>;
  logout: () => Promise<void>;
  completeProfile?: (profile: any) => Promise<void>;
  updateProfile?: (profile: any) => Promise<void>;
}

/**
 * React hook for light authentication
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    needsProfile: false
  });

  // Initialize authentication state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const currentUser = dhgAudioLightAuth.getCurrentUser();
        
        // Add a small delay to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (currentUser && mounted) {
          setState({
            user: currentUser,
            loading: false,
            error: null,
            needsProfile: false,
            profileCompleteness: 100
          });
        } else if (mounted) {
          setState({
            user: null,
            loading: false,
            error: null,
            needsProfile: false
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setState({
            user: null,
            loading: false,
            error: error as Error,
            needsProfile: false
          });
        }
      }
    };

    // Listen for storage events to detect auth changes
    const handleStorageChange = () => {
      initializeAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    initializeAuth();

    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Login method
  const login = useCallback(async (email: string): Promise<LightAuthResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('Attempting login with email:', email);
      const result = await dhgAudioLightAuth.login(email);
      console.log('Login result:', result);
      
      if (!result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error(result.error || 'Authentication failed'),
          needsProfile: result.needsProfile || false
        }));
      } else {
        const needsProfile = result.needsProfile || false;
        
        setState({
          user: result.user || null,
          loading: false,
          error: null,
          needsProfile,
          profileCompleteness: needsProfile ? 0 : 100
        });
        
        // Force a re-render by updating localStorage event
        window.dispatchEvent(new Event('storage'));
      }
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      const err = error as Error;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err
      }));
      return { success: false, error: err.message };
    }
  }, []);

  // Logout method
  const logout = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await dhgAudioLightAuth.logout();
      setState({
        user: null,
        loading: false,
        error: null,
        needsProfile: false
      });
      
      // Force a re-render by updating localStorage event
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, []);

  // Placeholder methods for profile management (to be implemented later)
  const completeProfile = useCallback(async (profile: any): Promise<void> => {
    console.log('Profile completion not yet implemented:', profile);
    // TODO: Implement profile completion
  }, []);

  const updateProfile = useCallback(async (profile: any): Promise<void> => {
    console.log('Profile update not yet implemented:', profile);
    // TODO: Implement profile update
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    needsProfile: state.needsProfile,
    profileCompleteness: state.profileCompleteness,
    login,
    logout,
    completeProfile,
    updateProfile
  };
}