import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { envCheck } from '../utils/env-check';

class SupabaseBrowserClient {
  private static instance: SupabaseBrowserClient;
  private client: SupabaseClient | null = null;
  
  private constructor() {}
  
  static getInstance(): SupabaseBrowserClient {
    if (!SupabaseBrowserClient.instance) {
      SupabaseBrowserClient.instance = new SupabaseBrowserClient();
    }
    return SupabaseBrowserClient.instance;
  }
  
  getClient(): SupabaseClient {
    if (!this.client) {
      envCheck();
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables not configured');
      }
      
      this.client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          storageKey: 'dhg-hub-auth',
          storage: window.localStorage,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
    }
    
    return this.client;
  }
}

export const supabaseBrowser = SupabaseBrowserClient.getInstance();
export const supabase = supabaseBrowser.getClient();