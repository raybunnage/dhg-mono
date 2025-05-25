import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface LoginStats {
  totalLogins24h: number;
  totalLogins7d: number;
  totalLogins30d: number;
  totalFailedLogins24h: number;
  uniqueUsers24h: number;
  uniqueUsers7d: number;
  totalUsers: number;
  recentLogins: any[];
  recentFailedLogins: any[];
  topUsers: Array<{
    user_id: string;
    email: string;
    login_count: number;
    last_login: string;
  }>;
  authMethodBreakdown: Array<{
    auth_method: string;
    count: number;
  }>;
}

export const LoginStatistics: React.FC = () => {
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setError(null);
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get login events for different time periods
      const [logs24h, logs7d, logs30d] = await Promise.all([
        supabase
          .from('auth_audit_log')
          .select('*')
          .gte('created_at', oneDayAgo.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('auth_audit_log')
          .select('*')
          .gte('created_at', sevenDaysAgo.toISOString()),
        supabase
          .from('auth_audit_log')
          .select('*')
          .gte('created_at', thirtyDaysAgo.toISOString())
      ]);

      if (logs24h.error || logs7d.error || logs30d.error) {
        throw new Error('Failed to fetch audit logs');
      }

      const logs24hData = logs24h.data || [];
      const logs7dData = logs7d.data || [];
      const logs30dData = logs30d.data || [];

      // Calculate statistics
      const totalLogins24h = logs24hData.filter(log => log.event_type === 'login').length;
      const totalLogins7d = logs7dData.filter(log => log.event_type === 'login').length;
      const totalLogins30d = logs30dData.filter(log => log.event_type === 'login').length;
      const totalFailedLogins24h = logs24hData.filter(log => log.event_type === 'login_failed').length;

      // Unique users
      const uniqueUsers24h = new Set(logs24hData.filter(log => log.user_id).map(log => log.user_id)).size;
      const uniqueUsers7d = new Set(logs7dData.filter(log => log.user_id).map(log => log.user_id)).size;

      // Recent logins and failed logins
      const recentLogins = logs24hData
        .filter(log => log.event_type === 'login')
        .slice(0, 10);
      
      const recentFailedLogins = logs24hData
        .filter(log => log.event_type === 'login_failed')
        .slice(0, 10);

      // Auth method breakdown
      const authMethodCounts: Record<string, number> = {};
      logs7dData.forEach(log => {
        const method = log.metadata?.auth_method || 'standard';
        authMethodCounts[method] = (authMethodCounts[method] || 0) + 1;
      });
      
      const authMethodBreakdown = Object.entries(authMethodCounts)
        .map(([auth_method, count]) => ({ auth_method, count }))
        .sort((a, b) => b.count - a.count);

      // Get top users from allowed_emails with login counts
      const { data: topUsersData, error: topUsersError } = await supabase
        .from('allowed_emails')
        .select('id, email, login_count, last_login_at')
        .not('login_count', 'is', null)
        .gt('login_count', 0)
        .order('login_count', { ascending: false })
        .limit(10);

      if (topUsersError) {
        console.error('Error fetching top users:', topUsersError);
      }

      const topUsers = (topUsersData || []).map(user => ({
        user_id: user.id,
        email: user.email,
        login_count: user.login_count || 0,
        last_login: user.last_login_at
      }));

      // Get total users
      const { count: totalUsers } = await supabase
        .from('allowed_emails')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalLogins24h,
        totalLogins7d,
        totalLogins30d,
        totalFailedLogins24h,
        uniqueUsers24h,
        uniqueUsers7d,
        totalUsers: totalUsers || 0,
        recentLogins,
        recentFailedLogins,
        topUsers,
        authMethodBreakdown
      });
    } catch (err) {
      console.error('Error fetching login statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">Error: {error}</p>
        <button 
          onClick={handleRefresh}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Login Statistics</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">24h Logins</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalLogins24h}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.uniqueUsers24h} unique users</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">7d Logins</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalLogins7d}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.uniqueUsers7d} unique users</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">30d Logins</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalLogins30d}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">24h Failed Logins</p>
          <p className="text-2xl font-bold text-red-600">{stats.totalFailedLogins24h}</p>
        </div>
      </div>

      {/* Auth Method Breakdown */}
      {stats.authMethodBreakdown.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Authentication Methods (7d)</h3>
          <div className="space-y-2">
            {stats.authMethodBreakdown.map(({ auth_method, count }) => (
              <div key={auth_method} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{auth_method}</span>
                <span className="text-sm font-medium text-gray-900">{count} logins</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Users */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Most Active Users</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Logins
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.topUsers.map((user) => (
                <tr key={user.user_id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{user.email}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{user.login_count}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {user.last_login 
                      ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                      : 'Never'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Logins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Logins</h3>
          <div className="space-y-3">
            {stats.recentLogins.map((log) => (
              <div key={log.id} className="border-b border-gray-100 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.metadata?.email || 'Unknown user'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {log.metadata?.auth_method || 'standard'} • {' '}
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {stats.recentLogins.length === 0 && (
              <p className="text-sm text-gray-500">No recent logins</p>
            )}
          </div>
        </div>

        {/* Recent Failed Logins */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Failed Logins</h3>
          <div className="space-y-3">
            {stats.recentFailedLogins.map((log) => (
              <div key={log.id} className="border-b border-gray-100 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-red-600">
                      {log.metadata?.email || 'Unknown email'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {log.metadata?.reason || 'Login failed'} • {' '}
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {stats.recentFailedLogins.length === 0 && (
              <p className="text-sm text-gray-500">No recent failed logins</p>
            )}
          </div>
        </div>
      </div>

      {/* Active Users Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Total Active Users:</span> {stats.totalUsers} • 
          <span className="font-medium ml-2">Active Today:</span> {stats.uniqueUsers24h} • 
          <span className="font-medium ml-2">Active This Week:</span> {stats.uniqueUsers7d}
        </p>
      </div>
    </div>
  );
};