/**
 * Environment Check Utility
 * 
 * Ensures environment variables are loaded before services initialize
 */

export function checkEnvironment(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if Vite has loaded the environment variables
  const hasViteEnv = typeof import.meta !== 'undefined' && import.meta.env;
  
  if (!hasViteEnv) {
    console.warn('Vite environment not available yet');
    return false;
  }

  // Check for required environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables:', {
      VITE_SUPABASE_URL: !!supabaseUrl,
      VITE_SUPABASE_ANON_KEY: !!supabaseKey
    });
    return false;
  }

  return true;
}

/**
 * Wait for environment to be ready
 */
export async function waitForEnvironment(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (checkEnvironment()) {
      return true;
    }
    // Wait 100ms before next attempt
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.error('Environment failed to initialize after', maxAttempts, 'attempts');
  return false;
}