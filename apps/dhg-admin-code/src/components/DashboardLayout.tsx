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
    if (location.pathname.startsWith('/database')) return 'database';
    if (location.pathname.startsWith('/documents')) return 'documents';
    if (location.pathname.startsWith('/prompts')) return 'prompts';
    if (location.pathname.startsWith('/document-types')) return 'document-types';
    if (location.pathname.startsWith('/scripts')) return 'scripts';
    if (location.pathname.startsWith('/git-branches')) return 'git-branches';
    if (location.pathname.startsWith('/git')) return 'git';
    if (location.pathname.startsWith('/hi-mom')) return 'hi-mom';
    if (location.pathname.startsWith('/clipboard')) return 'clipboard';
    if (location.pathname.startsWith('/continuous-docs')) return 'continuous-docs';
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
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-900 mb-4">Access Denied</h1>
          <p className="text-green-700 mb-4">You need admin privileges to access this area.</p>
          <button
            onClick={handleSignOut}
            className="text-green-600 hover:text-green-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-white shadow-sm border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-green-900">DHG Admin Code</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-green-700">
                {user?.email}
                <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                  Admin
                </span>
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-green-600 hover:text-green-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-green-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => navigate('/tasks')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'tasks'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
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
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
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
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
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
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              CLI Commands Registry
            </button>
            <button
              onClick={() => navigate('/database')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'database'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Database
            </button>
            <button
              onClick={() => navigate('/documents')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'documents'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Documents
            </button>
            <button
              onClick={() => navigate('/prompts')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'prompts'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Prompts
            </button>
            <button
              onClick={() => navigate('/document-types')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'document-types'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Doc Types
            </button>
            <button
              onClick={() => navigate('/scripts')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'scripts'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Scripts
            </button>
            <button
              onClick={() => navigate('/continuous-docs')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'continuous-docs'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Continuous Docs
            </button>
            <button
              onClick={() => navigate('/git')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'git'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Git
            </button>
            <button
              onClick={() => navigate('/git-branches')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'git-branches'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Git Branches
            </button>
            <button
              onClick={() => navigate('/hi-mom')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'hi-mom'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Hi Mom! 💚
            </button>
            <button
              onClick={() => navigate('/clipboard')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'clipboard'
                  ? 'border-green-500 text-green-700 font-medium'
                  : 'border-transparent text-green-600 hover:text-green-800 hover:border-green-300'
                }
              `}
            >
              Clipboard 📋
            </button>
          </nav>
        </div>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
};