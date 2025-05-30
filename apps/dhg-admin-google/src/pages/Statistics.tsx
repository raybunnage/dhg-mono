import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../utils/supabase-adapter';
import { 
  FolderOpen, 
  FileText, 
  Film,
  RefreshCw,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface SyncStatistics {
  id: string;
  folder_id: string;
  folder_name: string;
  root_drive_id: string | null;
  google_drive_count: number;
  google_drive_documents: number;
  google_drive_folders: number;
  mp4_files: number;
  mp4_total_size: string;
  new_files: number;
  total_google_drive_items: number;
  updated_at: string;
}

interface AggregatedStats {
  totalFolders: number;
  totalFiles: number;
  totalDocuments: number;
  totalSubfolders: number;
  totalMp4Files: number;
  totalMp4Size: number;
  totalNewFiles: number;
  lastUpdated: string | null;
}

export const Statistics: React.FC = () => {
  const [statistics, setStatistics] = useState<SyncStatistics[]>([]);
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats>({
    totalFolders: 0,
    totalFiles: 0,
    totalDocuments: 0,
    totalSubfolders: 0,
    totalMp4Files: 0,
    totalMp4Size: 0,
    totalNewFiles: 0,
    lastUpdated: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('google_sync_statistics')
        .select('*')
        .order('google_drive_count', { ascending: false })
        .limit(50);
      
      if (fetchError) throw fetchError;
      
      if (data) {
        setStatistics(data);
        
        // Calculate aggregated stats
        const aggregated = data.reduce((acc, stat) => {
          acc.totalFolders += 1;
          acc.totalFiles += stat.google_drive_count;
          acc.totalDocuments += stat.google_drive_documents;
          acc.totalSubfolders += stat.google_drive_folders;
          acc.totalMp4Files += stat.mp4_files;
          acc.totalMp4Size += parseInt(stat.mp4_total_size || '0');
          acc.totalNewFiles += stat.new_files;
          
          if (!acc.lastUpdated || new Date(stat.updated_at) > new Date(acc.lastUpdated)) {
            acc.lastUpdated = stat.updated_at;
          }
          
          return acc;
        }, {
          totalFolders: 0,
          totalFiles: 0,
          totalDocuments: 0,
          totalSubfolders: 0,
          totalMp4Files: 0,
          totalMp4Size: 0,
          totalNewFiles: 0,
          lastUpdated: null as string | null
        });
        
        setAggregatedStats(aggregated);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatistics = async () => {
    setRefreshing(true);
    
    // Here you would normally call the populate-statistics command
    // For now, we'll just refetch the data
    await fetchStatistics();
    
    setRefreshing(false);
  };


  const formatFileSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading statistics...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchStatistics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Refresh Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Google Drive Statistics</h2>
            <p className="text-gray-600 mt-1">
              Statistics for: Dynamic Healing Discussion Group
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Root Drive ID: 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV
            </p>
          </div>
          <button
            onClick={refreshStatistics}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Folders</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalFolders}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalFiles.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">MP4 Files</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalMp4Files}</p>
                <p className="text-xs text-gray-500">{formatFileSize(aggregatedStats.totalMp4Size)}</p>
              </div>
              <Film className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Files (7d)</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalNewFiles}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Last Updated */}
        {aggregatedStats.lastUpdated && (
          <div className="text-sm text-gray-600">
            <Calendar className="inline h-4 w-4 mr-1" />
            Last updated: {formatDate(aggregatedStats.lastUpdated)}
          </div>
        )}

        {/* Detailed Statistics Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Folder Statistics (Top 50 by Size)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MP4 Files
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MP4 Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New (7d)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.map((stat) => (
                  <tr key={stat.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.folder_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.google_drive_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.google_drive_documents.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.google_drive_folders.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.mp4_files}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(parseInt(stat.mp4_total_size || '0'))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.new_files > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {stat.new_files}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};