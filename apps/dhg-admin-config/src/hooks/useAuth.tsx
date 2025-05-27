import React, { createContext, useContext, useEffect, useState } from 'react';
import { browserAuthService, type AppUser } from '../services/admin-auth-service';
import { isUserAdmin } from '../services/admin-auth-service';

interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  console.log('=== AuthProvider rendering ===');
  console.log('Current state:', { user, isAdmin, isLoading });

  useEffect(() => {
    console.log('=== AuthProvider mounted, checking user... ===');
    checkUser();
    
    const subscription = browserAuthService().onAuthStateChange(async (user) => {
      setUser(user);
      if (user) {
        const adminStatus = await isUserAdmin();
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      console.log('=== Checking current user... ===');
      const currentUser = await browserAuthService().getCurrentUser();
      console.log('Current user:', currentUser);
      setUser(currentUser);
      if (currentUser) {
        console.log('User found, checking admin status...');
        const adminStatus = await isUserAdmin();
        console.log('Admin status:', adminStatus);
        setIsAdmin(adminStatus);
      }
    } catch (error) {
      console.error('=== Error checking user ===:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const result = await browserAuthService().signIn(email, password);
    if (result.user) {
      const adminStatus = await isUserAdmin();
      setIsAdmin(adminStatus);
    }
    return result;
  };

  const signOut = async () => {
    await browserAuthService().signOut();
    setUser(null);
    setIsAdmin(false);
  };

  console.log('AuthProvider render - isLoading:', isLoading, 'user:', user, 'isAdmin:', isAdmin);
  
  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};