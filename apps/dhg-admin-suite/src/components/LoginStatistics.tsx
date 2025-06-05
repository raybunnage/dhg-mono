import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabase-admin';
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

// Debug info interface
interface DebugInfo {
  totalLogs24h: number;
  totalLogs7d: number;
  totalLogs30d: number;
  uniqueEventTypes: string[];
  sampleLogs: any[];
  errors: string[];
  lastRefresh: string;
  tableAccessTest: boolean;
  totalRecordsInTable: number;
  allRecordsSample: any[];
}

// Audit log entry interface
interface AuditLogEntry {
  id: string;
  created_at: string | null;
  event_type: string;
  user_id: string | null;
  metadata: any;
  ip_address: any;
  user_agent: string | null;
}

export const LoginStatistics: React.FC = () => {
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const fetchStats = async () => {
    try {
      setError(null);
      const debugErrors: string[] = [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      console.log('[LoginStatistics] Fetching stats with date ranges:', {
        now: now.toISOString(),
        oneDayAgo: oneDayAgo.toISOString(),
        sevenDaysAgo: sevenDaysAgo.toISOString(),
        thirtyDaysAgo: thirtyDaysAgo.toISOString()
      });

      // First, let's test if we can access the auth_audit_log table at all
      console.log('[LoginStatistics] Testing basic auth_audit_log access...');
      const testQuery = await supabaseAdmin
        .from('auth_audit_log')
        .select('*')
        .limit(1);
      
      console.log('[LoginStatistics] Test query result:', testQuery);
      
      if (testQuery.error) {
        debugErrors.push(`Test query failed: ${testQuery.error.message}`);
        console.error('[LoginStatistics] Cannot access auth_audit_log:', testQuery.error);
      }

      // Try to get all records first (no date filter) to see what's actually in the table
      console.log('[LoginStatistics] Fetching ALL auth_audit_log records...');
      console.log('[LoginStatistics] Using supabaseAdmin client:', supabaseAdmin);
      
      const allRecords = await supabaseAdmin
        .from('auth_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      console.log('[LoginStatistics] All records query result:', {
        data: allRecords.data,
        error: allRecords.error,
        count: allRecords.data?.length || 0
      });
      
      if (allRecords.error) {
        debugErrors.push(`All records query failed: ${allRecords.error.message}`);
        console.error('[LoginStatistics] Error fetching all records:', allRecords.error);
      } else {
        console.log('[LoginStatistics] Found total records:', allRecords.data?.length || 0);
        if (allRecords.data && allRecords.data.length > 0) {
          console.log('[LoginStatistics] Sample record:', allRecords.data[0]);
        }
      }

      // Get login events for different time periods
      const [logs24h, logs7d, logs30d] = await Promise.all([
        supabaseAdmin
          .from('auth_audit_log')
          .select('*')
          .gte('created_at', oneDayAgo.toISOString())
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('auth_audit_log')
          .select('*')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('auth_audit_log')
          .select('*')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
      ]);

      if (logs24h.error) {
        debugErrors.push(`24h logs error: ${logs24h.error.message}`);
        console.error('[LoginStatistics] 24h logs error:', logs24h.error);
      }
      if (logs7d.error) {
        debugErrors.push(`7d logs error: ${logs7d.error.message}`);
        console.error('[LoginStatistics] 7d logs error:', logs7d.error);
      }
      if (logs30d.error) {
        debugErrors.push(`30d logs error: ${logs30d.error.message}`);
        console.error('[LoginStatistics] 30d logs error:', logs30d.error);
      }

      if (logs24h.error || logs7d.error || logs30d.error) {
        throw new Error('Failed to fetch audit logs');
      }

      const logs24hData: AuditLogEntry[] = logs24h.data || [];
      const logs7dData: AuditLogEntry[] = logs7d.data || [];
      const logs30dData: AuditLogEntry[] = logs30d.data || [];

      console.log('[LoginStatistics] Fetched log counts:', {
        '24h': logs24hData.length,
        '7d': logs7dData.length,
        '30d': logs30dData.length
      });

      // Collect unique event types for debugging
      const allEventTypes = new Set<string>();
      logs24hData.forEach((log: AuditLogEntry) => allEventTypes.add(log.event_type));

      console.log('[LoginStatistics] Unique event types found:', Array.from(allEventTypes));

      // Get all event types to understand what we're working with
      const all24hEventTypes = [...new Set(logs24hData.map(log => log.event_type))];
      const all7dEventTypes = [...new Set(logs7dData.map(log => log.event_type))];
      const all30dEventTypes = [...new Set(logs30dData.map(log => log.event_type))];
      
      console.log('[LoginStatistics] All event types in data:', {
        '24h': all24hEventTypes,
        '7d': all7dEventTypes,
        '30d': all30dEventTypes
      });

      // Calculate statistics - filter for login events
      // Based on actual data, we have simple event types: 'login' and 'logout'
      const isLoginEvent = (eventType: string) => {
        return eventType === 'login';
      };

      const isFailedLoginEvent = (eventType: string) => {
        // Check for login_failed or similar patterns
        return eventType === 'login_failed' || 
               eventType.toLowerCase().includes('login_fail') ||
               eventType.toLowerCase().includes('auth_fail');
      };

      // Filter for successful login events
      const successfulLogins24h = logs24hData.filter((log: AuditLogEntry) => isLoginEvent(log.event_type));
      const successfulLogins7d = logs7dData.filter((log: AuditLogEntry) => isLoginEvent(log.event_type));
      const successfulLogins30d = logs30dData.filter((log: AuditLogEntry) => isLoginEvent(log.event_type));
      
      // Filter for failed login events
      const failedLogins24h = logs24hData.filter((log: AuditLogEntry) => isFailedLoginEvent(log.event_type));

      // If no login events found using the filter, show all events as a fallback
      const hasLoginEvents = successfulLogins24h.length > 0 || successfulLogins7d.length > 0 || successfulLogins30d.length > 0;
      
      const totalLogins24h = hasLoginEvents ? successfulLogins24h.length : logs24hData.length;
      const totalLogins7d = hasLoginEvents ? successfulLogins7d.length : logs7dData.length;
      const totalLogins30d = hasLoginEvents ? successfulLogins30d.length : logs30dData.length;
      const totalFailedLogins24h = failedLogins24h.length;

      console.log('[LoginStatistics] Filtered login counts:', {
        totalLogins24h,
        totalLogins7d,
        totalLogins30d,
        totalFailedLogins24h
      });

      // Unique users (from successful logins or all events if no login events found)
      const logsForUniqueUsers24h = hasLoginEvents ? successfulLogins24h : logs24hData;
      const logsForUniqueUsers7d = hasLoginEvents ? successfulLogins7d : logs7dData;
      
      const uniqueUsers24h = new Set(logsForUniqueUsers24h.filter((log: AuditLogEntry) => log.user_id).map((log: AuditLogEntry) => log.user_id)).size;
      const uniqueUsers7d = new Set(logsForUniqueUsers7d.filter((log: AuditLogEntry) => log.user_id).map((log: AuditLogEntry) => log.user_id)).size;

      // Recent logins and failed logins
      const recentLogins = hasLoginEvents ? successfulLogins24h.slice(0, 10) : logs24hData.slice(0, 10);
      const recentFailedLogins = failedLogins24h.slice(0, 10);

      // Auth method breakdown (only for successful logins or all events if no login events)
      const authMethodCounts: Record<string, number> = {};
      const logsForAuthMethod = hasLoginEvents ? successfulLogins7d : logs7dData;
      logsForAuthMethod.forEach((log: AuditLogEntry) => {
        const method = log.metadata?.auth_method || 'email/password';
        authMethodCounts[method] = (authMethodCounts[method] || 0) + 1;
      });
      
      const authMethodBreakdown = Object.entries(authMethodCounts)
        .map(([auth_method, count]) => ({ auth_method, count }))
        .sort((a, b) => b.count - a.count);

      // Get top users from auth_allowed_emails with login counts
      const { data: topUsersData, error: topUsersError } = await supabaseAdmin
        .from('auth_allowed_emails')
        .select('id, email, login_count, last_login_at')
        .not('login_count', 'is', null)
        .gt('login_count', 0)
        .order('login_count', { ascending: false })
        .limit(10);

      if (topUsersError) {
        console.error('Error fetching top users:', topUsersError);
      }

      const topUsers = (topUsersData || []).map((user: any) => ({
        user_id: user.id,
        email: user.email,
        login_count: user.login_count || 0,
        last_login: user.last_login_at
      }));

      // Get total users
      const { count: totalUsers } = await supabaseAdmin
        .from('auth_allowed_emails')
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

      // Set debug info with more details
      setDebugInfo({
        totalLogs24h: logs24hData.length,
        totalLogs7d: logs7dData.length,
        totalLogs30d: logs30dData.length,
        uniqueEventTypes: Array.from(allEventTypes),
        sampleLogs: logs24hData.slice(0, 5).map(log => ({
          id: log.id,
          event_type: log.event_type,
          user_id: log.user_id,
          created_at: log.created_at,
          metadata: log.metadata,
          isLogin: isLoginEvent(log.event_type),
          isFailed: isFailedLoginEvent(log.event_type)
        })),
        errors: debugErrors,
        lastRefresh: new Date().toISOString(),
        tableAccessTest: !testQuery.error,
        totalRecordsInTable: allRecords.data?.length || 0,
        allRecordsSample: (allRecords.data || []).slice(0, 5).map(log => ({
          id: log.id,
          event_type: log.event_type,
          user_id: log.user_id,
          created_at: log.created_at,
          metadata: log.metadata,
          isLogin: isLoginEvent(log.event_type),
          isFailed: isFailedLoginEvent(log.event_type)
        }))
      });

      console.log('[LoginStatistics] Stats calculated:', {
        totalLogins24h,
        totalLogins7d,
        totalLogins30d,
        totalFailedLogins24h,
        uniqueUsers24h,
        uniqueUsers7d
      });
    } catch (err) {
      console.error('Error fetching login statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      setDebugInfo({
        totalLogs24h: 0,
        totalLogs7d: 0,
        totalLogs30d: 0,
        uniqueEventTypes: [],
        sampleLogs: [],
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        lastRefresh: new Date().toISOString(),
        tableAccessTest: false,
        totalRecordsInTable: 0,
        allRecordsSample: []
      });
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Show notice if we're displaying all audit events */}
      {debugInfo && !debugInfo.uniqueEventTypes.some(type => 
        type.toLowerCase().includes('login') || 
        type.toLowerCase().includes('sign_in') || 
        type.toLowerCase().includes('auth')
      ) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> No specific login events found. Showing all audit log entries.
            Enable debug mode to see available event types.
          </p>
        </div>
      )}

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

      {/* Debug Information */}
      {showDebug && debugInfo && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Debug Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Table Access</p>
              <p className={`text-sm font-bold ${debugInfo.tableAccessTest ? 'text-green-600' : 'text-red-600'}`}>
                {debugInfo.tableAccessTest ? '✓ SUCCESS' : '✗ FAILED'}
              </p>
              <p className="text-sm text-gray-900">Total Records: {debugInfo.totalRecordsInTable}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600">Filtered Logs</p>
              <p className="text-sm text-gray-900">24h: {debugInfo.totalLogs24h}</p>
              <p className="text-sm text-gray-900">7d: {debugInfo.totalLogs7d}</p>
              <p className="text-sm text-gray-900">30d: {debugInfo.totalLogs30d}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-600">Event Types Found</p>
              {debugInfo.uniqueEventTypes.length > 0 ? (
                <ul className="text-sm text-gray-900">
                  {debugInfo.uniqueEventTypes.map(type => (
                    <li key={type}>• {type}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No event types found</p>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-600">Last Refresh</p>
              <p className="text-sm text-gray-900">
                {formatDistanceToNow(new Date(debugInfo.lastRefresh), { addSuffix: true })}
              </p>
              {debugInfo.errors.length > 0 && (
                <>
                  <p className="text-sm font-medium text-red-600 mt-2">Errors</p>
                  {debugInfo.errors.map((err, idx) => (
                    <p key={idx} className="text-sm text-red-500">{err}</p>
                  ))}
                </>
              )}
            </div>
          </div>

          {debugInfo.allRecordsSample.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Sample Records from auth_audit_log Table</p>
              <div className="bg-white rounded border border-gray-200 p-3 overflow-x-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(debugInfo.allRecordsSample, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {debugInfo.sampleLogs.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Sample Log Entries (First 5)</p>
              <div className="bg-white rounded border border-gray-200 p-3 overflow-x-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(debugInfo.sampleLogs, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};