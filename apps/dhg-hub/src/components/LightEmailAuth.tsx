import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dhgHubAuthService } from '../services/dhg-hub-auth-service';
import { SimpleProfileForm, SimpleProfileFormData } from './SimpleProfileForm';

export const LightEmailAuth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const { login, registerWithProfile, completeProfile, user, needsProfile } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // First check if email is whitelisted
      const { isWhitelisted } = await dhgHubAuthService.checkWhitelistStatus(email);
      
      if (isWhitelisted) {
        // Try to login
        await login(email);
        // If login successful and user has profile, navigation will be handled by App.tsx
        // If user needs profile, needsProfile will be true
        if (needsProfile) {
          setIsNewUser(false);
          setShowProfileForm(true);
        }
      } else {
        // Not whitelisted - show registration form
        setIsNewUser(true);
        setShowProfileForm(true);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (profileData: SimpleProfileFormData) => {
    setIsLoading(true);
    setError('');

    try {
      if (isNewUser) {
        // New user - register with profile
        await registerWithProfile(email, {
          display_name: profileData.display_name,
          bio: profileData.bio,
          avatar_url: profileData.avatar_url
        });
      } else {
        // Existing user - complete profile
        await completeProfile({
          display_name: profileData.display_name,
          bio: profileData.bio,
          avatar_url: profileData.avatar_url
        });
      }
      // Navigation will be handled by App.tsx after successful profile completion
    } catch (err) {
      console.error('Profile submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (showProfileForm || needsProfile) {
    return (
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-4">
            Complete Your Profile
          </h2>
          <p className="text-center text-gray-600 mb-6">
            Email: {email || user?.email}
          </p>
          <SimpleProfileForm
            onSubmit={handleProfileSubmit}
            onCancel={() => {
              setShowProfileForm(false);
              setEmail('');
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
    );
  }

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
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
                placeholder="Enter your email"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
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
                Light authentication
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};