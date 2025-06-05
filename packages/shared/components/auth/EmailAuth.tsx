import React, { useState } from 'react';
import { getBrowserAuthService, type AccessRequestData } from '../../services/auth-service/browser';

interface EmailAuthProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export const EmailAuth: React.FC<EmailAuthProps> = ({ redirectTo }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccessRequestForm, setShowAccessRequestForm] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check if email is allowed
      const isAllowed = await getBrowserAuthService().isEmailAllowed(email);

      if (isAllowed) {
        // Send magic link
        const result = await getBrowserAuthService().sendMagicLink({ 
          email, 
          redirectTo: redirectTo || window.location.origin 
        });

        if (result.error) {
          setError(result.error.message);
        } else {
          setMagicLinkSent(true);
        }
      } else {
        // Show access request form
        setShowAccessRequestForm(true);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Email auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email!</h2>
          <p className="text-gray-600 mb-4">
            We've sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Click the link in your email to sign in. The link will expire in 1 hour.
          </p>
          <button
            onClick={() => {
              setMagicLinkSent(false);
              setEmail('');
            }}
            className="mt-4 text-blue-600 hover:text-blue-800 text-sm"
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  if (showAccessRequestForm) {
    return <AccessRequestForm email={email} onBack={() => setShowAccessRequestForm(false)} />;
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign in to DHG Audio</h2>
      
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
          {isLoading ? 'Checking...' : 'Continue with email'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600 text-center">
        No password required. We'll send you a magic link to sign in.
      </p>
    </div>
  );
};

interface AccessRequestFormProps {
  email: string;
  onBack: () => void;
}

const AccessRequestForm: React.FC<AccessRequestFormProps> = ({ email, onBack }) => {
  const [formData, setFormData] = useState<Omit<AccessRequestData, 'email'>>({
    name: '',
    profession: '',
    organization: '',
    professional_interests: '',
    reason_for_access: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await getBrowserAuthService().submitAccessRequest({
        email,
        ...formData
      });

      if (result.success) {
        setRequestSubmitted(true);
      } else {
        setError(result.error || 'Failed to submit request');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Access request error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (requestSubmitted) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request submitted!</h2>
          <p className="text-gray-600 mb-4">
            Thank you for your interest in DHG Audio. We'll review your request and get back to you at <strong>{email}</strong> soon.
          </p>
          <p className="text-sm text-gray-500">
            You'll receive an email once your request has been approved.
          </p>
        </div>
      </div>
    );
  }

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

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Request access</h2>
      <p className="text-gray-600 mb-6">
        Your email isn't on our access list yet. Please tell us a bit about yourself to request access.
      </p>

      <form onSubmit={handleSubmit}>
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

        <div className="mb-4">
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

        <div className="mb-6">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
            Why would you like access?
          </label>
          <textarea
            id="reason"
            value={formData.reason_for_access}
            onChange={(e) => setFormData({ ...formData, reason_for_access: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Optional: Tell us how you plan to use DHG Audio"
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
          {isLoading ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
    </div>
  );
};