import React, { useState } from 'react';
import { EmailAuth } from './EmailAuth';
import { AdminPanel } from './AdminPanel';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { authService } from '../services/auth-service';

export const AuthDemo: React.FC = () => {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const [showMakeAdmin, setShowMakeAdmin] = useState(false);

  const handleSignOut = async () => {
    await authService.signOut();
    window.location.reload();
  };

  const handleMakeAdmin = async () => {
    const result = await authService.makeMeAdmin();
    if (result.success) {
      alert('You are now an admin! Please refresh the page.');
      window.location.reload();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  if (loading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <EmailAuth />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">DHG Audio</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            {isAdmin && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Admin</span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="py-10">
        {isAdmin ? (
          <AdminPanel />
        ) : (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to DHG Audio!</h2>
              <p className="text-gray-600 mb-6">
                You're successfully logged in. This is where your main application content would go.
              </p>

              {/* Developer tools - remove in production */}
              <div className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Developer Tools</h3>
                <p className="text-xs text-gray-500 mb-3">
                  For initial setup only - remove this section in production
                </p>
                
                {!showMakeAdmin ? (
                  <button
                    onClick={() => setShowMakeAdmin(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Show admin setup option
                  </button>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Click below to make yourself an admin. This function should be removed after initial setup.
                    </p>
                    <button
                      onClick={handleMakeAdmin}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Make me admin
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};