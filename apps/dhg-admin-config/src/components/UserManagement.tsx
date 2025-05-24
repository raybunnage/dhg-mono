import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const UserManagement: React.FC = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showDirectReset, setShowDirectReset] = useState(false);

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(`Password reset email sent to ${email}`);
        setEmail('');
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeAdmin = async () => {
    if (!email) {
      setMessage('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Call the set_user_admin_role function we created earlier
      const { data, error } = await supabase.rpc('set_user_admin_role', {
        target_email: email,
        is_admin: true
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(`Successfully set admin role for ${email}`);
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !newPassword) {
      setMessage('Please enter both email and new password');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        target_email: email,
        new_password: newPassword
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(`Successfully reset password for ${email}`);
        setNewPassword('');
        setShowDirectReset(false);
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>
      
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Management</h3>
          
          {!showDirectReset ? (
            <form onSubmit={handleSendPasswordReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="bunnage.ray@gmail.com"
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send Password Reset Email'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowDirectReset(true)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Direct Password Reset
                </button>
                
                <button
                  type="button"
                  onClick={handleMakeAdmin}
                  disabled={isLoading || !email}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Setting...' : 'Make Admin'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleDirectPasswordReset} className="space-y-4">
              <div>
                <label htmlFor="direct-email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="direct-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="bunnage.ray@gmail.com"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowDirectReset(false);
                    setNewPassword('');
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          
          {message && (
            <div className={`mt-4 p-3 rounded-md ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-800' 
                : 'bg-green-50 text-green-800'
            }`}>
              {message}
            </div>
          )}
          
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions:</h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Enter the email address (e.g., bunnage.ray@gmail.com)</li>
              <li>Click "Send Password Reset Email" to send a reset link</li>
              <li>Check the email for the reset link</li>
              <li>Use the reset link to set a new password</li>
              <li>After resetting, click "Make Admin" to grant admin privileges</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};