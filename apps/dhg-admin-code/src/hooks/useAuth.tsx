import React, { createContext, useContext, useEffect, useState } from 'react';
import { browserAuthService, isUserAdmin } from '../services/admin-auth-service';
import type { AppUser } from '@shared/services/auth-service/types';

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

  useEffect(() => {
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
      const currentUser = await browserAuthService().getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const adminStatus = await isUserAdmin();
        setIsAdmin(adminStatus);
      }
    } catch (error) {
      console.error('Error checking user:', error);
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