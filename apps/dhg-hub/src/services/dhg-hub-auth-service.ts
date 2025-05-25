import { envCheck } from '../utils/env-check';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  user_profile_id?: string;
  profile?: {
    id: string;
    email: string;
    display_name: string;
    bio?: string | null;
    avatar_url?: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

export interface AuthResponse {
  user: AuthUser | null;
  error: Error | null;
}

export interface ProfileData {
  display_name: string;
  bio?: string;
  avatar_url?: string;
}

class DhgHubAuthService {
  private static instance: DhgHubAuthService;
  private lightAuthService: any = null;
  private initPromise: Promise<void> | null = null;
  
  private constructor() {}
  
  static getInstance(): DhgHubAuthService {
    if (!DhgHubAuthService.instance) {
      DhgHubAuthService.instance = new DhgHubAuthService();
    }
    return DhgHubAuthService.instance;
  }
  
  private async ensureInitialized(): Promise<void> {
    if (this.lightAuthService) return;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    
    this.initPromise = this.initialize();
    await this.initPromise;
  }
  
  private async initialize(): Promise<void> {
    try {
      envCheck();
      
      const LightAuthModule = await import('../../../../packages/shared/services/light-auth-enhanced-service/light-auth-enhanced-service');
      const { supabase } = await import('./supabase-browser');
      
      // Create a new instance of the LightAuthEnhanced class
      const LightAuthEnhanced = LightAuthModule.LightAuthEnhanced || LightAuthModule.default;
      this.lightAuthService = new LightAuthEnhanced(supabase);
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      throw error;
    }
  }
  
  async loginWithEmail(email: string): Promise<AuthResponse> {
    try {
      await this.ensureInitialized();
      
      const response = await this.lightAuthService.loginWithEmail(email);
      
      if (!response || response.error) {
        return {
          user: null,
          error: response?.error || new Error('Login failed')
        };
      }
      
      const mappedUser: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        role: response.user.role,
        created_at: response.user.created_at,
        last_login_at: response.user.last_login_at,
        user_profile_id: response.user.user_profile_id,
        profile: response.user.profile
      };
      
      return {
        user: mappedUser,
        error: null
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async checkWhitelistStatus(email: string): Promise<{ isWhitelisted: boolean; error: Error | null }> {
    try {
      await this.ensureInitialized();
      const result = await this.lightAuthService.checkWhitelistStatus(email);
      return result;
    } catch (error) {
      console.error('Whitelist check error:', error);
      return {
        isWhitelisted: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async registerWithProfile(email: string, profileData: ProfileData): Promise<AuthResponse> {
    try {
      await this.ensureInitialized();
      
      const response = await this.lightAuthService.registerWithProfile(email, profileData);
      
      if (!response || response.error) {
        return {
          user: null,
          error: response?.error || new Error('Registration failed')
        };
      }
      
      const mappedUser: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        role: response.user.role,
        created_at: response.user.created_at,
        last_login_at: response.user.last_login_at,
        user_profile_id: response.user.user_profile_id,
        profile: response.user.profile
      };
      
      return {
        user: mappedUser,
        error: null
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async createProfile(userId: string, profileData: ProfileData): Promise<{ profile: any | null; error: Error | null }> {
    try {
      await this.ensureInitialized();
      const result = await this.lightAuthService.createProfile(userId, profileData);
      return result;
    } catch (error) {
      console.error('Profile creation error:', error);
      return {
        profile: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async logout(): Promise<void> {
    localStorage.removeItem('dhg_hub_auth_user');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dhg_hub_auth_user',
      newValue: null,
      storageArea: localStorage
    }));
  }
  
  getCurrentUser(): AuthUser | null {
    const userStr = localStorage.getItem('dhg_hub_auth_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  
  saveUser(user: AuthUser): void {
    localStorage.setItem('dhg_hub_auth_user', JSON.stringify(user));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dhg_hub_auth_user',
      newValue: JSON.stringify(user),
      storageArea: localStorage
    }));
  }
}

export const dhgHubAuthService = DhgHubAuthService.getInstance();