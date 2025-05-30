import { createClient } from '@supabase/supabase-js';

// Admin client using service role key for bypassing RLS
// This should only be used in admin contexts where we need full access

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('=== Supabase Admin Client Setup ===');
console.log('URL:', supabaseUrl);
console.log('Service Role Key:', supabaseServiceRoleKey ? 'Present' : 'Missing');
console.log('Service Role Key first 20 chars:', supabaseServiceRoleKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase admin environment variables!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? 'Set' : 'Not set');
  throw new Error('Missing Supabase admin environment variables');
}

// Create admin client with service role key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Supabase admin client created successfully');