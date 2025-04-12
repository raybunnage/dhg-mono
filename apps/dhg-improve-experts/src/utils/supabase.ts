import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

// Add debug logging at the top
console.log('Supabase Config:', {
  hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  urlStart: import.meta.env.VITE_SUPABASE_URL?.slice(0, 30),
  // Don't log the full key
})

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storageKey: 'dhg-supabase-auth'
    }
  }
)

// Add the working ensureAuth function
export const ensureAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('Already authenticated as:', session.user.email);
      return true;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: import.meta.env.VITE_TEST_USER_EMAIL,
      password: import.meta.env.VITE_TEST_USER_PASSWORD,
    });

    if (error) {
      console.error('Auth error:', error);
      return false;
    }

    console.log('Successfully authenticated as:', data.user?.email);
    return true;
  } catch (error) {
    console.error('Auth error:', error);
    return false;
  }
}

// Call this in App.tsx useEffect
export async function initializeSupabase() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    await ensureAuth()
  }
}

// Add this debug function
export async function testAuth() {
  console.log('🔑 Starting auth test...')
  
  if (!import.meta.env.VITE_TEST_USER_EMAIL || !import.meta.env.VITE_TEST_USER_PASSWORD) {
    console.error('❌ Missing test user credentials in environment')
    return
  }

  console.log('📧 Attempting login for:', import.meta.env.VITE_TEST_USER_EMAIL)
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: import.meta.env.VITE_TEST_USER_EMAIL,
    password: import.meta.env.VITE_TEST_USER_PASSWORD,
  })
  
  if (error) {
    console.error('❌ Auth test failed:', error)
    return
  }
  
  console.log('✅ Auth test succeeded:', data.session?.user.email)
} 

// System user ID used across the codebase and database functions
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Helper function to add user references to records
export async function addUserReferences<T extends Record<string, any>>(recordWithUser: T): Promise<T> {
  try {
    // Try to get the current user session
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id || SYSTEM_USER_ID;
    
    // Add user reference fields if they don't exist
    if (!recordWithUser.created_by) {
      recordWithUser.created_by = userId;
    }
    
    if (!recordWithUser.updated_by) {
      recordWithUser.updated_by = userId;
    }
    
    return recordWithUser;
  } catch (error) {
    // If there's any error, fall back to the system user ID
    if (!recordWithUser.created_by) {
      recordWithUser.created_by = SYSTEM_USER_ID;
    }
    
    if (!recordWithUser.updated_by) {
      recordWithUser.updated_by = SYSTEM_USER_ID;
    }
    
    return recordWithUser;
  }
}