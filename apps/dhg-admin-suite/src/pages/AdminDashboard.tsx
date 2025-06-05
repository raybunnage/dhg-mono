import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserManagement } from '../components/UserManagement';
import { AllowedEmailsManagement } from '../components/AllowedEmailsManagement';
import { LoginStatistics } from '../components/LoginStatistics';
import { DriveFilterManagement } from '../components/DriveFilterManagement';
import { TestAuthAuditLog } from '../components/TestAuthAuditLog';

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'emails' | 'users' | 'stats' | 'filters'>('emails');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-900 mb-4">Access Denied</h1>
          <p className="text-blue-700 mb-4">You need admin privileges to access this area.</p>
          <button
            onClick={handleSignOut}
            className="text-blue-600 hover:text-blue-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-900">DHG Admin Suite</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-700">
                {user?.email}
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  Admin
                </span>
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-blue-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('emails')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'emails'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-blue-600 hover:text-blue-800 hover:border-blue-300'
                }
              `}
            >
              Allowed Emails
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'users'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-blue-600 hover:text-blue-800 hover:border-blue-300'
                }
              `}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'stats'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-blue-600 hover:text-blue-800 hover:border-blue-300'
                }
              `}
            >
              Login Statistics
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'filters'
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-blue-600 hover:text-blue-800 hover:border-blue-300'
                }
              `}
            >
              Drive Filters
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'emails' ? (
          <AllowedEmailsManagement />
        ) : activeTab === 'users' ? (
          <UserManagement />
        ) : activeTab === 'stats' ? (
          <LoginStatistics />
        ) : (
          <DriveFilterManagement />
        )}
      </main>
    </div>
  );
};