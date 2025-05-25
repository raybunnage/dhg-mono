export function envCheck(): void {
  if (typeof import.meta.env === 'undefined') {
    throw new Error('Vite environment not available. This code must run in a Vite environment.');
  }
  
  const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}