import React, { useState } from 'react';
import { dhgAudioLightAuth, type UserRegistrationData } from '../services/light-auth-service';

interface LightEmailAuthProps {
  onSuccess: () => void;
  redirectTo?: string;
}

export const LightEmailAuth: React.FC<LightEmailAuthProps> = ({ 
  onSuccess,
  redirectTo = '/'
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Submitting email:', email);
      const result = await dhgAudioLightAuth.login(email);
      console.log('Login result:', result);
      
      if (result.success) {
        // Login successful - call onSuccess to redirect
        console.log('Login successful, calling onSuccess');
        onSuccess();
      } else {
        setError(result.error || 'Login failed');
        console.log('Login failed:', result.error);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

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
                  placeholder="test@gmail.com"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Try: test@gmail.com, admin@yahoo.com, or any email with common domains for demo
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
                This app uses simplified authentication. 
                {' '}Just enter your email to get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};