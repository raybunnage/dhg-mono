import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function sendPasswordReset(email: string) {
  try {
    console.log(`Sending password reset email to: ${email}`);
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5175/reset-password',
    });
    
    if (error) {
      console.error('Error sending reset email:', error);
      return;
    }
    
    console.log('✅ Password reset email sent successfully!');
    console.log('Check your email for the reset link.');
    console.log('The link will redirect to: http://localhost:5175/reset-password');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'bunnage.ray@gmail.com';
console.log('=== Password Reset Tool ===');
sendPasswordReset(email);