/**
 * Supabase Initialization for dhg-audio
 * 
 * This file ensures Supabase is properly initialized in the browser environment
 * before any services try to use it.
 */

import { supabaseBrowserClient } from './supabase-browser';

/**
 * Initialize Supabase and ensure credentials are available
 */
export async function initializeSupabase(): Promise<boolean> {
  try {
    // Check if environment variables are available
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.error('[initializeSupabase] Missing environment variables:', {
        VITE_SUPABASE_URL: !!url,
        VITE_SUPABASE_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        VITE_SUPABASE_SERVICE_ROLE_KEY: !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      });
      
      // Show user-friendly error
      throw new Error(
        'Unable to find Supabase credentials. Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env file.'
      );
    }
    
    // Initialize the browser client
    const client = supabaseBrowserClient.getClient();
    
    // Test the connection
    const connected = await supabaseBrowserClient.testConnection();
    
    if (!connected) {
      console.error('[initializeSupabase] Failed to connect to Supabase');
      return false;
    }
    
    console.log('[initializeSupabase] Supabase initialized successfully');
    return true;
  } catch (error) {
    console.error('[initializeSupabase] Error:', error);
    throw error;
  }
}

/**
 * Ensure Supabase is initialized before proceeding
 * This should be called at app startup
 */
export async function ensureSupabaseInitialized(): Promise<void> {
  try {
    const initialized = await initializeSupabase();
    if (!initialized) {
      throw new Error('Failed to initialize Supabase');
    }
  } catch (error) {
    // Re-throw with user-friendly message
    if (error instanceof Error && error.message.includes('Unable to find Supabase credentials')) {
      throw error;
    } else {
      throw new Error(
        'Unable to connect to the database. Please check your internet connection and try again.'
      );
    }
  }
}