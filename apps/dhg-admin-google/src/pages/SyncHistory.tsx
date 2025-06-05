import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase-adapter';
import { format } from 'date-fns';
import { Clock, CheckCircle, AlertCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';

interface SyncHistoryEntry {
  id: string;
  folder_id: string;
  folder_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
  items_processed: number;
  timestamp: string;
  completed_at: string | null;
  error_message: string | null;
  created_by: string | null;
}

interface SyncStatistics {
  totalSyncs: number;
  completedSyncs: number;
  failedSyncs: number;
  totalItemsProcessed: number;
  averageDuration: number;
}

export default function SyncHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchSyncHistory();
  }, [filter, limit]);

  const fetchSyncHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('google_sync_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setHistory(data || []);
      calculateStatistics(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching sync history:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data: SyncHistoryEntry[]) => {
    const stats: SyncStatistics = {
      totalSyncs: data.length,
      completedSyncs: data.filter(h => h.status === 'completed').length,
      failedSyncs: data.filter(h => h.status === 'failed').length,
      totalItemsProcessed: data.reduce((sum, h) => sum + (h.items_processed || 0), 0),
      averageDuration: 0
    };

    // Calculate average duration for completed syncs
    const completedWithDuration = data.filter(h => 
      h.status === 'completed' && h.completed_at && h.timestamp
    );

    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((sum, h) => {
        const duration = new Date(h.completed_at!).getTime() - new Date(h.timestamp).getTime();
        return sum + duration;
      }, 0);
      stats.averageDuration = totalDuration / completedWithDuration.length / 1000; // Convert to seconds
    }

    setStatistics(stats);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'completed_with_errors':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'completed_with_errors':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      case 'pending':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDuration = (entry: SyncHistoryEntry) => {
    if (!entry.completed_at || !entry.timestamp) return '-';
    const duration = new Date(entry.completed_at).getTime() - new Date(entry.timestamp).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Sync History</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchSyncHistory}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Drive Sync History</h1>
          <p className="text-gray-600">View and monitor sync operations with Google Drive</p>
        </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-1">Total Syncs</div>
            <div className="text-2xl font-bold text-gray-900">{statistics.totalSyncs}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-600">{statistics.completedSyncs}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-600">{statistics.failedSyncs}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-1">Items Processed</div>
            <div className="text-2xl font-bold text-gray-900">{statistics.totalItemsProcessed.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-1">Avg Duration</div>
            <div className="text-2xl font-bold text-gray-900">{statistics.averageDuration.toFixed(1)}s</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="completed_with_errors">Completed with Errors</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Show:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
          <button
            onClick={fetchSyncHistory}
            className="ml-auto px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Folder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(entry.timestamp), 'MMM dd, HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="truncate max-w-xs" title={entry.folder_name}>
                      {entry.folder_name}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-xs" title={entry.folder_id}>
                      {entry.folder_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(entry.status)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(entry.status)}`}>
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.items_processed.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(entry)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.error_message ? (
                      <div className="truncate max-w-xs text-red-600" title={entry.error_message}>
                        {entry.error_message}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {history.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No sync history found for the selected criteria.
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}