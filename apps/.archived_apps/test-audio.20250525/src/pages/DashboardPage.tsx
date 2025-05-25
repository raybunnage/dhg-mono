import { useState } from 'react';
import { toast } from 'sonner';
import { UserMenu } from '@dhg/shared-components';
import { useAuth, usePermission, useRoles } from '../hooks/useAuth';
import { Shield, Key, User, Mail, Calendar, Activity, Lock } from 'lucide-react';

export function DashboardPage() {
  const { user, signOut, updateProfile } = useAuth();
  const { hasPermission: canAccessAdmin } = usePermission('admin:access');
  const { roles } = useRoles();
  const [updating, setUpdating] = useState(false);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleUpdateProfile = async () => {
    setUpdating(true);
    try {
      await updateProfile({ full_name: fullName });
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const userInfo = {
    email: user?.email,
    name: user?.user_metadata?.full_name,
    avatar: user?.user_metadata?.avatar_url
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">Test Audio Dashboard</h1>
            <UserMenu user={userInfo} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Information Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              User Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">Email:</span>
                <span className="ml-2 font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">User ID:</span>
                <span className="ml-2 font-mono text-xs">{user?.id}</span>
              </div>
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">Created:</span>
                <span className="ml-2 font-medium">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Activity className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">Last Sign In:</span>
                <span className="ml-2 font-medium">
                  {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Session Information Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Key className="w-5 h-5 mr-2" />
              Session Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Lock className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">Provider:</span>
                <span className="ml-2 font-medium">{user?.app_metadata?.provider || 'email'}</span>
              </div>
              <div className="flex items-center text-sm">
                <Shield className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">Email Confirmed:</span>
                <span className="ml-2 font-medium">
                  {user?.email_confirmed_at ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Roles & Permissions Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Roles & Permissions
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Roles:</p>
                <div className="flex flex-wrap gap-2">
                  {roles.length > 0 ? (
                    roles.map(role => (
                      <span
                        key={role}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No roles assigned</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Permissions Check:</p>
                <div className="space-y-1">
                  <div className="flex items-center text-sm">
                    <span className="text-gray-600">Admin Access:</span>
                    <span className={`ml-2 font-medium ${canAccessAdmin ? 'text-green-600' : 'text-red-600'}`}>
                      {canAccessAdmin ? 'Granted' : 'Denied'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Update Profile Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Update Profile</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>
              <button
                onClick={handleUpdateProfile}
                disabled={updating}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Raw User Data */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Raw User Data (for debugging)</h2>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
}