import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { profileService } from '../services/profile-service';

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
  const [tempUserData, setTempUserData] = useState<{ email: string; name: string; userId?: string }>({ email: '', name: '' });
  const [isNewUser, setIsNewUser] = useState(false);
  
  const { login, registerWithProfile, completeProfile, user } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Attempting login with email:', email);
      const result = await login(email);
      console.log('Login result:', result);
      
      if (result.success && !result.needsProfile) {
        // Login successful - the App component will handle navigation
        console.log('Login successful');
      } else if (result.needsProfile) {
        // User needs to complete profile
        console.log('User needs to complete profile, user:', result.user);
        
        if (result.user) {
          // Existing user on whitelist but needs profile
          setTempUserData({ 
            email: result.user.email || email, 
            name: result.user.user_metadata?.name || email.split('@')[0],
            userId: result.user.id 
          });
          setIsNewUser(false);
        } else {
          // New user not on whitelist
          setTempUserData({ 
            email, 
            name: email.split('@')[0] 
          });
          setIsNewUser(true);
        }
        
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
      console.log('Submitting profile:', { 
        email: tempUserData.email, 
        isNewUser, 
        userId: tempUserData.userId,
        profileData 
      });
      
      if (isNewUser) {
        // New user - register with profile
        const result = await registerWithProfile(
          tempUserData.email,
          tempUserData.name,
          profileData
        );

        if (result.success) {
          console.log('New user registration successful');
          // Force re-authentication to update the user state
          window.dispatchEvent(new Event('storage'));
        } else {
          throw new Error(result.error || 'Registration failed');
        }
      } else if (tempUserData.userId) {
        // Existing user - just complete profile
        console.log('Completing profile for existing user:', tempUserData.userId);
        const result = await profileService.saveProfile(tempUserData.userId, profileData);
        
        if (result.success) {
          console.log('Profile completion successful');
          // Update the user in localStorage to reflect profile completion
          const currentUser = user || JSON.parse(localStorage.getItem('dhg_auth_user') || '{}');
          if (currentUser) {
            currentUser.user_metadata = {
              ...currentUser.user_metadata,
              profile_complete: true
            };
            localStorage.setItem('dhg_auth_user', JSON.stringify(currentUser));
          }
          // Force re-authentication to update the user state
          window.dispatchEvent(new Event('storage'));
        } else {
          throw new Error(result.error || 'Failed to save profile');
        }
      } else {
        throw new Error('Invalid state: no user ID for profile completion');
      }
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
              Email: {tempUserData.email}
            </p>
            <ProfileForm
              onSubmit={handleProfileSubmit}
              onCancel={() => {
                setShowProfileForm(false);
                setEmail('');
                setTempUserData({ email: '', name: '' });
                setIsNewUser(false);
              }}
              isLoading={isLoading}
            />
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}
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