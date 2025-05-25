import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SupabaseClientService } from '@shared/services/supabase-client';

// Try specific path import like dhg-admin-config uses
import { ProfileForm, ProfileFormData } from '@shared/components/profile/ProfileForm';

interface LightEmailAuthProps {
  redirectTo?: string;
}

export const LightEmailAuth: React.FC<LightEmailAuthProps> = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  
  const { login } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Attempting login with email:', email);
      const result = await login(email);
      console.log('Login result:', result);
      
      if (result.success) {
        // Login successful - the App component will handle navigation
        console.log('Login successful');
        // Don't call onSuccess immediately - let the auth state update first
      } else if (result.needsProfile) {
        // User needs to complete profile
        console.log('User needs to complete profile');
        setShowProfileForm(true);
      } else {
        setError(result.error || 'Login failed');
        console.log('Login failed:', result.error);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Check the console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (profileData: ProfileFormData) => {
    setIsLoading(true);
    setError('');

    try {
      console.log('Submitting profile for registration:', { email, profileData });
      
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // First, get the allowed_emails record to get the user ID
      const { data: allowedEmail, error: emailError } = await supabase
        .from('allowed_emails')
        .select('id, email, name')
        .eq('email', email.toLowerCase())
        .single();

      if (emailError || !allowedEmail) {
        throw new Error('Email not found in allowed list');
      }

      // Insert the profile data into user_profiles_v2 table
      const { data: profileRecord, error: profileError } = await supabase
        .from('user_profiles_v2')
        .insert({
          id: allowedEmail.id,
          profession: profileData.profession,
          professional_title: profileData.professional_title,
          years_experience: profileData.years_experience,
          industry_sectors: profileData.industry_sectors,
          specialty_areas: profileData.specialty_areas,
          credentials: profileData.credentials,
          interested_topics: profileData.interested_topics,
          avoided_topics: profileData.avoided_topics,
          interested_experts: profileData.interested_experts,
          learning_goals: profileData.learning_goals,
          reason_for_learning: profileData.reason_for_learning,
          intended_application: profileData.intended_application,
          current_challenges: profileData.current_challenges,
          preferred_depth: profileData.preferred_depth,
          preferred_formats: profileData.preferred_formats,
          preferred_session_length: profileData.preferred_session_length,
          learning_pace: profileData.learning_pace,
          time_commitment: profileData.time_commitment,
          bio_summary: profileData.bio_summary,
          referral_source: profileData.referral_source,
          learning_background: profileData.learning_background,
          priority_subjects: profileData.priority_subjects,
          content_tags_following: profileData.content_tags_following,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Failed to save profile: ${profileError.message}`);
      }

      console.log('Profile saved successfully:', profileRecord);
      
      // Create user object with the allowed_emails ID as the universal identifier
      const user = {
        id: allowedEmail.id,
        email: allowedEmail.email,
        name: allowedEmail.name || `${profileData.professional_title || ''} ${profileData.profession || ''}`.trim() || email,
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {
          profile_complete: true,
          allowed_email_id: allowedEmail.id
        }
      };

      // Save to localStorage for lightweight auth
      localStorage.setItem('dhg_auth_user', JSON.stringify(user));
      localStorage.setItem('dhg_user_profile', JSON.stringify(profileData));
      
      // Trigger storage event to update auth state
      window.dispatchEvent(new Event('storage'));
      
      console.log('Profile completed and user registered with ID:', allowedEmail.id);
    } catch (err) {
      console.error('Profile submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showProfileForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <h2 className="text-center text-2xl font-bold text-gray-900 mb-4">
              Complete Your Profile
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Email: {email}
            </p>
            <ProfileForm
              onSubmit={handleProfileSubmit}
              onCancel={() => {
                setShowProfileForm(false);
                setEmail('');
              }}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome to DHG Audio
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="test@example.com"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Light authentication - just enter your email to get started
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  No password required
                </span>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>
                This app uses simplified authentication with email whitelist checking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};