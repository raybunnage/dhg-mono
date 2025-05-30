import React, { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  FolderOpen, 
  RefreshCw, 
  BarChart3, 
  Filter,
  LogOut
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const tabs = [
    { id: 'explorer', label: 'Drive Explorer', path: '/explorer', icon: FolderOpen },
    { id: 'sync', label: 'Sync Status', path: '/sync-status', icon: RefreshCw },
    { id: 'statistics', label: 'Statistics', path: '/statistics', icon: BarChart3 },
    { id: 'filters', label: 'Drive Filters', path: '/filters', icon: Filter },
  ];

  const activeTab = tabs.find(tab => location.pathname === tab.path)?.id || 'explorer';

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
            <h1 className="text-2xl font-bold text-gray-900">DHG Admin Google</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                {user?.email}
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                  Admin
                </span>
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <LogOut className="h-4 w-4" />
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
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    py-2 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2
                    ${activeTab === tab.id
                      ? 'border-green-500 text-green-700 font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main content area */}
        {children}
      </main>
    </div>
  );
};