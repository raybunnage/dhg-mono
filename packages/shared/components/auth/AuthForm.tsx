import React, { useState } from 'react';
import { Mail, Lock, Loader2, LogIn, UserPlus, Send } from 'lucide-react';

export interface AuthFormProps {
  mode: 'signin' | 'signup' | 'magic-link';
  onSubmit: (data: AuthFormData) => Promise<void>;
  onModeChange?: (mode: 'signin' | 'signup' | 'magic-link') => void;
  loading?: boolean;
  error?: string | null;
  success?: string | null;
}

export interface AuthFormData {
  email: string;
  password?: string;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  mode,
  onSubmit,
  onModeChange,
  loading = false,
  error,
  success
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: AuthFormData = { email };
    if (mode !== 'magic-link') {
      data.password = password;
    }
    
    await onSubmit(data);
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'signin':
        return <LogIn className="w-5 h-5" />;
      case 'signup':
        return <UserPlus className="w-5 h-5" />;
      case 'magic-link':
        return <Send className="w-5 h-5" />;
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'signin':
        return 'Sign In';
      case 'signup':
        return 'Sign Up';
      case 'magic-link':
        return 'Magic Link';
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'signin':
        return 'Welcome back! Please sign in to continue.';
      case 'signup':
        return 'Create a new account to get started.';
      case 'magic-link':
        return 'Enter your email to receive a magic link.';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center justify-center mb-2">
          {getModeIcon()}
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">{getModeTitle()}</h2>
        <p className="text-gray-600 text-center mb-6">{getModeDescription()}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          {mode !== 'magic-link' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                Processing...
              </>
            ) : (
              <>
                {getModeIcon()}
                <span className="ml-2">{getModeTitle()}</span>
              </>
            )}
          </button>
        </form>

        {onModeChange && (
          <div className="mt-6 space-y-2">
            {mode !== 'signin' && (
              <button
                onClick={() => onModeChange('signin')}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-900"
                disabled={loading}
              >
                Already have an account? Sign in
              </button>
            )}
            {mode !== 'signup' && (
              <button
                onClick={() => onModeChange('signup')}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-900"
                disabled={loading}
              >
                Don't have an account? Sign up
              </button>
            )}
            {mode !== 'magic-link' && (
              <button
                onClick={() => onModeChange('magic-link')}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-900"
                disabled={loading}
              >
                Sign in with magic link
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};