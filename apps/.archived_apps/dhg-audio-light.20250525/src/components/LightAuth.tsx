import React, { useState } from 'react';
import { lightAuthService, type ProfileData } from '../services/light-auth-service';
import { useAuth } from '../hooks/useAuth';

interface LightAuthProps {
  onSuccess?: () => void;
}

export const LightAuth: React.FC<LightAuthProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const { login } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check if email is allowed
      const isAllowed = await lightAuthService.isEmailAllowed(email);

      if (isAllowed) {
        // Log them in directly
        const success = await login(email);
        if (success) {
          onSuccess?.();
        } else {
          setError('Login failed. Please try again.');
        }
      } else {
        // Show registration form
        setShowRegistration(true);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (showRegistration) {
    return <RegistrationForm email={email} onSuccess={onSuccess} onBack={() => setShowRegistration(false)} />;
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign in to DHG Audio Light</h2>
      
      <form onSubmit={handleEmailSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
            required
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Checking...' : 'Continue'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600 text-center">
        If you're new, you'll be asked to complete a quick profile.
      </p>
    </div>
  );
};

interface RegistrationFormProps {
  email: string;
  onSuccess?: () => void;
  onBack: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ email, onSuccess, onBack }) => {
  const [formData, setFormData] = useState<Omit<ProfileData, 'email'>>({
    name: '',
    profession: '',
    organization: '',
    professional_interests: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Register the user (auto-adds to whitelist)
      const result = await lightAuthService.registerUser({
        email,
        ...formData
      });

      if (result.success && result.user) {
        // Log them in
        await login(email);
        onSuccess?.();
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <button
        onClick={onBack}
        className="mb-4 text-gray-600 hover:text-gray-800 flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete your profile</h2>
      <p className="text-gray-600 mb-6">
        Tell us a bit about yourself to get instant access.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Your name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-2">
            Profession
          </label>
          <input
            type="text"
            id="profession"
            value={formData.profession}
            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Research Scientist, Medical Professional"
            disabled={isLoading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
            Organization
          </label>
          <input
            type="text"
            id="organization"
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your company or institution"
            disabled={isLoading}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="interests" className="block text-sm font-medium text-gray-700 mb-2">
            Professional interests
          </label>
          <textarea
            id="interests"
            value={formData.professional_interests}
            onChange={(e) => setFormData({ ...formData, professional_interests: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="What are your main areas of interest or research?"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !formData.name}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating account...' : 'Get instant access'}
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-500 text-center">
        By submitting, you'll be automatically added to our access list.
      </p>
    </div>
  );
};