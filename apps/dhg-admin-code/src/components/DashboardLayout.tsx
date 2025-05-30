import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab based on current route
  const getActiveTab = () => {
    if (location.pathname.startsWith('/tasks')) return 'tasks';
    if (location.pathname.startsWith('/work-summaries')) return 'summaries';
    if (location.pathname.startsWith('/refactor-status')) return 'refactor';
    if (location.pathname.startsWith('/cli-commands')) return 'commands';
    return 'tasks'; // default
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTab());
  
  // Update active tab when location changes
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-700 mb-4">You need admin privileges to access this area.</p>
          <button
            onClick={handleSignOut}
            className="text-gray-600 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">DHG Admin Code</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                {user?.email}
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                  Admin
                </span>
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => navigate('/tasks')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }
              `}
            >
              Claude Code Tasks
            </button>
            <button
              onClick={() => navigate('/work-summaries')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'summaries'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }
              `}
            >
              Work Summaries
            </button>
            <button
              onClick={() => navigate('/refactor-status')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'refactor'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }
              `}
            >
              Refactor Status
            </button>
            <button
              onClick={() => navigate('/cli-commands')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'commands'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }
              `}
            >
              CLI Commands Registry
            </button>
          </nav>
        </div>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
};