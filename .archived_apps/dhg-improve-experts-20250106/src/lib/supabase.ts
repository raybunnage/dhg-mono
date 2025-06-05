import { supabase as workingSupabase } from '@/integrations/supabase/client';

// Re-export the working Supabase client
export const supabase = workingSupabase;