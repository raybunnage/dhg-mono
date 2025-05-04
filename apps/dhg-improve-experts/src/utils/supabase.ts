/**
 * Re-export the Supabase client from the integrated singleton service
 * This file exists for backward compatibility
 */
import {
  supabase,
  ensureAuth,
  initializeSupabase,
  testAuth,
  SYSTEM_USER_ID,
  addUserReferences,
  getSupabaseClient,
  getSupabaseService,
  SupabaseClientService
} from '../integrations/supabase/client';

// Re-export everything from the singleton implementation
export {
  supabase,
  ensureAuth,
  initializeSupabase,
  SYSTEM_USER_ID,
  addUserReferences,
  getSupabaseClient,
  getSupabaseService,
  SupabaseClientService
};

// Add a backward compatible test function
export async function testAuth() {
  console.log('🔑 Testing Supabase auth via singleton service...');
  const supabaseService = SupabaseClientService.getInstance();
  const success = await supabaseService.ensureAuth();
  
  if (success) {
    console.log('✅ Auth test successful');
  } else {
    console.error('❌ Auth test failed');
  }
  
  return success;
}