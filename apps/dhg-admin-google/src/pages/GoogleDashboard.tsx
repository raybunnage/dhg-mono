import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const GoogleDashboard: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'explorer' | 'sync' | 'statistics' | 'filters' | 'history' | 'classify'>('explorer');

  console.log('GoogleDashboard render - user:', user?.email, 'isAdmin:', isAdmin);

  const handleSignOut = async () => {
    console.log('Signing out...');
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-purple-50">
      <header className="bg-white shadow-sm border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-purple-900">DHG Admin Google</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-purple-700">
                {user?.email}
                <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                  Admin
                </span>
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-purple-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => {
                setActiveTab('explorer');
                navigate('/explorer');
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'explorer'
                  ? 'border-purple-500 text-purple-700 font-medium'
                  : 'border-transparent text-purple-600 hover:text-purple-800 hover:border-purple-300'
                }
              `}
            >
              Drive Explorer
            </button>
            <button
              onClick={() => {
                setActiveTab('sync');
                navigate('/sync-status');
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'sync'
                  ? 'border-purple-500 text-purple-700 font-medium'
                  : 'border-transparent text-purple-600 hover:text-purple-800 hover:border-purple-300'
                }
              `}
            >
              Sync Status
            </button>
            <button
              onClick={() => {
                setActiveTab('statistics');
                navigate('/statistics');
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'statistics'
                  ? 'border-purple-500 text-purple-700 font-medium'
                  : 'border-transparent text-purple-600 hover:text-purple-800 hover:border-purple-300'
                }
              `}
            >
              Statistics
            </button>
            <button
              onClick={() => {
                setActiveTab('filters');
                navigate('/filters');
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'filters'
                  ? 'border-purple-500 text-purple-700 font-medium'
                  : 'border-transparent text-purple-600 hover:text-purple-800 hover:border-purple-300'
                }
              `}
            >
              Drive Filters
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                navigate('/sync-history');
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'history'
                  ? 'border-purple-500 text-purple-700 font-medium'
                  : 'border-transparent text-purple-600 hover:text-purple-800 hover:border-purple-300'
                }
              `}
            >
              Sync History
            </button>
            <button
              onClick={() => {
                setActiveTab('classify');
                navigate('/classify');
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'classify'
                  ? 'border-purple-500 text-purple-700 font-medium'
                  : 'border-transparent text-purple-600 hover:text-purple-800 hover:border-purple-300'
                }
              `}
            >
              Classification
            </button>
          </nav>
        </div>

        {/* Main content area */}
        <div className="text-center py-12">
          <p className="text-gray-600">Select a tab above to navigate to the corresponding section</p>
        </div>
      </main>
    </div>
  );
};