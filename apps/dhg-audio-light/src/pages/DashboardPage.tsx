import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">DHG Audio Light Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user?.user_metadata?.name || user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to DHG Audio Light</h2>
          <p className="text-gray-600 mb-4">
            You have successfully logged in using the lightweight authentication system.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Your Profile</h3>
            <dl className="text-sm space-y-1">
              <div>
                <dt className="inline font-medium text-gray-700">Email:</dt>
                <dd className="inline text-gray-600 ml-2">{user?.email}</dd>
              </div>
              {user?.user_metadata?.name && (
                <div>
                  <dt className="inline font-medium text-gray-700">Name:</dt>
                  <dd className="inline text-gray-600 ml-2">{user.user_metadata.name}</dd>
                </div>
              )}
              {user?.user_metadata?.profession && (
                <div>
                  <dt className="inline font-medium text-gray-700">Profession:</dt>
                  <dd className="inline text-gray-600 ml-2">{user.user_metadata.profession}</dd>
                </div>
              )}
              {user?.user_metadata?.organization && (
                <div>
                  <dt className="inline font-medium text-gray-700">Organization:</dt>
                  <dd className="inline text-gray-600 ml-2">{user.user_metadata.organization}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
};