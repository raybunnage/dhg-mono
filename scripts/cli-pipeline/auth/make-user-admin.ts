import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function makeUserAdmin(email: string) {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First, get the user ID
    const { data: userData, error: fetchError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (fetchError || !userData) {
      // Try using RPC function instead
      const { data, error } = await supabase.rpc('set_user_admin_role', {
        user_email: email
      });
      
      if (error) {
        console.error('Error setting admin role:', error);
        return;
      }
      
      console.log('Admin role set successfully');
      return;
    }
    
    console.log(`User ID for ${email}: ${userData.id}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
const email = process.argv[2] || 'bunnage.ray@gmail.com';
makeUserAdmin(email);