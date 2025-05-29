import { BrowserAuthService } from '@shared/services/auth-service/browser';
import { supabase } from './supabase';

// Initialize the BrowserAuthService with our Supabase client
BrowserAuthService.initialize(supabase);

// Export a convenience function to get the initialized service
export const browserAuthService = () => BrowserAuthService.getInstance();