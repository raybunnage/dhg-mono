/**
 * React Authentication Hook for Test Audio App
 * 
 * Provides authentication state and methods for React components
 */

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../../../../packages/shared/services/auth-service';
import { AppUser, AuthResult } from '../../../../packages/shared/services/auth-service/types';

/**
 * Authentication hook state
 */
interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Authentication hook return type
 */
interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, data?: Record<string, any>) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<AuthResult>;
  updateProfile: (updates: { full_name?: string; preferences?: Record<string, any> }) => Promise<AppUser>;
  refreshSession: () => Promise<void>;
}

/**
 * React hook for authentication
 * 
 * @example
 * ```tsx
 * function LoginComponent() {
 *   const { user, loading, error, signIn, signOut } = useAuth();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   
 *   if (user) {
 *     return (
 *       <div>
 *         <p>Welcome, {user.email}</p>
 *         <button onClick={signOut}>Sign Out</button>
 *       </div>
 *     );
 *   }
 *   
 *   return <LoginForm onSubmit={signIn} error={error} />;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  // Initialize authentication state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (mounted) {
          setState({
            user,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        if (mounted) {
          setState({
            user: null,
            loading: false,
            error: error as Error
          });
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const subscription = authService.onAuthStateChange((user) => {
      if (mounted) {
        setState(prev => ({
          ...prev,
          user,
          loading: false
        }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in method
  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await authService.signIn(email, password);
      
      if (result.error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error(result.error.message)
        }));
      } else {
        setState({
          user: result.user,
          loading: false,
          error: null
        });
      }
      
      return result;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err
      }));
      return { session: null, user: null, error: err as any };
    }
  }, []);

  // Sign up method
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    data?: Record<string, any>
  ): Promise<AuthResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await authService.signUp(email, password, { data });
      
      if (result.error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error(result.error.message)
        }));
      } else {
        setState({
          user: result.user,
          loading: false,
          error: null
        });
      }
      
      return result;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err
      }));
      return { session: null, user: null, error: err as any };
    }
  }, []);

  // Sign out method
  const signOut = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await authService.signOut();
      setState({
        user: null,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, []);

  // Send magic link method
  const sendMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await authService.sendMagicLink({ email });
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: result.error ? new Error(result.error.message) : null
      }));
      
      return result;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err
      }));
      return { session: null, user: null, error: err as any };
    }
  }, []);

  // Update profile method
  const updateProfile = useCallback(async (updates: {
    full_name?: string;
    preferences?: Record<string, any>;
  }): Promise<AppUser> => {
    if (!state.user) {
      throw new Error('No authenticated user');
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const updatedUser = await authService.updateUserProfile(updates);
      
      setState({
        user: updatedUser,
        loading: false,
        error: null
      });
      
      return updatedUser;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, [state.user]);

  // Refresh session method
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const session = await authService.refreshSession();
      if (!session) {
        setState({
          user: null,
          loading: false,
          error: new Error('Failed to refresh session')
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error
      }));
      throw error;
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signUp,
    signOut,
    sendMagicLink,
    updateProfile,
    refreshSession
  };
}

/**
 * Higher-order component for protecting routes
 * 
 * @example
 * ```tsx
 * const ProtectedDashboard = withAuth(Dashboard);
 * 
 * // Or with custom loading/error components
 * const ProtectedDashboard = withAuth(Dashboard, {
 *   LoadingComponent: CustomLoader,
 *   ErrorComponent: CustomError,
 *   redirectTo: '/login'
 * });
 * ```
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    LoadingComponent?: React.ComponentType;
    ErrorComponent?: React.ComponentType<{ error: Error }>;
    redirectTo?: string;
  }
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { user, loading, error } = useAuth();

    // Show loading component
    if (loading) {
      if (options?.LoadingComponent) {
        return <options.LoadingComponent />;
      }
      return <div>Loading...</div>;
    }

    // Show error component
    if (error) {
      if (options?.ErrorComponent) {
        return <options.ErrorComponent error={error} />;
      }
      return <div>Authentication error: {error.message}</div>;
    }

    // Redirect if not authenticated
    if (!user) {
      if (options?.redirectTo && typeof window !== 'undefined') {
        window.location.href = options.redirectTo;
      }
      return <div>Please sign in to continue</div>;
    }

    // Render the protected component
    return <Component {...props} />;
  };
}

/**
 * Hook for checking permissions
 * 
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { hasPermission, loading } = usePermission('admin:access');
 *   
 *   if (loading) return <div>Checking permissions...</div>;
 *   if (!hasPermission) return <div>Access denied</div>;
 *   
 *   return <div>Admin content here</div>;
 * }
 * ```
 */
export function usePermission(permission: string): {
  hasPermission: boolean;
  loading: boolean;
} {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;

    const checkPermission = async () => {
      if (!user) {
        if (mounted) {
          setHasPermission(false);
          setLoading(false);
        }
        return;
      }

      try {
        const result = await authService.hasPermission(permission);
        if (mounted) {
          setHasPermission(result);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setHasPermission(false);
          setLoading(false);
        }
      }
    };

    checkPermission();

    return () => {
      mounted = false;
    };
  }, [user, permission]);

  return { hasPermission, loading };
}

/**
 * Hook for managing user roles
 * 
 * @example
 * ```tsx
 * function RoleBasedContent() {
 *   const { roles, hasRole, loading } = useRoles();
 *   
 *   if (loading) return <div>Loading roles...</div>;
 *   
 *   return (
 *     <div>
 *       {hasRole('admin') && <AdminSection />}
 *       {hasRole('editor') && <EditorSection />}
 *       <p>Your roles: {roles.join(', ')}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRoles(): {
  roles: string[];
  hasRole: (role: string) => boolean;
  loading: boolean;
} {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;

    const fetchRoles = async () => {
      if (!user) {
        if (mounted) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }

      try {
        const userRoles = await authService.getUserRoles();
        if (mounted) {
          setRoles(userRoles);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setRoles([]);
          setLoading(false);
        }
      }
    };

    fetchRoles();

    return () => {
      mounted = false;
    };
  }, [user]);

  const hasRole = useCallback((role: string): boolean => {
    return roles.includes(role);
  }, [roles]);

  return { roles, hasRole, loading };
}