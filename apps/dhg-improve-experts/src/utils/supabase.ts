import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

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
    await initializeSupabaseAuth()
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