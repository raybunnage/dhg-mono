import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { lightAuthService, type AppUser } from '../services/light-auth-service';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing user in localStorage
    const currentUser = lightAuthService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    const result = await lightAuthService.login(email);
    if (result.success && result.user) {
      setUser(result.user);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await lightAuthService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};